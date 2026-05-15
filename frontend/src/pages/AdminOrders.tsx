import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDocs, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
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
  Package,
  X,
  MapPin,
  Info,
  IndianRupee,
  Calendar
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
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Verifying' | 'DPP' | 'Upcoming' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled'>('All');
  const [managerCommissionConfig, setManagerCommissionConfig] = useState<any>(null);
  
  // Shipment Details State
  const [shipmentDetails, setShipmentDetails] = useState({
    type: 'Railway' as 'Railway' | 'Road' | 'Courier',
    railway: { trainNumber: '', trainName: '', loadedStation: '', unloadingStation: '', builtyImage: '', proof: '' },
    road: { driverName: '', driverNumber: '', vehicle: '', unloadingLocation: '' },
    courier: { courierName: '', trackingNumber: '', invoice: '', expectedDate: '' }
  });
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
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);

  const [deliveryChargeForm, setDeliveryChargeForm] = useState({
    amount: 0,
    status: 'Unpaid',
    method: 'Courier',
    otherMethod: '',
    deliveryDate: '',
    deliveryDestination: ''
  });

  useEffect(() => {
    if (selectedOrderDetails) {
      setDeliveryChargeForm({
        amount: selectedOrderDetails.deliveryCharge || 0,
        status: selectedOrderDetails.deliveryPaymentStatus || 'Unpaid',
        method: selectedOrderDetails.deliveryMethod || 'Courier',
        otherMethod: selectedOrderDetails.otherDeliveryMethod || '',
        deliveryDate: selectedOrderDetails.deliveryDate || '',
        deliveryDestination: selectedOrderDetails.deliveryDestination || ''
      });
    }
  }, [selectedOrderDetails]);

  const handleUpdateDeliveryCharge = async () => {
    if (!selectedOrderDetails) return;
    try {
      const amount = Number(deliveryChargeForm.amount);
      const isPaid = deliveryChargeForm.status === 'Paid';
      
      let newStatus = selectedOrderDetails.status;
      if (amount > 0) {
        if (isPaid) {
          newStatus = 'Processing';
        } else {
          newStatus = 'Delivery Payment Pending';
        }
      }

      await updateDoc(doc(db, 'orders', selectedOrderDetails.id), {
        deliveryCharge: amount,
        deliveryPaymentStatus: deliveryChargeForm.status,
        deliveryMethod: deliveryChargeForm.method,
        otherDeliveryMethod: deliveryChargeForm.method === 'Other' ? deliveryChargeForm.otherMethod : '',
        deliveryDestination: deliveryChargeForm.deliveryDestination,
        status: newStatus,
        deliveryDate: deliveryChargeForm.deliveryDate
      });

      // Create notification for the farmer
      await addDoc(collection(db, 'notifications'), {
        userId: selectedOrderDetails.userId,
        title: 'Order Logistics Updated',
        message: `Logistics for order #${selectedOrderDetails.orderId || selectedOrderDetails.id.slice(-6).toUpperCase()} updated. Status: ${newStatus}.`,
        type: 'order',
        orderId: selectedOrderDetails.id,
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Logistics & Status updated');
      // Refresh current view
      const snap = await getDoc(doc(db, 'orders', selectedOrderDetails.id));
      setSelectedOrderDetails({ id: snap.id, ...snap.data() });
    } catch (error) {
      toast.error('Failed to update logistics');
    }
  };

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

      // Create notification for the farmer
      await addDoc(collection(db, 'notifications'), {
        userId: editingOrder.userId,
        title: 'Order Update',
        message: updateForm.statusUpdate || `Your order status is now ${updateForm.status}.`,
        type: 'order',
        orderId: editingOrder.id,
        read: false,
        createdAt: new Date().toISOString()
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
    const matchesStatus = activeTab === 'All' || 
                         (activeTab === 'DPP' ? o.status === 'Delivery Payment Pending' : o.status === activeTab);
    
    // Manager/Admin Access filter
    let hasAccess = true;
    if (isManager && !isAdmin) {
      // Manager can only see orders from farmers assigned to them
      hasAccess = userProfile?.managerId === currentUser?.uid || userProfile?.assignedManagerId === currentUser?.uid;
    }

    // Upcoming filter logic
    if (activeTab === 'Upcoming') {
      const isAccepted = o.status === 'Accept' || o.status === 'Processing';
      const hasUpcomingDate = o.deliveryDate && new Date(o.deliveryDate) >= new Date(new Date().setHours(0,0,0,0));
      return matchesSearch && isAccepted && hasUpcomingDate && hasAccess;
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

      {/* Tabs & Filter */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100 max-w-fit">
          {['All', 'Pending', 'Verifying', 'DPP', 'Upcoming', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
              {tab !== 'Upcoming' && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] ${
                  activeTab === tab ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {orders.filter(o => {
                    if (tab === 'All') return true;
                    if (tab === 'DPP') return o.status === 'Delivery Payment Pending';
                    return o.status === tab;
                  }).length}
                </span>
              )}
            </button>
          ))}
        </div>

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
                    <button 
                      onClick={() => setSelectedOrderDetails(order)}
                      className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase italic"
                    >
                      #{order.orderId || order.id?.substring(0, 8)?.toUpperCase() || 'N/A'}
                    </button>
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
                      order.status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Accept' ? 'bg-emerald-50 text-emerald-600' :
                      order.status === 'Processing' ? 'bg-indigo-100 text-indigo-700' :
                      order.status === 'Assign Delivery Date' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                      order.status === 'Delivery Payment Pending' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'Verifying' ? 'bg-purple-100 text-purple-700' :
                      order.status === 'Pending' ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
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
                    <div className="flex items-center justify-end gap-2">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-lg h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50"
                        onClick={() => setSelectedOrderDetails(order)}
                       >
                         Details
                       </Button>
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
                    </div>
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
                    <SelectItem value="Pending" className="text-xs font-bold uppercase italic py-3">Pending</SelectItem>
                    <SelectItem value="Verifying" className="text-xs font-bold uppercase italic py-3">Verifying</SelectItem>
                    <SelectItem value="Delivery Payment Pending" className="text-xs font-bold uppercase italic py-3">Delivery Fees Awaited</SelectItem>
                    <SelectItem value="Assign Delivery Date" className="text-xs font-bold uppercase italic py-3">Assign Delivery Date</SelectItem>
                    <SelectItem value="Accept" className="text-xs font-bold uppercase italic py-3">Order Accepted</SelectItem>
                    <SelectItem value="Processing" className="text-xs font-bold uppercase italic py-3">Processing</SelectItem>
                    <SelectItem value="Shipped" className="text-xs font-bold uppercase italic py-3">Shipped</SelectItem>
                    <SelectItem value="Delivered" className="text-xs font-bold uppercase italic py-3">Delivered</SelectItem>
                    <SelectItem value="Cancelled" className="text-xs font-bold uppercase italic py-3 text-red-600">Cancelled</SelectItem>
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
      {/* Full-size Order Details Dialog */}
      <Dialog open={!!selectedOrderDetails} onOpenChange={(open) => !open && setSelectedOrderDetails(null)}>
        <DialogContent className="fixed inset-0 z-50 w-full h-full max-w-none sm:max-w-none translate-x-0 translate-y-0 top-0 left-0 rounded-none p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col">
          <DialogHeader className="p-4 bg-[#122B21] text-white flex flex-row items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Package size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-widest uppercase italic">Order #{selectedOrderDetails?.orderId || selectedOrderDetails?.id?.substring(0, 8)?.toUpperCase()}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">Live Session • Management Terminal</p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="bg-white/5 hover:bg-white/10 text-white rounded-xl" onClick={() => setSelectedOrderDetails(null)}>
              <X size={20} />
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-slate-50/50">
            <div className="max-w-7xl mx-auto space-y-6">
        {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3 rounded-xl border-none shadow-sm bg-white flex flex-col justify-between h-20">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Order Items Value</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900">₹{selectedOrderDetails?.totalAmount?.toLocaleString()}</h3>
                    <Badge variant="outline" className={`${selectedOrderDetails?.paymentStatus === 'Paid' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-red-200 text-red-600 bg-red-50'} text-[7px] font-black uppercase italic px-1 h-4`}>
                      {selectedOrderDetails?.paymentStatus || 'Pending'}
                    </Badge>
                  </div>
                </Card>
                <Card className="p-3 rounded-xl border-none shadow-sm bg-white flex flex-col justify-between h-20">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Logistics Cost</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-blue-600">₹{selectedOrderDetails?.deliveryCharge || 0}</h3>
                    <Badge variant="outline" className={`${selectedOrderDetails?.deliveryPaymentStatus === 'Paid' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-amber-200 text-amber-600 bg-amber-50'} text-[7px] font-black uppercase italic px-1 h-4`}>
                      {selectedOrderDetails?.deliveryPaymentStatus || 'Unpaid'}
                    </Badge>
                  </div>
                </Card>
                <Card className="p-3 rounded-xl border-none shadow-sm bg-white flex flex-col justify-between h-20">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Order Pipeline</p>
                  <div className="flex items-center gap-1.5">
                    <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
                      <Clock size={14} />
                    </div>
                    <p className="text-[10px] font-black text-slate-900 uppercase italic leading-none">{selectedOrderDetails?.status}</p>
                  </div>
                </Card>
                <Card className="p-3 rounded-xl border-none shadow-sm bg-slate-900 text-white flex flex-col justify-between h-20">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Settlement Net</p>
                  <h3 className="text-lg font-black text-white italic">₹{((selectedOrderDetails?.totalAmount || 0) + (selectedOrderDetails?.deliveryCharge || 0)).toLocaleString()}</h3>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-20">
                {/* Product Inventory - Primary Focus */}
                <div className="lg:col-span-8 space-y-6">
                  <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-4 bg-slate-50/50 border-b flex justify-between items-center px-6">
                      <div className="flex items-center gap-2 text-slate-500">
                        <ShoppingBag size={14} />
                        <h4 className="text-[10px] font-black uppercase tracking-widest italic">Itemized Manifest</h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 italic bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">{selectedOrderDetails?.items?.length || 0} Products</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {selectedOrderDetails?.items?.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50/30 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-200/50 overflow-hidden">
                              {item.image || item.imageUrl ? (
                                <img src={item.image || item.imageUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="text-slate-300" size={18} />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 mb-0.5">{item.name}</p>
                              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 italic">
                                <span className="text-slate-900 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase">Qty: {item.quantity}</span>
                                <span>•</span>
                                <span>₹{item.price.toLocaleString()} Unit</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900 italic">₹{(item.price * (item.quantity || 1)).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="rounded-xl border-none shadow-sm bg-white p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                        <User size={12} className="text-slate-400" />
                        <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic">Customer Node</h4>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Full Name Details</p>
                          <p className="text-sm font-black text-slate-900 italic uppercase leading-none">{users[selectedOrderDetails?.userId]?.name || 'Anonymous'}</p>
                        </div>
                        <div>
                          <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Connectivity</p>
                          <p className="text-xs font-bold text-slate-700 leading-none mb-0.5">+{users[selectedOrderDetails?.userId]?.mobile || 'N/A'}</p>
                          <p className="text-[9px] font-medium text-slate-400 line-clamp-1">{users[selectedOrderDetails?.userId]?.email}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-xl border-none shadow-sm bg-white p-4">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                        <MapPin size={12} className="text-slate-400" />
                        <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic">Dispatch Target</h4>
                      </div>
                      <div className="text-[10px] leading-relaxed text-slate-600 font-medium space-y-1">
                        {typeof selectedOrderDetails?.deliveryAddress === 'object' ? (
                          <>
                            <p className="font-black text-slate-900 text-xs italic uppercase leading-tight mb-1">{selectedOrderDetails.deliveryAddress.farmName || selectedOrderDetails.deliveryAddress.contactName}</p>
                            <p className="line-clamp-1">{selectedOrderDetails.deliveryAddress.address || selectedOrderDetails.deliveryAddress.line1}</p>
                            <p className="line-clamp-1">{selectedOrderDetails.deliveryAddress.locality || selectedOrderDetails.deliveryAddress.area}, {selectedOrderDetails.deliveryAddress.district}</p>
                            <div className="pt-1 flex flex-wrap gap-1">
                              <Badge className="bg-indigo-600 text-[8px] font-black italic rounded px-1 h-4">PIN: {selectedOrderDetails.deliveryAddress.pincode}</Badge>
                              {selectedOrderDetails.deliveryDestination && (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[8px] font-black italic rounded px-1 h-4">DEST: {selectedOrderDetails.deliveryDestination}</Badge>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="line-clamp-2">{selectedOrderDetails?.deliveryAddress || 'N/A'}</p>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Command & Control Center */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Logistics Deployment */}
                  <Card className="rounded-xl border-none shadow-sm bg-white p-5 border-l-4 border-indigo-600">
                    <div className="flex items-center gap-2 mb-4">
                      <Truck size={14} className="text-indigo-600" />
                      <h4 className="text-[9px] font-black uppercase text-slate-900 tracking-widest italic">Logistics Terminal</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black text-slate-400 uppercase italic">Method</Label>
                          <Select 
                            value={deliveryChargeForm.method} 
                            onValueChange={v => setDeliveryChargeForm({...deliveryChargeForm, method: v})}
                          >
                            <SelectTrigger className="rounded-lg h-9 italic font-black text-[9px] border-slate-100 bg-slate-50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="Railway" className="text-[10px] font-bold italic uppercase py-2">Railway</SelectItem>
                              <SelectItem value="By Road" className="text-[10px] font-bold italic uppercase py-2">By Road</SelectItem>
                              <SelectItem value="Courier" className="text-[10px] font-bold italic uppercase py-2">Courier</SelectItem>
                              <SelectItem value="Other" className="text-[10px] font-bold italic uppercase py-2">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black text-slate-400 uppercase italic">Charge (₹)</Label>
                          <Input 
                            type="number"
                            className="rounded-lg h-9 italic font-black text-[11px] text-blue-600 bg-slate-50 border-slate-100"
                            value={deliveryChargeForm.amount}
                            onChange={e => setDeliveryChargeForm({...deliveryChargeForm, amount: Number(e.target.value)})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black text-slate-400 uppercase italic">Exp. Delivery Date</Label>
                          <Input 
                            type="date"
                            className="rounded-lg h-9 italic font-black text-[9px] text-emerald-600 bg-slate-50 border-slate-100"
                            value={deliveryChargeForm.deliveryDate}
                            onChange={e => setDeliveryChargeForm({...deliveryChargeForm, deliveryDate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[8px] font-black text-slate-400 uppercase italic">Dispatch Destination</Label>
                          <Input 
                            className="rounded-lg h-9 italic font-bold text-[9px] bg-slate-50 border-slate-100"
                            placeholder="Node / Landmark / Station..."
                            value={deliveryChargeForm.deliveryDestination}
                            onChange={e => setDeliveryChargeForm({...deliveryChargeForm, deliveryDestination: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[8px] font-black text-slate-400 uppercase italic">Payment Status</Label>
                        <Select 
                          value={deliveryChargeForm.status} 
                          onValueChange={v => setDeliveryChargeForm({...deliveryChargeForm, status: v})}
                        >
                          <SelectTrigger className="rounded-lg h-9 font-black italic text-[9px] bg-slate-50 border-slate-100">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-xl">
                            <SelectItem value="Unpaid" className="text-[10px] font-bold italic uppercase py-2 text-red-500">Pending</SelectItem>
                            <SelectItem value="Paid" className="text-[10px] font-bold italic uppercase py-2 text-emerald-600">Paid/Coll.</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button className="w-full h-10 bg-indigo-600 hover:bg-slate-900 text-white font-black italic text-[10px] uppercase tracking-widest rounded-lg transition-all shadow-md shadow-indigo-100" onClick={handleUpdateDeliveryCharge}>
                        Capture Info
                      </Button>
                    </div>
                  </Card>

                  {/* Delivery Timeline - Only show if Processing or later */}
                  {['Processing', 'Accept', 'Shipped', 'Delivered'].includes(selectedOrderDetails?.status) && (
                    <Card className="rounded-xl border-none shadow-sm bg-white p-5 border-l-4 border-emerald-600">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={14} className="text-emerald-600" />
                        <h4 className="text-[9px] font-black uppercase text-slate-900 tracking-widest italic">Fulfillment Hub</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                           <Label className="text-[8px] font-black text-slate-400 uppercase italic">Scheduled Date</Label>
                           <Input 
                            type="date"
                            className="rounded-lg h-9 italic font-black text-xs bg-slate-50 border-slate-100"
                            value={deliveryChargeForm.deliveryDate}
                            onChange={e => setDeliveryChargeForm({...deliveryChargeForm, deliveryDate: e.target.value})}
                          />
                        </div>
                        <Button variant="outline" className="w-full h-10 border-emerald-600 text-emerald-600 font-black italic text-[10px] uppercase tracking-widest rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={handleUpdateDeliveryCharge}>
                          Plan Delivery
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Operational Status Bridge */}
                  <Card className="rounded-2xl border-none shadow-sm bg-slate-900 p-6 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150">
                      <Clock size={80} />
                    </div>
                    <div className="relative z-10 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] italic text-slate-400">Order Evolution</p>
                      
                      <div className="space-y-4">
                        <Select 
                          value={updateForm.status || selectedOrderDetails?.status} 
                          onValueChange={v => setUpdateForm({...updateForm, status: v})}
                        >
                          <SelectTrigger className="rounded-xl h-12 bg-white/10 hover:bg-white/20 border-white/10 font-black italic uppercase text-xs transition-all text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="Pending" className="font-bold italic uppercase py-3 text-slate-400">Pending</SelectItem>
                            <SelectItem value="Verifying" className="font-bold italic uppercase py-3 text-purple-600">Verifying</SelectItem>
                            <SelectItem value="Delivery Payment Pending" className="font-bold italic uppercase py-3 text-amber-600">DPP (Awaited)</SelectItem>
                            <SelectItem value="Assign Delivery Date" className="font-bold italic uppercase py-3 text-emerald-500">Assign Delivery Date</SelectItem>
                            <SelectItem value="Accept" className="font-bold italic uppercase py-3 text-emerald-600 font-black">Order Accepted</SelectItem>
                            <SelectItem value="Processing" className="font-bold italic uppercase py-3 text-blue-600">Processing</SelectItem>
                            <SelectItem value="Shipped" className="font-bold italic uppercase py-3 text-indigo-600">Shipped</SelectItem>
                            <SelectItem value="Delivered" className="font-bold italic uppercase py-3 text-emerald-700 bg-emerald-50">Delivered</SelectItem>
                            <SelectItem value="Cancelled" className="font-bold italic uppercase py-3 text-red-600">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Quick Shipped Form */}
                        {(updateForm.status === 'Shipped' || selectedOrderDetails?.status === 'Shipped') && (
                          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                             <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest italic">Shipping Dispatch Details</p>
                             <div className="flex gap-2">
                               {['Railway', 'Road', 'Courier'].map(type => (
                                 <button
                                   key={type}
                                   onClick={() => setShipmentDetails({...shipmentDetails, type: type as any})}
                                   className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${
                                     shipmentDetails.type === type ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                   }`}
                                 >
                                   {type}
                                 </button>
                               ))}
                             </div>

                             {shipmentDetails.type === 'Railway' && (
                               <div className="grid grid-cols-2 gap-2">
                                  <Input placeholder="Train Number" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.railway.trainNumber} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, trainNumber: e.target.value}})} />
                                  <Input placeholder="Train Name" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.railway.trainName} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, trainName: e.target.value}})} />
                                  <Input placeholder="Loaded Stn" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.railway.loadedStation} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, loadedStation: e.target.value}})} />
                                  <Input placeholder="Unload Stn" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.railway.unloadingStation} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, unloadingStation: e.target.value}})} />
                                  <Input placeholder="Builty Link (Drive/Img)" className="bg-white/5 border-white/10 h-8 text-[10px] text-white col-span-2" value={shipmentDetails.railway.builtyImage} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, builtyImage: e.target.value}})} />
                                  <Input placeholder="Proof Link" className="bg-white/5 border-white/10 h-8 text-[10px] text-white col-span-2" value={shipmentDetails.railway.proof} onChange={e => setShipmentDetails({...shipmentDetails, railway: {...shipmentDetails.railway, proof: e.target.value}})} />
                               </div>
                             )}

                             {shipmentDetails.type === 'Road' && (
                               <div className="grid grid-cols-2 gap-2">
                                  <Input placeholder="Driver Name" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.road.driverName} onChange={e => setShipmentDetails({...shipmentDetails, road: {...shipmentDetails.road, driverName: e.target.value}})} />
                                  <Input placeholder="Driver Number" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.road.driverNumber} onChange={e => setShipmentDetails({...shipmentDetails, road: {...shipmentDetails.road, driverNumber: e.target.value}})} />
                                  <Input placeholder="Vehicle" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.road.vehicle} onChange={e => setShipmentDetails({...shipmentDetails, road: {...shipmentDetails.road, vehicle: e.target.value}})} />
                                  <Input placeholder="Unload Loc" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.road.unloadingLocation} onChange={e => setShipmentDetails({...shipmentDetails, road: {...shipmentDetails.road, unloadingLocation: e.target.value}})} />
                               </div>
                             )}

                             {shipmentDetails.type === 'Courier' && (
                               <div className="grid grid-cols-1 gap-2">
                                  <Input placeholder="Courier Name" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.courier.courierName} onChange={e => setShipmentDetails({...shipmentDetails, courier: {...shipmentDetails.courier, courierName: e.target.value}})} />
                                  <Input placeholder="Tracking ID" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.courier.trackingNumber} onChange={e => setShipmentDetails({...shipmentDetails, courier: {...shipmentDetails.courier, trackingNumber: e.target.value}})} />
                                  <Input placeholder="Invoice Link (Drive/PDF)" className="bg-white/5 border-white/10 h-8 text-[10px] text-white" value={shipmentDetails.courier.invoice} onChange={e => setShipmentDetails({...shipmentDetails, courier: {...shipmentDetails.courier, invoice: e.target.value}})} />
                                  <Input placeholder="Exp. Date" type="date" className="bg-white/5 border-white/10 h-8 text-[10px] text-white font-black" value={shipmentDetails.courier.expectedDate} onChange={e => setShipmentDetails({...shipmentDetails, courier: {...shipmentDetails.courier, expectedDate: e.target.value}})} />
                               </div>
                             )}
                          </div>
                        )}

                        <Button 
                          className="w-full h-12 bg-white text-slate-900 font-black italic uppercase text-xs tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-lg"
                          onClick={async () => {
                            try {
                              const newStatus = updateForm.status || selectedOrderDetails?.status;
                              const updateData: any = { 
                                status: newStatus,
                                updatedAt: new Date().toISOString()
                              };
                              
                              if (newStatus === 'Shipped') {
                                updateData.shipment = shipmentDetails;
                              }

                              await updateDoc(doc(db, 'orders', selectedOrderDetails.id), updateData);

                              // Create notification for the farmer
                              await addDoc(collection(db, 'notifications'), {
                                userId: selectedOrderDetails.userId,
                                title: 'Order Activity',
                                message: `Order #${selectedOrderDetails.orderId || selectedOrderDetails.id.slice(-6).toUpperCase()} status changed to ${newStatus}.`,
                                type: 'order',
                                orderId: selectedOrderDetails.id,
                                read: false,
                                createdAt: new Date().toISOString()
                              });

                              const snap = await getDoc(doc(db, 'orders', selectedOrderDetails.id));
                              setSelectedOrderDetails(null); // Auto-close popup
                              toast.success('Fulfillment Node Synced');
                            } catch (e) {
                              toast.error('Sync failed');
                            }
                          }}
                        >
                          Save and Update Status
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 opacity-50 pt-4 border-t border-white/5">
                        <div className={`p-2 rounded-lg border border-white/10 flex flex-col items-center gap-1 ${['Pending', 'Verifying'].includes(selectedOrderDetails?.status) ? 'bg-white/20 opacity-100' : ''}`}>
                          <Clock size={12} />
                          <p className="text-[7px] font-black uppercase">Pending</p>
                        </div>
                        <div className={`p-2 rounded-lg border border-white/10 flex flex-col items-center gap-1 ${['Accept', 'Processing'].includes(selectedOrderDetails?.status) ? 'bg-white/20 opacity-100' : ''}`}>
                          <Package size={12} />
                          <p className="text-[7px] font-black uppercase">Process</p>
                        </div>
                        <div className={`p-2 rounded-lg border border-white/10 flex flex-col items-center gap-1 ${['Shipped', 'Delivered'].includes(selectedOrderDetails?.status) ? 'bg-white/20 opacity-100' : ''}`}>
                          <Truck size={12} />
                          <p className="text-[7px] font-black uppercase">Delivered</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 px-12">
             <div className="flex gap-4">
                <div className="text-center md:text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Subtotal</p>
                  <p className="text-sm font-black text-slate-900 leading-none">₹{selectedOrderDetails?.totalAmount?.toLocaleString()}</p>
                </div>
                <div className="text-center md:text-left border-l pl-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Logistics</p>
                  <p className="text-sm font-black text-blue-600 leading-none">₹{(selectedOrderDetails?.deliveryCharge || 0).toLocaleString()}</p>
                </div>
                <div className="text-center md:text-left border-l pl-4">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1">Settlement</p>
                  <p className="text-base font-black text-emerald-600 leading-none">₹{((selectedOrderDetails?.totalAmount || 0) + (selectedOrderDetails?.deliveryCharge || 0)).toLocaleString()}</p>
                </div>
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSelectedOrderDetails(null)} className="rounded-xl h-10 px-6 font-bold italic uppercase text-[10px]">Close Terminal</Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">Archive & Delete Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {orderToDelete && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Deleting Order</p>
                <p className="text-sm font-bold text-red-900">#{orderToDelete.orderId || orderToDelete.id.substring(0, 8).toUpperCase()}</p>
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
