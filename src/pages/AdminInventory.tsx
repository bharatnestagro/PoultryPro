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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Package, ShoppingCart, IndianRupee, Info, AlertTriangle, ShoppingBag, FolderTree, Image as ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';

const AdminInventory: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const [isCatAddOpen, setIsCatAddOpen] = useState(false);
  const [isCatEditOpen, setIsCatEditOpen] = useState(false);
  const [isCatDeleteOpen, setIsCatDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<any>(null);
  const [catFormData, setCatFormData] = useState({
    name: '',
    imageUrl: '',
    description: ''
  });

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '', // Changed to empty by default
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
    const qItems = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shopItems'));

    const qCats = query(collection(db, 'shopCategories'), orderBy('name', 'asc'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shopCategories'));

    return () => {
      unsubItems();
      unsubCats();
    };
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

  const moveVariant = (index: number, direction: 'up' | 'down') => {
    const newVariants = [...formData.variants];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newVariants.length) return;
    
    [newVariants[index], newVariants[targetIndex]] = [newVariants[targetIndex], newVariants[index]];
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...formData.variants];
    const updatedVariant = { ...newVariants[index], [field]: value };
    
    // Recalculate discount if price or mrp changes
    if (field === 'price' || field === 'mrp') {
      const price = field === 'price' ? Number(value) : updatedVariant.price;
      const mrp = field === 'mrp' ? Number(value) : (updatedVariant.mrp || price);
      updatedVariant.price = price;
      updatedVariant.mrp = mrp;
      updatedVariant.discountPercentage = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
    }
    
    newVariants[index] = updatedVariant;
    setFormData({ ...formData, variants: newVariants });
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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fixedUrl = fixImageUrl(catFormData.imageUrl);
      await addDoc(collection(db, 'shopCategories'), {
        ...catFormData,
        imageUrl: fixedUrl,
        createdAt: new Date().toISOString()
      });
      toast.success('Category added successfully');
      setIsCatAddOpen(false);
      resetCatForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'shopCategories');
      toast.error('Failed to add category');
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCategory) return;
    try {
      const fixedUrl = fixImageUrl(catFormData.imageUrl);
      await updateDoc(doc(db, 'shopCategories', currentCategory.id), {
        ...catFormData,
        imageUrl: fixedUrl
      });
      toast.success('Category updated successfully');
      setIsCatEditOpen(false);
      resetCatForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'shopCategories');
      toast.error('Failed to update category');
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteDoc(doc(db, 'shopCategories', categoryToDelete));
      toast.success('Category deleted successfully');
      setIsCatDeleteOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'shopCategories');
      toast.error('Failed to delete category');
    }
  };

  const resetCatForm = () => {
    setCatFormData({
      name: '',
      imageUrl: '',
      description: ''
    });
    setCurrentCategory(null);
  };

  const openCatEdit = (cat: any) => {
    setCurrentCategory(cat);
    setCatFormData({
      name: cat.name,
      imageUrl: cat.imageUrl || '',
      description: cat.description || ''
    });
    setIsCatEditOpen(true);
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
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight italic uppercase">Marketplace Control</h1>
          <p className="text-slate-500 font-bold italic text-sm uppercase">Manage products, stock levels and categories</p>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-14 w-full max-w-md">
          <TabsTrigger value="inventory" className="flex-1 rounded-xl h-12 font-black italic uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 gap-2">
            <Package size={16} />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 rounded-xl h-12 font-black italic uppercase text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 gap-2">
            <FolderTree size={16} />
            Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-8 mt-8">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Manage Items</p>
              <h3 className="text-xl font-black italic text-slate-900 uppercase">Product Catalog</h3>
            </div>
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl h-12 px-8 flex items-center gap-2 font-black italic uppercase text-xs shadow-lg shadow-emerald-950/20" onClick={() => setIsAddOpen(true)}>
              <Plus size={20} />
              <span>Add Product</span>
            </Button>
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) resetForm(); }}>
              <DialogContent className="rounded-[2.5rem] sm:max-w-[500px] max-h-[90vh] overflow-y-auto border-none shadow-2xl p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase text-slate-900">Add New Product</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Product Name</Label>
                    <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic" placeholder="e.g. Premium Layer Feed" />
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Category</Label>
                        <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})} required>
                          <SelectTrigger className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-100">
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name} className="font-bold italic uppercase text-xs">{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Unit</Label>
                        <Input required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic" placeholder="e.g. 50kg bag" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">MRP (₹)</Label>
                        <Input type="number" required value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Sale Price (₹)</Label>
                        <Input type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Cost (₹)</Label>
                        <Input type="number" required value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" placeholder="0.00" />
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                        <ShoppingBag size={14} />
                        Variants Configuration
                      </h4>
                      
                      <div className="space-y-3">
                        {formData.variants.map((v, i) => (
                          <div key={i} className="flex flex-col gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm group">
                            <div className="flex items-center gap-2">
                               <div className="flex flex-col gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-slate-400 hover:text-slate-900 disabled:opacity-30" onClick={() => moveVariant(i, 'up')} disabled={i === 0}>
                                    <ChevronUp size={12} />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-slate-400 hover:text-slate-900 disabled:opacity-30" onClick={() => moveVariant(i, 'down')} disabled={i === formData.variants.length - 1}>
                                    <ChevronDown size={12} />
                                  </Button>
                               </div>
                               <div className="flex-1 grid grid-cols-3 gap-2">
                                  <Input 
                                    className="h-8 text-[10px] font-bold italic uppercase border-none bg-slate-50 rounded-lg" 
                                    value={v.name} 
                                    onChange={(e) => updateVariant(i, 'name', e.target.value)}
                                    placeholder="Name"
                                  />
                                  <Input 
                                    type="number"
                                    className="h-8 text-[10px] font-bold italic border-none bg-slate-50 rounded-lg" 
                                    value={v.mrp} 
                                    onChange={(e) => updateVariant(i, 'mrp', e.target.value)}
                                    placeholder="MRP"
                                  />
                                  <Input 
                                    type="number"
                                    className="h-8 text-[10px] font-bold italic border-none bg-slate-50 rounded-lg" 
                                    value={v.price} 
                                    onChange={(e) => updateVariant(i, 'price', e.target.value)}
                                    placeholder="Price"
                                  />
                               </div>
                               <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => removeVariant(i)}>
                                 <Trash2 size={14} />
                               </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Size" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} className="h-10 text-[10px] rounded-xl border-slate-200 font-bold italic" />
                        <Input type="number" placeholder="MRP" value={newVariant.mrp} onChange={e => setNewVariant({...newVariant, mrp: e.target.value})} className="h-10 text-[10px] rounded-xl border-slate-200 font-bold italic" />
                        <div className="flex gap-1">
                          <Input type="number" placeholder="Price" value={newVariant.price} onChange={e => setNewVariant({...newVariant, price: e.target.value})} className="h-10 text-[10px] rounded-xl border-slate-200 font-bold italic" />
                          <Button type="button" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-[#122B21]" onClick={addVariant}>
                            <Plus size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>

                  <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2">
                      <Package size={14} />
                      Stock Management
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Initial Stock</Label>
                        <Input type="number" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: e.target.value})} className="rounded-2xl h-12 bg-white border-slate-100 font-bold italic" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase italic">Threshold</Label>
                        <Input type="number" value={formData.lowStockLimit} onChange={e => setFormData({...formData, lowStockLimit: e.target.value})} className="rounded-2xl h-12 bg-white border-slate-100 font-bold italic" placeholder="10" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Description</Label>
                    <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic" placeholder="Brief product details" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black text-slate-400 uppercase italic">Product Images (URLs)</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 rounded-xl text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50"
                        onClick={() => setFormData({...formData, imageUrls: [...formData.imageUrls, '']})}
                        disabled={formData.imageUrls.length >= 4}
                      >
                        <Plus size={14} className="mr-1" /> Add URL
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {formData.imageUrls.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <Input 
                            value={url} 
                            onChange={e => {
                              const newUrls = [...formData.imageUrls];
                              newUrls[index] = e.target.value;
                              setFormData({...formData, imageUrls: newUrls});
                            }} 
                            className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-xs" 
                            placeholder={`Image URL ${index + 1}`} 
                          />
                          {formData.imageUrls.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-2xl h-12 w-12 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => {
                                const newUrls = formData.imageUrls.filter((_, i) => i !== index);
                                setFormData({...formData, imageUrls: newUrls});
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-[1.5rem] py-8 font-black italic uppercase text-sm shadow-xl shadow-emerald-950/20">Create Product</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package size={20} />
              </div>
              <div>
                <p className="text-2xl font-black italic text-slate-900">{items.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Total Products</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-2xl font-black italic text-slate-900">{items.filter(i => i.stockQuantity <= i.lowStockLimit && i.inStock).length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Low Stock</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-red-50 text-red-600 flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <div>
                <p className="text-2xl font-black italic text-slate-900">{items.filter(i => !i.inStock || i.stockQuantity <= 0).length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Out of Stock</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <IndianRupee size={20} />
              </div>
              <div>
                <p className="text-2xl font-black italic text-slate-900">
                  ₹{(items.reduce((sum, i) => sum + (Number(i.price) * (Number(i.stockQuantity) || 0)), 0) / 1000).toFixed(1)}k
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Stock Value</p>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Product Info</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Category</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Pricing</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Storage</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                            {item.imageUrls && item.imageUrls.length > 0 ? (
                              <img src={item.imageUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package size={24} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-black italic uppercase text-slate-900 text-sm tracking-tight">{item.name}</p>
                            <p className="text-[10px] font-bold italic text-slate-400 uppercase tracking-tight line-clamp-1 max-w-[150px]">{item.description || 'No description'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <Badge variant="outline" className="text-[9px] font-black italic uppercase tracking-widest text-indigo-600 border-indigo-100 bg-indigo-50/30 px-3 py-1">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <div className="flex items-center text-slate-900 font-black italic">
                            <span className="text-xs">₹</span>
                            <span className="text-base">{item.price.toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase italic">MRP: ₹{item.mrp || item.price}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${ (item.stockQuantity || 0) <= (item.lowStockLimit || 10) ? 'bg-red-500 animate-pulse' : 'bg-emerald-500' }`} />
                             <span className="font-black italic text-slate-900">{item.stockQuantity || 0}</span>
                             <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-tighter">{item.unit}</span>
                          </div>
                          {(item.stockQuantity || 0) <= (item.lowStockLimit || 10) && (
                            <p className="text-[9px] font-black text-red-500 uppercase italic">Refill Needed</p>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black italic uppercase inline-flex border ${
                          item.inStock 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : 'bg-red-50 text-red-600 border-red-100'
                        }`}>
                          {item.inStock ? 'Available' : 'Out of Stock'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm" onClick={() => openEdit(item)}>
                            <Edit2 size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => { setItemToDelete(item.id); setIsDeleteOpen(true); }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-8 mt-8">
           <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Shop Navigation</p>
              <h3 className="text-xl font-black italic text-slate-900 uppercase">Product Categories</h3>
            </div>
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl h-12 px-8 flex items-center gap-2 font-black italic uppercase text-xs shadow-lg shadow-emerald-950/20" onClick={() => setIsCatAddOpen(true)}>
              <Plus size={20} />
              <span>Add Category</span>
            </Button>
            <Dialog open={isCatAddOpen} onOpenChange={(open) => { setIsCatAddOpen(open); if(!open) resetCatForm(); }}>
              <DialogContent className="rounded-[2.5rem] sm:max-w-[400px] border-none shadow-2xl p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black italic uppercase text-slate-900">Add Category</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddCategory} className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Category Name</Label>
                    <Input required value={catFormData.name} onChange={e => setCatFormData({...catFormData, name: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic uppercase text-xs" placeholder="e.g. FEEDING EQUIPMENT" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Image URL</Label>
                    <Input value={catFormData.imageUrl} onChange={e => setCatFormData({...catFormData, imageUrl: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-xs" placeholder="Direct link to icon/image" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Description</Label>
                    <Input value={catFormData.description} onChange={e => setCatFormData({...catFormData, description: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic" placeholder="Brief info about this category" />
                  </div>
                  <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-[1.5rem] py-8 font-black italic uppercase text-sm shadow-xl shadow-emerald-950/20">Save Category</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(cat => (
              <Card key={cat.id} className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                   {cat.imageUrl ? (
                     <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <FolderTree size={40} />
                     </div>
                   )}
                   <div className="absolute top-4 right-4 flex gap-2">
                      <Button variant="secondary" size="icon" className="h-10 w-10 rounded-2xl bg-white/90 backdrop-blur-sm border-none shadow-lg text-slate-600 hover:bg-slate-900 hover:text-white transition-all" onClick={() => openCatEdit(cat)}>
                         <Edit2 size={16} />
                      </Button>
                      <Button variant="secondary" size="icon" className="h-10 w-10 rounded-2xl bg-white/90 backdrop-blur-sm border-none shadow-lg text-red-500 hover:bg-red-600 hover:text-white transition-all" onClick={() => { setCategoryToDelete(cat.id); setIsCatDeleteOpen(true); }}>
                         <Trash2 size={16} />
                      </Button>
                   </div>
                </div>
                <CardContent className="p-8">
                   <h3 className="text-xl font-black italic uppercase text-slate-900 mb-2">{cat.name}</h3>
                   <p className="text-[10px] font-bold italic text-slate-400 uppercase tracking-widest line-clamp-2">{cat.description || 'No description provided for this category.'}</p>
                   <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Associated Items</p>
                        <p className="text-sm font-black italic text-slate-900 uppercase">{items.filter(i => i.category === cat.name).length} Products</p>
                      </div>
                      <Badge className="bg-slate-100 text-slate-500 border-none font-bold italic uppercase text-[9px] px-3">Active</Badge>
                   </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Edit Dialog */}
      <Dialog open={isCatEditOpen} onOpenChange={(open) => { setIsCatEditOpen(open); if(!open) resetCatForm(); }}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[400px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase text-slate-900">Edit Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase italic">Category Name</Label>
              <Input required value={catFormData.name} onChange={e => setCatFormData({...catFormData, name: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic uppercase text-xs" placeholder="e.g. FEEDING EQUIPMENT" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase italic">Image URL</Label>
              <Input value={catFormData.imageUrl} onChange={e => setCatFormData({...catFormData, imageUrl: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-xs" placeholder="Direct link to icon/image" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase italic">Description</Label>
              <Input value={catFormData.description} onChange={e => setCatFormData({...catFormData, description: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic" placeholder="Brief info about this category" />
            </div>
            <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-[1.5rem] py-8 font-black italic uppercase text-sm shadow-xl shadow-emerald-950/20">Update Category</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Delete Dialog */}
      <Dialog open={isCatDeleteOpen} onOpenChange={setIsCatDeleteOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[400px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase text-slate-900 text-red-600">Delete Category</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="font-bold italic text-slate-500 uppercase text-xs leading-relaxed">Are you sure you want to delete this category? All products using this category will remain, but the category association might become invalid.</p>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsCatDeleteOpen(false)} className="flex-1 rounded-2xl h-12 font-black italic uppercase text-xs border-slate-100 hover:bg-slate-50">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCategory} className="flex-1 rounded-2xl h-12 font-black italic uppercase text-xs bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit Dialog */}
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
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
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
                <Label htmlFor="edit-mrp" className="text-[10px] font-black text-slate-400 uppercase italic">MRP (₹)</Label>
                <Input id="edit-mrp" type="number" required value={formData.mrp} onChange={e => setFormData({...formData, mrp: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price" className="text-[10px] font-black text-slate-400 uppercase italic">Sale Price (₹)</Label>
                <Input id="edit-price" type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-purchaseCost" className="text-[10px] font-black text-slate-400 uppercase italic">Cost (₹)</Label>
                <Input id="edit-purchaseCost" type="number" required value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: e.target.value})} className="rounded-2xl h-12 border-slate-100 bg-slate-50 font-bold italic text-center" />
              </div>
            </div>

            {/* Image Preview Section */}
            <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
              {formData.imageUrls.filter(url => url).map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 group">
                  <img src={fixImageUrl(url)} alt={`Preview ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={14} className="text-white cursor-pointer" onClick={() => {
                       const newUrls = formData.imageUrls.filter((_, idx) => idx !== i);
                       setFormData({...formData, imageUrls: newUrls.length ? newUrls : ['']});
                    }} />
                  </div>
                </div>
              ))}
              {formData.imageUrls.length < 4 && (
                <button 
                  type="button"
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  onClick={() => setFormData({...formData, imageUrls: [...formData.imageUrls, '']})}
                >
                  <Plus size={16} />
                  <span className="text-[8px] font-black uppercase mt-1">Add</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase italic">Image URLs</Label>
              {formData.imageUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input 
                    value={url} 
                    onChange={e => {
                      const newUrls = [...formData.imageUrls];
                      newUrls[index] = e.target.value;
                      setFormData({...formData, imageUrls: newUrls});
                    }} 
                    className="rounded-2xl h-10 border-slate-100 bg-slate-50 font-bold italic text-[10px]" 
                    placeholder={`URL ${index + 1}`} 
                  />
                  {formData.imageUrls.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        const newUrls = formData.imageUrls.filter((_, i) => i !== index);
                        setFormData({...formData, imageUrls: newUrls});
                      }}
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Variants Section */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-4 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} />
                  Variants & Reordering
                </div>
              </h4>
              
              <div className="space-y-3">
                {formData.variants.map((v, i) => (
                  <div key={i} className="flex flex-col gap-2 bg-white p-2 rounded-xl border border-slate-200 text-xs group">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <Button type="button" variant="ghost" size="icon" className="h-4 w-4 p-0 text-slate-400 hover:text-slate-900 disabled:opacity-30" onClick={() => moveVariant(i, 'up')} disabled={i === 0}>
                          <ChevronUp size={12} />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-4 w-4 p-0 text-slate-400 hover:text-slate-900 disabled:opacity-30" onClick={() => moveVariant(i, 'down')} disabled={i === formData.variants.length - 1}>
                          <ChevronDown size={12} />
                        </Button>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-1">
                        <Input 
                          className="h-7 text-[10px] font-bold border-none bg-slate-50" 
                          value={v.name} 
                          onChange={(e) => updateVariant(i, 'name', e.target.value)}
                        />
                        <Input 
                          type="number"
                          className="h-7 text-[10px] font-bold border-none bg-slate-50" 
                          value={v.mrp} 
                          onChange={(e) => updateVariant(i, 'mrp', e.target.value)}
                        />
                        <Input 
                          type="number"
                          className="h-7 text-[10px] font-bold border-none bg-slate-50" 
                          value={v.price} 
                          onChange={(e) => updateVariant(i, 'price', e.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeVariant(i)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
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
