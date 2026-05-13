import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Download, 
  Upload, 
  FileUp, 
  ShoppingCart,
  ChevronRight,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const ManagerShop: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [adminItems, setAdminItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: '',
    mrp: 0,
    price: 0,
    purchaseCost: 0,
    description: '',
    imageUrls: ['', '', ''],
    inStock: true,
    variants: [] as any[],
    isHeavy: false,
    isLiveStock: false,
    isByRoad: false
  });

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch Manager's Items
    const q = query(collection(db, 'shopItems'), where('managerId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shopItems');
    });

    // Fetch Categories
    const qCats = query(collection(db, 'shopCategories'));
    onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const fetchAdminItems = async () => {
    try {
      const q = query(collection(db, 'shopItems'), where('managerId', '==', null));
      const snap = await getDocs(q);
      const adminProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter out items that manager already has
      const existingNames = new Set(items.map(i => (i as any).name.toLowerCase()));
      setAdminItems(adminProds.filter(ap => !existingNames.has((ap as any).name.toLowerCase())));
      setIsImportModalOpen(true);
    } catch (e) {
      toast.error('Failed to fetch admin products');
    }
  };

  const handleImportSelected = async (selectedProds: any[]) => {
    if (!profile?.uid || selectedProds.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      selectedProds.forEach(prod => {
        const newRef = doc(collection(db, 'shopItems'));
        const { id, cost, purchaseCost, ...rest } = prod; // Exclude ID and Admin-only Costs
        batch.set(newRef, {
          ...rest,
          managerId: profile.uid,
          purchaseCost: 0, // Manager will set their own cost
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          importedFromAdmin: true,
          originalAdminProductId: id
        });
      });
      await batch.commit();
      toast.success(`${selectedProds.length} products imported successfully`);
      setIsImportModalOpen(false);
    } catch (e) {
      toast.error('Import failed');
    }
  };

  const handleSubmit = async () => {
    if (!profile?.uid) return;
    try {
      const data = {
        ...formData,
        managerId: profile.uid,
        updatedAt: Timestamp.now()
      };

      if (isEditing && selectedItem) {
        await setDoc(doc(db, 'shopItems', selectedItem.id), data, { merge: true });
        toast.success('Product updated');
      } else {
        await addDoc(collection(db, 'shopItems'), {
          ...data,
          createdAt: Timestamp.now()
        });
        toast.success('Product added');
      }
      setIsAddModalOpen(false);
      resetForm();
    } catch (e) {
      toast.error('Failed to save product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: '',
      mrp: 0,
      price: 0,
      purchaseCost: 0,
      description: '',
      imageUrls: ['', '', ''],
      inStock: true,
      variants: [],
      isHeavy: false,
      isLiveStock: false,
      isByRoad: false
    });
    setIsEditing(false);
    setSelectedItem(null);
  };

  const handleEdit = (item: any) => {
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      mrp: item.mrp || 0,
      price: item.price || 0,
      purchaseCost: item.purchaseCost || 0,
      description: item.description || '',
      imageUrls: item.imageUrls || ['', '', ''],
      inStock: item.inStock !== false,
      variants: item.variants || [],
      isHeavy: item.isHeavy || false,
      isLiveStock: item.isLiveStock || false,
      isByRoad: item.isByRoad || false
    });
    setSelectedItem(item);
    setIsEditing(true);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'shopItems', id));
      toast.success('Product deleted');
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const fixImageUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/(.+?)(\/|$)/) || url.match(/id=(.+?)(&|$)/);
      if (match) return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w1000`;
    }
    return url;
  };

  const downloadFormat = () => {
    const ws = XLSX.utils.json_to_sheet([{
      Name: 'Example Feed',
      Category: categories[0]?.name || 'Feed',
      Unit: 'KG',
      MRP: 100,
      Price: 80,
      Description: 'High quality feed',
      Image1: '',
      IsHeavy: 'No',
      IsLiveStock: 'No'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manager_Product_Format");
    XLSX.writeFile(wb, "Manager_Product_Format.xlsx");
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const batch = writeBatch(db);
        data.forEach((row: any) => {
          const newRef = doc(collection(db, 'shopItems'));
          batch.set(newRef, {
            name: row.Name,
            category: row.Category,
            unit: row.Unit,
            mrp: Number(row.MRP) || 0,
            price: Number(row.Price) || 0,
            description: row.Description || '',
            imageUrls: [row.Image1 || '', '', ''],
            isHeavy: String(row.IsHeavy).toLowerCase() === 'yes',
            isLiveStock: String(row.IsLiveStock).toLowerCase() === 'yes',
            managerId: profile.uid,
            inStock: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        });

        await batch.commit();
        toast.success(`Imported ${data.length} products`);
      } catch (err) {
        toast.error('Excel Import Failed: Check format');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-slate-500 font-medium">Manage your personal shop inventory and imports</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={fetchAdminItems}
            className="rounded-2xl h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Import from Admin
          </Button>
          <Button 
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="rounded-2xl h-12 px-6 bg-[#122B21] hover:bg-[#1a3d2e] text-white font-bold shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Product
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search items by name or category..." 
            className="pl-12 h-12 bg-slate-50 border-none rounded-2xl font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="ghost" className="rounded-xl h-12 px-4 text-slate-500 hover:bg-slate-50" onClick={downloadFormat}>
            <Download className="mr-2 h-4 w-4" />
            Format
          </Button>
          <div className="relative">
            <input 
              type="file" 
              className="hidden" 
              id="bulk-import-mgr" 
              accept=".xlsx,.xls" 
              onChange={handleBulkImport} 
            />
            <Label 
              htmlFor="bulk-import-mgr" 
              className="flex items-center gap-2 px-6 h-12 bg-white border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 cursor-pointer text-slate-600"
            >
              <FileUp size={18} />
              Bulk Import
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="h-64 bg-slate-100 rounded-[2.5rem] animate-pulse" />)
        ) : items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
          <div className="lg:col-span-3 xl:col-span-4 flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <Package size={64} className="text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No products in your catalog</p>
            <Button variant="link" className="text-indigo-600 mt-2 font-bold" onClick={fetchAdminItems}>Start by importing from Admin</Button>
          </div>
        ) : items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
          <Card key={item.id} className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden group">
            <div className="relative aspect-square">
              <img 
                src={fixImageUrl(item.imageUrls?.[0]) || 'https://placehold.co/400x400?text=Product'} 
                alt={item.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button 
                  size="icon" 
                  className="bg-white/90 backdrop-blur-sm text-slate-900 rounded-xl hover:bg-white transition-all shadow-xl"
                  onClick={() => handleEdit(item)}
                >
                  <Edit2 size={16} />
                </Button>
                <Button 
                  size="icon" 
                  className="bg-white/90 backdrop-blur-sm text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-xl"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="absolute top-4 left-4 flex gap-1">
                {item.isHeavy && (
                  <Badge className="bg-amber-500 text-white border-none font-bold text-[8px] uppercase">Heavy</Badge>
                )}
                {item.isLiveStock && (
                  <Badge className="bg-rose-500 text-white border-none font-bold text-[8px] uppercase">Live Stock</Badge>
                )}
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                </div>
                <Badge variant={item.inStock ? 'outline' : 'secondary'} className={item.inStock ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}>
                  {item.inStock ? 'In Stock' : 'Out of Stock'}
                </Badge>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 line-through">MRP: ₹{item.mrp}</p>
                  <p className="text-xl font-black text-slate-900 leading-none mt-1">₹{item.price}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">per {item.unit}</p>
                </div>
                {item.importedFromAdmin && (
                  <Badge className="bg-indigo-50 text-indigo-600 border-none font-bold text-[8px] uppercase">Admin Import</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => !open && setIsAddModalOpen(false)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-slate-50 border-b">
            <DialogTitle className="text-2xl font-black text-slate-900">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Product Name</Label>
                <Input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100">
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">MRP (₹)</Label>
                <Input 
                  type="number"
                  value={formData.mrp}
                  onChange={e => setFormData({...formData, mrp: Number(e.target.value)})}
                  className="rounded-xl border-slate-100 bg-slate-50 h-12 font-black"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Sale Price (₹)</Label>
                <Input 
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  className="rounded-xl border-slate-100 bg-slate-50 h-12 font-black text-indigo-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Unit</Label>
                <Input 
                  value={formData.unit}
                  placeholder="e.g. KG, Liter"
                  onChange={e => setFormData({...formData, unit: e.target.value})}
                  className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="mgr-isHeavy" 
                  checked={formData.isHeavy} 
                  onChange={e => setFormData({...formData, isHeavy: e.target.checked})}
                />
                <Label htmlFor="mgr-isHeavy" className="text-[10px] font-bold uppercase cursor-pointer">Heavy Item</Label>
              </div>
              <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="mgr-isLiveStock" 
                  checked={formData.isLiveStock} 
                  onChange={e => setFormData({...formData, isLiveStock: e.target.checked})}
                />
                <Label htmlFor="mgr-isLiveStock" className="text-[10px] font-bold uppercase cursor-pointer">Live Stock</Label>
              </div>
              <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="mgr-isByRoad" 
                  checked={formData.isByRoad} 
                  onChange={e => setFormData({...formData, isByRoad: e.target.checked})}
                />
                <Label htmlFor="mgr-isByRoad" className="text-[10px] font-bold uppercase cursor-pointer">By Road</Label>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Inventory & Cost</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Your Purchase Cost (₹)</Label>
                  <Input 
                    type="number"
                    value={formData.purchaseCost}
                    onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})}
                    className="rounded-xl border-slate-100 bg-white h-12 font-black text-emerald-600"
                    placeholder="Enter your cost for calculations"
                  />
                  <p className="text-[10px] font-bold text-slate-400 italic">This is your internal buy price, not visible to farmers.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400 ml-1">Image URL 1 (Main)</Label>
              <Input 
                value={formData.imageUrls[0]}
                onChange={e => {
                  const urls = [...formData.imageUrls];
                  urls[0] = e.target.value;
                  setFormData({...formData, imageUrls: urls});
                }}
                className="rounded-xl border-slate-100 bg-slate-50 h-12"
                placeholder="Google Drive link allowed"
              />
            </div>
          </div>
          <div className="p-8 border-t bg-slate-50 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="rounded-xl h-12 px-6">Cancel</Button>
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-8 font-bold">
              {isEditing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] bg-white border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-8 bg-indigo-900 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <ShoppingCart className="text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black italic uppercase">Import from Admin Catalog</DialogTitle>
                <p className="text-indigo-200 text-xs font-medium">Select the products you want to display to your farmers</p>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8">
             <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
                {adminItems.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-500 opacity-20" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">All admin products already in your catalog</p>
                  </div>
                ) : (
                  adminItems.map(prod => (
                    <div key={prod.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                       <div className="flex items-center gap-4">
                          <img src={fixImageUrl(prod.imageUrls?.[0])} alt={prod.name} className="w-12 h-12 rounded-xl object-cover border" />
                          <div>
                             <p className="text-[10px] font-bold text-indigo-400 uppercase leading-none mb-1">{prod.category}</p>
                             <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{prod.name}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Price for Farmers</p>
                             <p className="text-base font-black text-slate-900">₹{prod.price}</p>
                          </div>
                          <Button 
                            onClick={() => handleImportSelected([prod])}
                            className="rounded-xl h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                          >
                            Import
                          </Button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
          <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
             <div className="flex items-center gap-2 text-slate-400 italic text-[10px]">
                <Info size={14} />
                <span>Managerial copies will hide admin cost.</span>
             </div>
             <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} className="rounded-xl h-10 px-6 font-bold">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerShop;
