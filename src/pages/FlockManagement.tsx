import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Package } from 'lucide-react';

const FlockManagement: React.FC = () => {
  const { user } = useAuth();
  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentFlock, setCurrentFlock] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    breed: 'Broiler',
    placementDate: new Date().toISOString().split('T')[0],
    initialCount: '',
    source: '',
    farmType: '',
  });

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'flocks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flockList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlocks(flockList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'flocks');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'flocks'), {
        ...formData,
        initialCount: Number(formData.initialCount),
        currentCount: Number(formData.initialCount),
        userId: user.uid,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
      toast.success('Flock added successfully');
      setIsAddOpen(false);
      setFormData({ 
        name: '', 
        breed: 'Broiler', 
        placementDate: new Date().toISOString().split('T')[0], 
        initialCount: '',
        source: '',
        farmType: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'flocks');
      toast.error('Failed to add flock');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFlock) return;
    try {
      await updateDoc(doc(db, 'flocks', currentFlock.id), {
        ...formData,
        initialCount: Number(formData.initialCount),
      });
      toast.success('Flock updated successfully');
      setIsEditOpen(false);
    } catch (error) {
      toast.error('Failed to update flock');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this flock?')) {
      try {
        await deleteDoc(doc(db, 'flocks', id));
        toast.success('Flock deleted successfully');
      } catch (error) {
        toast.error('Failed to delete flock');
      }
    }
  };

  const openEdit = (flock: any) => {
    setCurrentFlock(flock);
    setFormData({
      name: flock.name,
      breed: flock.breed,
      placementDate: flock.placementDate,
      initialCount: flock.initialCount.toString(),
      source: flock.source || '',
      farmType: flock.farmType || '',
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flock Management</h1>
          <p className="text-slate-500">Manage your bird batches</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-2">
              <Plus size={20} />
              <span>Add Flock</span>
            </Button>
          } />
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Flock</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Flock Name / Batch ID</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Batch A1" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breed">Breed</Label>
                <Select value={formData.breed} onValueChange={v => setFormData({...formData, breed: v})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Broiler">Broiler</SelectItem>
                    <SelectItem value="Layer">Layer</SelectItem>
                    <SelectItem value="Sonali">Sonali</SelectItem>
                    <SelectItem value="Gavthi">Gavthi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialCount">Initial Count</Label>
                  <Input 
                    id="initialCount" 
                    type="number" 
                    required 
                    value={formData.initialCount}
                    onChange={e => setFormData({...formData, initialCount: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placementDate">Placement Date</Label>
                  <Input 
                    id="placementDate" 
                    type="date" 
                    required 
                    value={formData.placementDate}
                    onChange={e => setFormData({...formData, placementDate: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Save Flock</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : flocks.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center space-y-4 border border-dashed border-slate-200">
          <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Package size={32} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">No flocks found</h3>
            <p className="text-slate-500">Start by adding your first batch of birds</p>
          </div>
          <Button variant="outline" onClick={() => setIsAddOpen(true)} className="rounded-xl">Add Flock</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flocks.map((flock) => (
            <Card key={flock.id} className="border-none shadow-sm overflow-hidden group">
              <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between space-y-0 p-4">
                <CardTitle className="text-base font-bold text-slate-800">{flock.name}</CardTitle>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => openEdit(flock)}>
                    <Edit2 size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(flock.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Breed</span>
                  <span className="font-semibold text-slate-800">{flock.breed}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Current</p>
                    <p className="text-lg font-bold text-emerald-900">{flock.currentCount || flock.initialCount}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">Initial</p>
                    <p className="text-lg font-bold text-blue-900">{flock.initialCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Flock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Flock Name</Label>
              <Input 
                id="edit-name" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-breed">Breed</Label>
              <Input 
                id="edit-breed" 
                required 
                value={formData.breed}
                onChange={e => setFormData({...formData, breed: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-count">Bird Count</Label>
                <Input 
                  id="edit-count" 
                  type="number" 
                  required 
                  value={formData.count}
                  onChange={e => setFormData({...formData, count: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-age">Age (Days)</Label>
                <Input 
                  id="edit-age" 
                  type="number" 
                  required 
                  value={formData.age}
                  onChange={e => setFormData({...formData, age: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">Update Flock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlockManagement;
