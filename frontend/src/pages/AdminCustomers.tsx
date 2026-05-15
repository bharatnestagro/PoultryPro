import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Download, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  Eye,
  User,
  ShoppingBag,
  ShoppingCart,
  Clock,
  ExternalLink
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow, format } from 'date-fns';

const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerCart, setCustomerCart] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isCartItemsOpen, setIsCartItemsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      setCustomerCart(null);
      return;
    }

    // Fetch orders for this customer
    const qOrders = query(collection(db, 'orders'), where('userId', '==', selectedCustomer.id));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomerOrders(list);
    });

    // Fetch cart for this customer
    const unsubCart = onSnapshot(doc(db, 'carts', selectedCustomer.id), (docSnap) => {
      if (docSnap.exists()) {
        setCustomerCart(docSnap.data());
      } else {
        setCustomerCart(null);
      }
    });

    return () => {
      unsubOrders();
      unsubCart();
    };
  }, [selectedCustomer]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Customer deleted');
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await updateDoc(doc(db, 'users', selectedCustomer.id), editForm);
      toast.success('Customer details updated');
      setIsEditOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      toast.error('Failed to update customer');
    }
  };

  const openEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
    setIsEditOpen(true);
  };

  const openView = (customer: any) => {
    setSelectedCustomer(customer);
    setIsViewOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Shop Customers</h1>
          <p className="text-slate-500 font-medium">Manage and view all registered shop customers and their details.</p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
          <Download size={18} />
          <span>Export Customers</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <Input 
          placeholder="Search customers by name, email, or phone..." 
          className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CUSTOMER</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PHONE NUMBER</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EMAIL ADDRESS</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ADDRESS</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-slate-400">Loading customers...</TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-slate-400">No customers found</TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="group border-slate-50">
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <User size={20} />
                      </div>
                      <p className="font-bold text-slate-900">{customer.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium text-slate-600">{customer.phone || 'N/A'}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium text-slate-600">{customer.email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-500 max-w-[250px] truncate" title={customer.address}>
                      {customer.address || 'No address provided'}
                    </p>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                          <MoreHorizontal size={18} className="text-slate-400" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer" onClick={() => openView(customer)}>
                          <Eye size={16} />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer" onClick={() => openEdit(customer)}>
                          <Edit2 size={16} />
                          Edit Info
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-50" />
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <Trash2 size={16} />
                          Delete Customer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[800px] max-h-[90vh] overflow-y-auto no-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Customer Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-8 py-4">
              {/* Profile Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-50 p-8 rounded-[2rem]">
                <div className="flex items-center gap-6 border-r border-slate-200">
                  <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-100 shrink-0">
                    <User size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{selectedCustomer.name}</h3>
                    <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      VIP CUSTOMER
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                      <p className="text-sm font-medium text-slate-900">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</p>
                      <p className="text-sm font-medium text-slate-900">{selectedCustomer.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivery Address</p>
                      <p className="text-sm font-medium text-slate-900 leading-snug">{selectedCustomer.address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button 
                  onClick={() => setIsCartItemsOpen(true)}
                  className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 text-left hover:border-blue-200 transition-all group"
                >
                  <div className="bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <ShoppingCart size={20} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{customerCart?.items?.length || 0}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Abandoned Carts</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-600">
                    <span>VIEW ITEMS</span>
                    <ExternalLink size={10} />
                  </div>
                </button>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="bg-amber-50 w-10 h-10 rounded-xl flex items-center justify-center text-amber-600 mb-4">
                    <ShoppingBag size={20} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    ₹{(customerCart?.items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abandoned Amount</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                    <ShoppingBag size={20} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {customerOrders.reduce((sum, order) => sum + (order.items?.length || 0), 0)}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items Ordered</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="bg-rose-50 w-10 h-10 rounded-xl flex items-center justify-center text-rose-600 mb-4">
                    <Clock size={20} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {customerOrders.length > 0 
                      ? (() => {
                          const lastOrder = [...customerOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                          return formatDistanceToNow(new Date(lastOrder.createdAt));
                        })()
                      : selectedCustomer.createdAt 
                        ? formatDistanceToNow(new Date(selectedCustomer.createdAt))
                        : 'N/A'
                    }
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {customerOrders.length > 0 ? 'Last Order' : 'Days Since Joined'}
                  </p>
                </div>
              </div>

              {/* Order History Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">Recent Activity</h4>
                  <Badge variant="outline" className="text-xs font-bold text-slate-400">
                    {customerOrders.length} ORDERS TOTAL
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {customerOrders.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-medium">No order history found for this customer.</p>
                    </div>
                  ) : (
                    customerOrders.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3).map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                            <ShoppingBag size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Order #{order.id.substring(0, 8).toUpperCase()}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{format(new Date(order.createdAt), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">₹{order.totalAmount?.toLocaleString()}</p>
                          <Badge className={`text-[10px] font-bold border-none ${
                            order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-600' : 
                            order.status === 'Cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Items Dialog */}
      <Dialog open={isCartItemsOpen} onOpenChange={setIsCartItemsOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Abandoned Cart Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!customerCart?.items || customerCart.items.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Cart is empty.</p>
            ) : (
              <div className="space-y-3">
                {customerCart.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-12 h-12 rounded-xl object-cover bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 font-medium">Qty: {item.quantity} × ₹{item.price}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCartItemsOpen(false)} className="w-full rounded-xl bg-slate-900 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit Customer Info</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                value={editForm.name} 
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                value={editForm.phone} 
                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email"
                value={editForm.email} 
                onChange={e => setEditForm({...editForm, email: e.target.value})}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Full Address</Label>
              <Input 
                id="address" 
                value={editForm.address} 
                onChange={e => setEditForm({...editForm, address: e.target.value})}
                className="rounded-xl h-12"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;
