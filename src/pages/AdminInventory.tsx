import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Package, ShoppingCart, IndianRupee, Info, AlertTriangle, ShoppingBag } from 'lucide-react';

const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Feed',
    price: '',
    mrp: '',
    purchaseCost: '',
    unit: 'kg',
    description: '',
    imageUrls: [''],
    inStock: true,
    stockQuantity: '',
    lowStockLimit: '10',
    variants: [] as any[]
  });

  const [newVariant, setNewVariant] = useState({ name: '', price: '', mrp: '' });

  const fixImageUrl = (url: string) => {
    if (!url) return '';
    let fixedUrl = url.trim();
    if (fixedUrl.includes('drive.google.com')) {
      const match = fixedUrl.match(/\/d\/(.+?)(\/|$)/) || 
                    fixedUrl.match(/id=(.+?)(&|$)/) ||
                    fixedUrl.match(/\/file\/d\/(.+?)(\/|$)/) ||
                    fixedUrl.match(/drive\.google\.com\/open\?id=(.+?)(&|$)/);
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w1000`;
      }
    }
    return fixedUrl;
  };

  useEffect(() => {
    const q = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shopItems'));

    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fixedUrls = formData.imageUrls.map(url => fixImageUrl(url)).filter(url => url !== '');
      const salePrice = Number(formData.price);
      const mrp = Number(formData.mrp) || salePrice;
      const discount = mrp > 0 ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;

      await addDoc(collection(db, 'shopItems'), {
        ...formData,
        imageUrls: fixedUrls,
        imageUrl: fixedUrls[0] || '',
        price: salePrice,
        mrp: mrp,
        discountPercentage: discount,
        purchaseCost: Number(formData.purchaseCost) || 0,
        stockQuantity: Number(formData.stockQuantity) || 0,
        lowStockLimit: Number(formData.lowStockLimit) || 10,
        createdAt: new Date().toISOString()
      });
      toast.success('Product added successfully');
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'shopItems');
      toast.error('Failed to add product');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) return;
    try {
      const fixedUrls = formData.imageUrls.map(url => fixImageUrl(url)).filter(url => url !== '');
      const salePrice = Number(formData.price);
      const mrp = Number(formData.mrp) || salePrice;
      const discount = mrp > 0 ? Math.round(((mrp - salePrice) / mrp) * 100) : 0;

      await updateDoc(doc(db, 'shopItems', currentItem.id), {
        ...formData,
        imageUrls: fixedUrls,
        imageUrl: fixedUrls[0] || '',
        price: salePrice,
        mrp: mrp,
        discountPercentage: discount,
        purchaseCost: Number(formData.purchaseCost) || 0,
        stockQuantity: Number(formData.stockQuantity) || 0,
        lowStockLimit: Number(formData.lowStockLimit) || 10
      });
      toast.success('Product updated successfully');
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'shopItems');
      toast.error('Failed to update product');
    }
  };

  const addVariant = () => {
    if (!newVariant.name || !newVariant.price) {
      toast.error('Variant name and price are required');
      return;
    }
    const variantPrice = Number(newVariant.price);
    const variantMrp = Number(newVariant.mrp) || variantPrice;
    const variantDiscount = variantMrp > 0 ? Math.round(((variantMrp - variantPrice) / variantMrp) * 100) : 0;

    setFormData({
      ...formData,
      variants: [...formData.variants, {
        ...newVariant,
        price: variantPrice,
        mrp: variantMrp,
        discountPercentage: variantDiscount
      }]
    });
    setNewVariant({ name: '', price: '', mrp: '' });
  };

  const removeVariant = (index: number) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index)
    });
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'shopItems', itemToDelete));
      toast.success('Product deleted successfully');
      setIsDeleteOpen(false);
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'shopItems');
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Feed',
      price: '',
      mrp: '',
      purchaseCost: '',
      unit: 'kg',
      description: '',
      imageUrls: [''],
      inStock: true,
      stockQuantity: '',
      lowStockLimit: '10',
      variants: []
    });
    setCurrentItem(null);
  };

  const openEdit = (item: any) => {
    setCurrentItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      mrp: (item.mrp || item.price).toString(),
      purchaseCost: (item.purchaseCost || '').toString(),
      unit: item.unit,
      description: item.description || '',
      imageUrls: item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : [item.imageUrl || ''],
      inStock: item.inStock ?? true,
      stockQuantity: (item.stockQuantity ?? '').toString(),
      lowStockLimit: (item.lowStockLimit ?? '10').toString(),
      variants: item.variants || []
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-slate-500 font-medium">Manage products, stock levels and pricing</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger render={
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 flex items-center gap-2">
              <Plus size={20} />
              <span>Add Product</span>
            </Button>
          } />
          <DialogContent className="rounded-[2rem] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Add New Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl" placeholder="e.g. Premium Layer Feed" />
              </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Feed">Feed</SelectItem>
                        <SelectItem value="Medicine">Medicine</SelectItem>
                        <SelectItem value="Chicks">Chicks</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input id="unit" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="rounded-xl" placeholder="e.g. 50kg bag" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mrp">MRP (₹)</Label>
                    <Input id="mrp" type="number" required value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className="rounded-xl" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Sale Price (₹)</Label>
                    <Input id="price" type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="rounded-xl" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseCost">Purchase Cost (₹)</Label>
                    <Input id="purchaseCost" type="number" required value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: e.target.value})} className="rounded-xl" placeholder="0.00" />
                  </div>
                </div>

                {/* Variants Section */}
                <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag size={14} />
                      Variants
                    </div>
                  </h4>
                  
                  <div className="space-y-3">
                    {formData.variants.map((v, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                        <div className="font-bold">{v.name} - ₹{v.price} <span className="text-[10px] text-slate-400 font-normal line-through ml-1">₹{v.mrp}</span></div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeVariant(i)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Vol / Size" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} className="h-9 text-xs rounded-lg" />
                    <Input type="number" placeholder="MRP" value={newVariant.mrp} onChange={e => setNewVariant({...newVariant, mrp: e.target.value})} className="h-9 text-xs rounded-lg" />
                    <div className="flex gap-1">
                      <Input type="number" placeholder="Price" value={newVariant.price} onChange={e => setNewVariant({...newVariant, price: e.target.value})} className="h-9 text-xs rounded-lg" />
                      <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-lg bg-[#122B21]" onClick={addVariant}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Status</Label>
                <Select value={formData.inStock ? 'true' : 'false'} onValueChange={v => setFormData({...formData, inStock: v === 'true'})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">In Stock</SelectItem>
                    <SelectItem value="false">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} />
                  Inventory Management
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stockQuantity">Current Stock</Label>
                    <Input id="stockQuantity" type="number" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: e.target.value})} className="rounded-xl bg-white" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockLimit">Low Stock Alert</Label>
                    <Input id="lowStockLimit" type="number" value={formData.lowStockLimit} onChange={e => setFormData({...formData, lowStockLimit: e.target.value})} className="rounded-xl bg-white" placeholder="10" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-xl" placeholder="Brief product details" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Product Images</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 rounded-lg text-xs"
                    onClick={() => setFormData({...formData, imageUrls: [...formData.imageUrls, '']})}
                    disabled={formData.imageUrls.length >= 4}
                  >
                    <Plus size={14} className="mr-1" /> Add More
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          value={url} 
                          onChange={e => {
                            const newUrls = [...formData.imageUrls];
                            newUrls[index] = e.target.value;
                            setFormData({...formData, imageUrls: newUrls});
                          }} 
                          className="rounded-xl" 
                          placeholder={`Image URL ${index + 1}`} 
                        />
                        {formData.imageUrls.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-xl text-slate-400 hover:text-red-500"
                            onClick={() => {
                              const newUrls = formData.imageUrls.filter((_, i) => i !== index);
                              setFormData({...formData, imageUrls: newUrls});
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">Save Product</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Products</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{items.filter(i => i.stockQuantity <= i.lowStockLimit && i.inStock).length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low Stock</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{items.filter(i => !i.inStock || i.stockQuantity <= 0).length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Out of Stock</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              ₹{(items.reduce((sum, i) => sum + (Number(i.price) * (Number(i.stockQuantity) || 0)), 0) / 1000).toFixed(1)}k
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Value</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#122B21]"></div>
        </div>
      ) : items.length === 0 ? (
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-12 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <ShoppingCart size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No products yet</h3>
          <p className="text-slate-500 mt-2">Start adding items to your shop catalog</p>
        </Card>
      ) : (
        <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Price</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                          {item.imageUrls && item.imageUrls.length > 0 ? (
                            <img src={item.imageUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">{item.description || 'No description'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-slate-200 bg-white">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-900 font-bold">
                        <IndianRupee size={14} />
                        <span>{item.price.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-medium ml-1">/ {item.unit}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          (item.stockQuantity || 0) <= (item.lowStockLimit || 10) ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {item.stockQuantity || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{item.unit}</span>
                        {(item.stockQuantity || 0) <= (item.lowStockLimit || 10) && (
                          <AlertTriangle size={12} className="text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${item.inStock ? 'bg-emerald-50/50 text-emerald-600' : 'bg-red-50/50 text-red-600'} border-none rounded-lg text-[10px] font-bold px-2 py-1`}>
                        {item.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl" onClick={() => openEdit(item)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl hover:bg-red-50 hover:text-red-600" onClick={() => { setItemToDelete(item.id); setIsDeleteOpen(true); }}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="rounded-[2rem] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name</Label>
              <Input id="edit-name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feed">Feed</SelectItem>
                    <SelectItem value="Medicine">Medicine</SelectItem>
                    <SelectItem value="Chicks">Chicks</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unit</Label>
                <Input id="edit-unit" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-mrp">MRP (₹)</Label>
                <Input id="edit-mrp" type="number" required value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Sale Price (₹)</Label>
                <Input id="edit-price" type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-purchaseCost">Purchase Cost (₹)</Label>
                <Input id="edit-purchaseCost" type="number" required value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: e.target.value})} className="rounded-xl" />
              </div>
            </div>

            {/* Variants Section */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} />
                  Variants
                </div>
              </h4>
              
              <div className="space-y-3">
                {formData.variants.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                    <div className="font-bold">{v.name} - ₹{v.price} <span className="text-[10px] text-slate-400 font-normal line-through ml-1">₹{v.mrp}</span></div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeVariant(i)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Vol / Size" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} className="h-9 text-xs rounded-lg" />
                <Input type="number" placeholder="MRP" value={newVariant.mrp} onChange={e => setNewVariant({...newVariant, mrp: e.target.value})} className="h-9 text-xs rounded-lg" />
                <div className="flex gap-1">
                  <Input type="number" placeholder="Price" value={newVariant.price} onChange={e => setNewVariant({...newVariant, price: e.target.value})} className="h-9 text-xs rounded-lg" />
                  <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-lg bg-[#122B21]" onClick={addVariant}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-stock">Stock Status</Label>
              <Select value={formData.inStock ? 'true' : 'false'} onValueChange={v => setFormData({...formData, inStock: v === 'true'})}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">In Stock</SelectItem>
                  <SelectItem value="false">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={14} />
                Inventory Management
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-stockQuantity">Current Stock</Label>
                  <Input id="edit-stockQuantity" type="number" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: e.target.value})} className="rounded-xl bg-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lowStockLimit">Low Stock Alert</Label>
                  <Input id="edit-lowStockLimit" type="number" value={formData.lowStockLimit} onChange={e => setFormData({...formData, lowStockLimit: e.target.value})} className="rounded-xl bg-white" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">Update Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500">Are you sure you want to delete this product? This action cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;
