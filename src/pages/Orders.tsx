import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, Clock, CheckCircle2, XCircle, IndianRupee, Calendar, MapPin, CreditCard, Info, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

const Orders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'orders'));

    return () => unsubscribe();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1"><Clock size={12} /> Pending</Badge>;
      case 'Processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1"><Package size={12} /> Processing</Badge>;
      case 'Delivered':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 flex items-center gap-1"><CheckCircle2 size={12} /> Delivered</Badge>;
      case 'Cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 flex items-center gap-1"><XCircle size={12} /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Orders</h1>
        <p className="text-slate-500 font-medium">Track your supply orders and their status</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-none shadow-sm bg-white rounded-3xl p-12 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <ShoppingBag size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No orders yet</h3>
          <p className="text-slate-500 mt-2">When you purchase items from the shop, they will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <div key={order.id}>
              <Dialog open={selectedOrder?.id === order.id} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogTrigger render={
                  <Card 
                    className="border-none shadow-sm bg-white rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                    onClick={() => setSelectedOrder(order)}
                  >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                          <Package size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {order.items ? `${order.items.length} Items` : order.productName}
                            </h3>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                              <Calendar size={12} />
                              {format(new Date(order.date), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {order.items 
                                ? order.items.map((i: any) => i.name).join(', ').substring(0, 30) + (order.items.map((i: any) => i.name).join(', ').length > 30 ? '...' : '')
                                : `Qty: ${order.quantity} ${order.unit}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2">
                        <div className="flex items-center text-emerald-600 font-bold text-lg">
                          <IndianRupee size={16} />
                          <span>{order.totalAmount?.toLocaleString()}</span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                } />
              <DialogContent className="rounded-3xl sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">Order Details</DialogTitle>
                  <CardDescription>Order ID: #{order.id.substring(0, 8).toUpperCase()}</CardDescription>
                </DialogHeader>
                
                <div className="py-6 space-y-8">
                  {/* Status Section */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Info size={18} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Status</p>
                        <p className="font-bold text-slate-900">{order.status}</p>
                      </div>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  {/* Product Details */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Items Ordered</h4>
                    <div className="space-y-3">
                      {order.items ? (
                        order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl">
                            <div className="flex items-center gap-4">
                              <div className="bg-slate-50 p-2 rounded-xl">
                                <Package size={20} className="text-slate-400" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.quantity} {item.unit} @ ₹{item.price.toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl">
                          <div className="flex items-center gap-4">
                            <div className="bg-slate-50 p-2 rounded-xl">
                              <Package size={20} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{order.productName}</p>
                              <p className="text-xs text-slate-500">{order.quantity} {order.unit}</p>
                            </div>
                          </div>
                          <p className="font-bold text-slate-900">₹{order.totalAmount?.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery & Payment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={12} /> Delivery Address
                      </h4>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl min-h-[60px]">
                        {order.deliveryAddress || 'No address provided'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <CreditCard size={12} /> Payment Info
                      </h4>
                      <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                        <p className="text-sm font-bold text-slate-900">{order.paymentMethod}</p>
                        <Badge variant="outline" className={`text-[10px] ${
                          order.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {order.paymentStatus || 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Admin Update */}
                  {order.statusUpdate && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Admin Message</p>
                      <p className="text-sm text-indigo-900 font-medium">{order.statusUpdate}</p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="pt-6 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold text-slate-900">₹{order.totalAmount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Delivery Fee</span>
                      <span className="text-emerald-600 font-bold uppercase text-[10px]">Free</span>
                    </div>
                    <div className="flex justify-between text-lg pt-2">
                      <span className="font-bold text-slate-900">Total Amount</span>
                      <div className="flex items-center text-emerald-600 font-bold">
                        <IndianRupee size={18} />
                        <span>{order.totalAmount?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
