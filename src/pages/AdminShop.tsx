import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tag, AlertTriangle, TrendingUp, ShoppingBag, Eye, Phone, User, Mail, Calendar } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

const AdminShop: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAbandonedOpen, setIsAbandonedOpen] = useState(false);
  const [isRecentOrdersOpen, setIsRecentOrdersOpen] = useState(false);
  const [selectedUserCart, setSelectedUserCart] = useState<any>(null);
  const [selectedUserOrders, setSelectedUserOrders] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shopItems'));

    const ordersQ = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    const cartsQ = query(collection(db, 'carts'), orderBy('updatedAt', 'desc'));
    const unsubscribeCarts = onSnapshot(cartsQ, (snapshot) => {
      setCarts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'carts'));

    const usersQ = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      unsubscribe();
      unsubscribeOrders();
      unsubscribeCarts();
      unsubscribeUsers();
    };
  }, []);

  const stats = {
    totalItems: items.length,
    lowStock: items.filter(i => (i.stockQuantity || 0) <= (i.lowStockLimit || 10)).length,
    recentOrders: orders.filter(o => isAfter(new Date(o.date), subDays(new Date(), 7))).length,
    abandonedCarts: carts.length
  };

  const recentOrdersList = orders.filter(o => isAfter(new Date(o.date), subDays(new Date(), 7)));

  const getUserDetails = (userId: string) => {
    const user = users.find(u => u.id === userId || u.uid === userId);
    if (user) return user;
    return { 
      name: `Farmer (${userId.slice(0, 5)}...)`, 
      email: 'Loading...', 
      phone: 'N/A' 
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Shop Dashboard</h1>
          <p className="text-slate-500 font-medium">Overview of shop performance and activity</p>
        </div>
      </div>

      {/* Dashboard Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Tag size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Items</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.totalItems}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Low Stock</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.lowStock}</h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="border-none shadow-sm bg-white rounded-3xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setIsAbandonedOpen(true)}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <ShoppingBag size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Abandoned Carts</p>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{stats.abandonedCarts}</h3>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="border-none shadow-sm bg-white rounded-3xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setIsRecentOrdersOpen(true)}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">7 Days Orders</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.recentOrders}</h3>
                </div>
                <div className="h-8 w-8 rounded-lg text-emerald-600 flex items-center justify-center">
                  <Eye size={16} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abandoned Carts Dialog */}
      <Dialog open={isAbandonedOpen} onOpenChange={setIsAbandonedOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="text-amber-600" />
              Abandoned Carts
            </DialogTitle>
            <CardDescription>Farmers who added items but haven't checked out</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : carts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                <p>No abandoned carts found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {carts.map((cart) => {
                  const farmer = getUserDetails(cart.userId);
                  return (
                    <div key={cart.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-200">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{farmer.name}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Phone size={10} /> {farmer.phone || 'N/A'}</span>
                              <span className="flex items-center gap-1"><Mail size={10} /> {farmer.email}</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-xl gap-2 text-xs"
                          onClick={() => setSelectedUserCart(selectedUserCart?.id === cart.id ? null : cart)}
                        >
                          <Eye size={14} />
                          {selectedUserCart?.id === cart.id ? 'Hide Cart' : 'View Cart'}
                        </Button>
                      </div>
                      
                      {selectedUserCart?.id === cart.id && (
                        <div className="mt-2 p-4 bg-white rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Cart Items</h5>
                          <div className="space-y-2">
                            {cart.items && Array.isArray(cart.items) && cart.items.length > 0 ? (
                              cart.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="text-slate-700 font-medium">{item.name || 'Unknown Item'} x {item.quantity || 0}</span>
                                  <span className="font-bold text-slate-900">₹{((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString()}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">No items found in this cart</p>
                            )}
                            <div className="pt-2 border-t border-slate-100 mt-2 flex justify-between items-center">
                              <span className="font-bold text-slate-900">Total</span>
                              <span className="text-emerald-600 font-bold">₹{(cart.items || []).reduce((sum: number, i: any) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Orders Dialog */}
      <Dialog open={isRecentOrdersOpen} onOpenChange={setIsRecentOrdersOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="text-emerald-600" />
              Recent Orders (7 Days)
            </DialogTitle>
            <CardDescription>Orders placed in the last 7 days</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : recentOrdersList.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
                <p>No orders in the last 7 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrdersList.map((order) => {
                  const farmer = getUserDetails(order.userId);
                  return (
                    <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 border border-slate-200">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{farmer.name}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Phone size={10} /> {farmer.phone || 'N/A'}</span>
                              <span className="flex items-center gap-1"><Calendar size={10} /> {format(new Date(order.date), 'MMM dd, hh:mm a')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-lg text-[10px] h-6">
                            {order.status.toUpperCase()}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl gap-2 text-xs h-8"
                            onClick={() => setSelectedUserOrders(selectedUserOrders?.id === order.id ? null : order)}
                          >
                            <Eye size={14} />
                            {selectedUserOrders?.id === order.id ? 'Hide' : 'View'}
                          </Button>
                        </div>
                      </div>
                      
                      {selectedUserOrders?.id === order.id && (
                        <div className="mt-2 p-4 bg-white rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Order Details</h5>
                          <div className="space-y-2">
                            {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                              order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="text-slate-700 font-medium">{item.name || 'Unknown Item'} x {item.quantity || 0}</span>
                                  <span className="font-bold text-slate-900">₹{((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString()}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">No items found in this order</p>
                            )}
                            <div className="pt-2 border-t border-slate-100 mt-2 flex justify-between items-center">
                              <span className="font-bold text-slate-900">Total Paid</span>
                              <span className="text-emerald-600 font-bold">₹{(Number(order.totalAmount) || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminShop;
