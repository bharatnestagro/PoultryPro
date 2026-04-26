import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDocs, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  MessageSquare,
  Plus,
  ShoppingCart,
  User,
  PlusCircle,
  Package
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminOrders: React.FC = () => {
  const { user: currentUser, isAdmin, isManager } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [managerCommissionConfig, setManagerCommissionConfig] = useState<any>(null);
  
  // Create Order State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    userId: '',
    selectedProducts: [] as any[]
  });

  const [updateForm, setUpdateForm] = useState({
    status: '',
    statusUpdate: '',
    paymentStatus: ''
  });

  const [deleteReason, setDeleteReason] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(list);
      setLoading(false);
    });

    // Fetch users for names
  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        userMap[d.id] = { 
          id: d.id, 
          name: data.name || 'Anonymous', 
          email: data.email || '',
          address: data.address || '',
          assignedManagerId: data.assignedManagerId || '',
          role: data.role || 'farmer'
        };
      });
      setUsers(userMap);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  };

    // Fetch products for order creation
    const fetchProducts = async () => {
      const snap = await getDocs(query(collection(db, 'shopItems'), orderBy('name', 'asc')));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    fetchUsers();
    fetchProducts();

    const fetchManagerCommission = async () => {
      if (isManager && !isAdmin && currentUser?.uid) {
        const commDoc = await getDoc(doc(db, 'managerCommissions', currentUser.uid));
        if (commDoc.exists()) {
          setManagerCommissionConfig(commDoc.data().productCommissions || {});
        }
      }
    };
    fetchManagerCommission();

    return () => unsubscribe();
  }, []);

  const openDeletePrompt = (order: any) => {
    setOrderToDelete(order);
    setDeleteReason('');
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deletion');
      return;
    }

    try {
      // Archive to deletedOrders
      await addDoc(collection(db, 'deletedOrders'), {
        orderId: orderToDelete.id,
        userId: orderToDelete.userId,
        customerName: users[orderToDelete.userId]?.name || 'Unknown',
        customerEmail: users[orderToDelete.userId]?.email || 'N/A',
        totalAmount: orderToDelete.totalAmount,
        items: orderToDelete.items || [],
        originalDate: orderToDelete.date,
        deletedAt: new Date().toISOString(),
        deletionReason: deleteReason,
      });

      // Delete from orders
      await deleteDoc(doc(db, 'orders', orderToDelete.id));
      
      toast.success('Order archived to Deleted Orders');
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error('Deletion error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'deletedOrders');
      toast.error('Failed to delete order');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), {
        status: updateForm.status,
        statusUpdate: updateForm.statusUpdate,
        paymentStatus: updateForm.paymentStatus
      });

      // If marked as Delivered, create a Shop Transaction record
      if (updateForm.status === 'Delivered' && editingOrder.status !== 'Delivered') {
        const userName = users[editingOrder.userId]?.name || 'Farmer';
        await addDoc(collection(db, 'transactions'), {
          userId: editingOrder.userId,
          farmerName: userName,
          type: 'Income',
          category: 'Shop Sale',
          amount: editingOrder.totalAmount || 0,
          description: `Shop Order #${editingOrder.id.substring(0, 8).toUpperCase()}`,
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          source: 'shop',
          orderId: editingOrder.id
        });
      }

      toast.success('Order status updated');
      setEditingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      toast.error('Failed to update status');
    }
  };

  const handleCreateOrder = async (mode: 'order' | 'cart') => {
    if (!createForm.userId || createForm.selectedProducts.length === 0) {
      toast.error('Please select a customer and at least one product');
      return;
    }

    try {
      const totalAmount = createForm.selectedProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const customer = users[createForm.userId];

      if (mode === 'cart') {
        const cartRef = doc(db, 'carts', createForm.userId);
        const cartSnap = await getDoc(cartRef);
        let items = [];
        if (cartSnap.exists()) {
          items = cartSnap.data().items || [];
        }
        
        // Add new items to existing cart
        const newItems = [...items, ...createForm.selectedProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          quantity: p.quantity,
          image: p.imageUrl || ''
        }))];

        await setDoc(cartRef, {
          userId: createForm.userId,
          items: newItems,
          updatedAt: new Date().toISOString()
        });
        toast.success(`Items added to ${customer.name}'s cart`);
      } else {
        await addDoc(collection(db, 'orders'), {
          userId: createForm.userId,
          items: createForm.selectedProducts.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            quantity: p.quantity,
            image: p.imageUrl || ''
          })),
          totalAmount,
          status: 'Pending',
          paymentStatus: 'Pending',
          paymentMethod: 'Cash (Admin Created)',
          deliveryAddress: customer.address || 'Standard Farm Delivery',
          date: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        toast.success(`Order placed successfully for ${customer.name}`);
      }

      setIsCreateOpen(false);
      setCreateForm({ userId: '', selectedProducts: [] });
    } catch (error) {
      console.error('Order creation error:', error);
      toast.error('Failed to process request. Check if the customer has an active account.');
    }
  };

  const addProductToSelection = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (createForm.selectedProducts.some(p => p.id === productId)) {
      toast.error('Product already added');
      return;
    }

    setCreateForm({
      ...createForm,
      selectedProducts: [...createForm.selectedProducts, { ...product, quantity: 1 }]
    });
  };

  const updateSelectedQuantity = (id: string, delta: number) => {
    setCreateForm({
      ...createForm,
      selectedProducts: createForm.selectedProducts.map(p => 
        p.id === id ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p
      )
    });
  };

  const openEdit = (order: any) => {
    setEditingOrder(order);
    setUpdateForm({
      status: order.status || 'Pending',
      statusUpdate: order.statusUpdate || '',
      paymentStatus: order.paymentStatus || 'Pending'
    });
  };

  const filteredOrders = orders.filter(o => {
    const userProfile = users[o.userId];
    const farmerName = userProfile?.name || '';
    const itemNames = o.items ? o.items.map((i: any) => i.name).join(' ') : o.productName || '';
    
    // Search filter
    const matchesSearch = (
      farmerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemNames.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Status filter
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;

    // Manager/Admin Access filter
    let hasAccess = true;
    if (isManager && !isAdmin) {
      // Manager can only see orders from farmers assigned to them
      hasAccess = userProfile?.managerId === currentUser?.uid || userProfile?.assignedManagerId === currentUser?.uid;
    }

    return matchesSearch && matchesStatus && hasAccess;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'Pending').length,
    delivered: orders.filter(o => o.status === 'Delivered').length,
    revenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Orders & Sales</h1>
          <p className="text-slate-500 font-medium">Manage customer orders, track fulfillment, and monitor sales performance.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 flex items-center gap-2">
              <PlusCircle size={20} />
              <span>Create New Order</span>
            </Button>
          } />
          <DialogContent className="rounded-[2rem] sm:max-w-[550px] max-h-[90vh] overflow-y-auto no-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Create Order for Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  Select Customer
                </Label>
                <Select value={createForm.userId} onValueChange={v => setCreateForm({...createForm, userId: v})}>
                  <SelectTrigger className="rounded-xl h-12 bg-white">
                    <SelectValue>
                      {createForm.userId ? `${users[createForm.userId]?.name} (${users[createForm.userId]?.email})` : "Choose a farmer..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(users)
                      .filter((u: any) => {
                        if (isAdmin) return true;
                        if (isManager) return u.managerId === currentUser?.uid || u.assignedManagerId === currentUser?.uid;
                        return false;
                      })
                      .map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col">
                          <span className="font-bold">{u.name}</span>
                          <span className="text-[10px] text-slate-400">{u.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400" />
                  Add Products
                </Label>
                <Select value="" onValueChange={(id: string) => addProductToSelection(id)}>
                  <SelectTrigger className="rounded-xl h-12 bg-white">
                    <SelectValue placeholder="Add product to list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} - ₹{p.price}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {createForm.selectedProducts.length > 0 && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Selected Items</p>
                  <div className="space-y-2">
                    {createForm.selectedProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />}
                          <div>
                            <p className="text-xs font-bold text-slate-900">{p.name}</p>
                            <p className="text-[10px] text-slate-500">₹{p.price} / {p.unit}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-6 h-6 rounded-md hover:bg-white"
                              onClick={() => updateSelectedQuantity(p.id, -1)}
                            >
                              -
                            </Button>
                            <span className="text-xs font-bold w-4 text-center">{p.quantity}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-6 h-6 rounded-md hover:bg-white"
                              onClick={() => updateSelectedQuantity(p.id, 1)}
                            >
                              +
                            </Button>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-500 h-8 w-8"
                            onClick={() => setCreateForm({...createForm, selectedProducts: createForm.selectedProducts.filter(x => x.id !== p.id)})}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center px-1">
                    <p className="text-sm font-bold text-slate-900">Total Amount</p>
                    <p className="text-lg font-bold text-emerald-600">
                      ₹{createForm.selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0).toLocaleString()}
                    </p>
                  </div>
                  {isManager && !isAdmin && managerCommissionConfig && (
                    <div className="pt-2 mt-1 border-t border-dashed border-slate-200 flex justify-between items-center px-1">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Your Commission</p>
                      <p className="text-sm font-bold text-indigo-600">
                        ₹{createForm.selectedProducts.reduce((sum, p) => {
                          const comm = managerCommissionConfig[p.id];
                          if (!comm) return sum;
                          if (typeof comm === 'number') return sum + (comm * p.quantity);
                          if (comm.type === 'percentage') return sum + (p.price * p.quantity * comm.value / 100);
                          return sum + (comm.value * p.quantity);
                        }, 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => handleCreateOrder('cart')}
                  variant="outline"
                  className="rounded-xl py-6 border-slate-200 flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  <ShoppingCart size={18} />
                  <span>Add to Customer Cart</span>
                </Button>
                <Button 
                  onClick={() => handleCreateOrder('order')}
                  className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  <span>Place Order</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL ORDERS</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENDING</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.delivered}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DELIVERED</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">₹{stats.revenue.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL REVENUE</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Search by ID, product, or customer..." 
            className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 gap-3 border border-slate-100 h-14">
            <Filter size={18} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status Filter</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-none shadow-none h-8 w-[140px] font-bold text-slate-900 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Received">Received</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ORDER ID</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CUSTOMER</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PRODUCT</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DELIVERY & PAYMENT</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DATE</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">Loading orders...</TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">No orders found</TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="group border-slate-50">
                  <TableCell className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-900">#{order.id?.substring(0, 8)?.toUpperCase() || 'N/A'}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold text-slate-900">{users[order.userId]?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400">{users[order.userId]?.email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold text-slate-900">
                      {order.items ? `${order.items.length} Items` : order.productName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {order.items 
                        ? order.items.map((i: any) => i.name).join(', ').substring(0, 20) + (order.items.map((i: any) => i.name).join(', ').length > 20 ? '...' : '')
                        : `${order.quantity} ${order.unit}`
                      }
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold text-slate-900">₹{order.totalAmount?.toLocaleString() || 0}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col max-w-[180px]">
                      <span className="text-[10px] text-slate-600 line-clamp-2" title={typeof order.deliveryAddress === 'object' ? `${order.deliveryAddress.address}, ${order.deliveryAddress.locality}` : order.deliveryAddress}>
                        {typeof order.deliveryAddress === 'object' 
                          ? `${order.deliveryAddress.farmName || order.deliveryAddress.contactName}: ${order.deliveryAddress.address}, ${order.deliveryAddress.locality}, ${order.deliveryAddress.district}` 
                          : (order.deliveryAddress || 'N/A')}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{order.paymentMethod}</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${
                          order.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {order.paymentStatus || 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-none rounded-lg text-[10px] font-bold px-2 py-1 ${
                      order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                      order.status === 'Received' ? 'bg-indigo-100 text-indigo-700' :
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                      order.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {order.status?.toUpperCase() || 'PENDING'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-500 font-medium">
                      {order.date ? format(new Date(order.date), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" />}>
                        <MoreHorizontal size={18} className="text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer" onClick={() => openEdit(order)}>
                          <Edit2 size={16} />
                          Update Status
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() => openDeletePrompt(order)}
                        >
                          <Trash2 size={16} />
                          Delete Order
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

      {/* Update Status Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="rounded-3xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Update Order Status</DialogTitle>
          </DialogHeader>
          
          {editingOrder && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Order Details</p>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{users[editingOrder.userId]?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-500">{users[editingOrder.userId]?.email}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-none h-5 text-[10px]">
                    ₹{editingOrder.totalAmount?.toLocaleString()}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Items</p>
                  <div className="max-h-[100px] overflow-y-auto pr-2 space-y-1">
                    {editingOrder.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span className="text-slate-600 truncate mr-2">{item.name} x{item.quantity}</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">₹{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleUpdateStatus} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Order Status</Label>
                <Select value={updateForm.status} onValueChange={v => setUpdateForm({...updateForm, status: v})}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={updateForm.paymentStatus} onValueChange={v => setUpdateForm({...updateForm, paymentStatus: v})}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare size={14} />
                Status Update Message
              </Label>
              <Input 
                value={updateForm.statusUpdate} 
                onChange={e => setUpdateForm({...updateForm, statusUpdate: e.target.value})}
                placeholder="e.g. Order is being packed, Out for delivery..."
                className="rounded-xl h-12"
              />
              <p className="text-[10px] text-slate-400">This message will be visible to the farmer.</p>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6">
                Update Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Deletion Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">Archive & Delete Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {orderToDelete && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Deleting Order</p>
                <p className="text-sm font-bold text-red-900">#{orderToDelete.id.substring(0, 8).toUpperCase()}</p>
                <p className="text-xs text-red-700">Customer: {users[orderToDelete.userId]?.name}</p>
                <p className="text-xs text-red-700">Amount: ₹{orderToDelete.totalAmount?.toLocaleString()}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-700">Why is this order being deleted?</Label>
              <textarea 
                className="w-full h-24 rounded-2xl border-slate-200 p-4 text-sm focus:ring-red-500 focus:border-red-500 bg-slate-50"
                placeholder="e.g. Customer cancelled, duplicate order, out of stock..."
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">This record will be moved to the Deleted Orders history.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Permanently Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
