import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Tag, Percent, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

const AdminOffers: React.FC = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage', // percentage or fixed
    discountValue: '',
    minPurchase: '0',
    expiryDate: format(new Date(), 'yyyy-MM-dd'),
    isActive: true,
    description: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'coupons'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        discountValue: Number(formData.discountValue),
        minPurchase: Number(formData.minPurchase),
        createdAt: new Date().toISOString()
      };

      if (isEditOpen && currentCoupon) {
        await updateDoc(doc(db, 'coupons', currentCoupon.id), data);
        toast.success('Coupon updated successfully');
      } else {
        await addDoc(collection(db, 'coupons'), data);
        toast.success('Coupon created successfully');
      }
      
      setIsAddOpen(false);
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      toast.success('Coupon deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'coupons');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      minPurchase: '0',
      expiryDate: format(new Date(), 'yyyy-MM-dd'),
      isActive: true,
      description: ''
    });
    setCurrentCoupon(null);
  };

  const openEdit = (coupon: any) => {
    setCurrentCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minPurchase: coupon.minPurchase.toString(),
      expiryDate: coupon.expiryDate,
      isActive: coupon.isActive,
      description: coupon.description || ''
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Offers & Coupons</h1>
          <p className="text-slate-500 font-medium">Create and manage promotional discounts</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger render={
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 flex items-center gap-2">
              <Plus size={20} />
              <span>Create Coupon</span>
            </Button>
          } />
          <DialogContent className="rounded-[2rem] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create New Coupon</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code</Label>
                <Input id="code" required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="rounded-xl uppercase" placeholder="e.g. WELCOME10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant={formData.discountType === 'percentage' ? 'default' : 'outline'}
                      className="flex-1 rounded-xl"
                      onClick={() => setFormData({...formData, discountType: 'percentage'})}
                    >
                      <Percent size={14} className="mr-2" /> %
                    </Button>
                    <Button 
                      type="button" 
                      variant={formData.discountType === 'fixed' ? 'default' : 'outline'}
                      className="flex-1 rounded-xl"
                      onClick={() => setFormData({...formData, discountType: 'fixed'})}
                    >
                      ₹ Fixed
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Discount Value</Label>
                  <Input id="value" type="number" required value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: e.target.value})} className="rounded-xl" placeholder="10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min">Min Purchase (₹)</Label>
                  <Input id="min" type="number" value={formData.minPurchase} onChange={e => setFormData({...formData, minPurchase: e.target.value})} className="rounded-xl" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input id="expiry" type="date" required value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-xl" placeholder="e.g. 10% off on first order" />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">Save Coupon</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#122B21]"></div>
        </div>
      ) : coupons.length === 0 ? (
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-12 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Tag size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No offers yet</h3>
          <p className="text-slate-500 mt-2">Create coupons to boost your sales</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coupons.map((coupon) => (
            <Card key={coupon.id} className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden group hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl font-black text-lg tracking-wider border border-emerald-100">
                    {coupon.code}
                  </div>
                  <Badge variant={coupon.isActive ? 'default' : 'secondary'} className="rounded-lg">
                    {coupon.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardTitle className="mt-4 text-2xl font-bold">
                  {coupon.discountType === 'percentage' ? `${coupon.discountValue}% Off` : `₹${coupon.discountValue} Off`}
                </CardTitle>
                <CardDescription>{coupon.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>Expires: {format(new Date(coupon.expiryDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>Min Purchase: ₹{coupon.minPurchase}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => openEdit(coupon)}>
                    <Edit2 size={14} className="mr-2" /> Edit
                  </Button>
                  <Button variant="outline" className="rounded-xl hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(coupon.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="rounded-[2rem] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit Coupon</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Coupon Code</Label>
              <Input id="edit-code" required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="rounded-xl uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant={formData.discountType === 'percentage' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setFormData({...formData, discountType: 'percentage'})}
                  >
                    <Percent size={14} className="mr-2" /> %
                  </Button>
                  <Button 
                    type="button" 
                    variant={formData.discountType === 'fixed' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setFormData({...formData, discountType: 'fixed'})}
                  >
                    ₹ Fixed
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-value">Discount Value</Label>
                <Input id="edit-value" type="number" required value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-min">Min Purchase (₹)</Label>
                <Input id="edit-min" type="number" value={formData.minPurchase} onChange={e => setFormData({...formData, minPurchase: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expiry">Expiry Date</Label>
                <Input id="edit-expiry" type="date" required value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input id="edit-desc" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-xl" />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">Update Coupon</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOffers;
