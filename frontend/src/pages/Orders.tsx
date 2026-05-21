import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, Clock, CheckCircle2, XCircle, IndianRupee, Calendar, MapPin, CreditCard, Info, ChevronRight, Truck, AlertTriangle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

const Orders: React.FC = () => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fixImageUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      const id = url.split('id=')[1] || url.split('/d/')[1]?.split('/')[0];
      return `https://docs.google.com/uc?export=view&id=${id}`;
    }
    return url;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists()) {
          const settings = snap.data();
          setSystemSettings(settings);
          
          if (settings.paymentGateways?.razorpay?.enabled || (import.meta as any).env.VITE_RAZORPAY_KEY_ID) {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            document.body.appendChild(script);
          }
          
          if (settings.paymentGateways?.cashfree?.enabled) {
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.async = true;
            document.body.appendChild(script);
          }
        }
      } catch (e) {
        console.error('Failed to fetch system settings');
      }
    };
    fetchSettings();
  }, []);

  const finalizeDeliveryPayment = async (orderId: string, transactionId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryPaymentStatus: 'Paid',
        paymentStatus: 'Paid', // Mark main payment as paid too if consolidated
        deliveryPaymentTransactionId: transactionId,
        status: 'Processing' // Auto move to processing as requested
      });
      toast.success('Delivery payment successful! Order is now in processing.');
      setIsProcessingPayment(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      setIsProcessingPayment(false);
    }
  };

  const safeParseJson = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await res.json();
      } catch (e: any) {
        throw new Error(`Failed to parse JSON response: ${e.message}`);
      }
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error(`Server returned HTML response instead of JSON. Status: ${res.status} ${res.statusText}. Please verify that the API backend is running.`);
    }
    throw new Error(`Server returned non-JSON response. Status: ${res.status} ${res.statusText}. Content: ${text.substring(0, 150)}...`);
  };

  const handleDeliveryPaymentRazorpay = async (order: any) => {
    setIsProcessingPayment(true);
    try {
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: order.paymentStatus === 'Paid' ? order.deliveryCharge : (order.totalAmount + order.deliveryCharge - (order.walletDiscount || 0)),
          gateway: "razorpay",
          customerEmail: user?.email,
          customerPhone: profile?.mobile,
          orderId: `del_${order.id}_${Date.now()}`
        })
      });
      
      const orderData = await safeParseJson(orderRes);
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create Razorpay order");

      const options = {
        key: systemSettings?.paymentGateways?.razorpay?.apiKey || (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Bharat Nest Agro",
        description: `Delivery Charges for Order #${order.id.slice(-6)}`,
        order_id: orderData.id,
        handler: function (response: any) {
          finalizeDeliveryPayment(order.id, response.razorpay_payment_id);
        },
        prefill: {
          name: profile?.name || "",
          email: user?.email || "",
          contact: profile?.mobile || ""
        },
        theme: { color: "#10b981" },
        modal: {
          ondismiss: function() {
            setIsProcessingPayment(false);
          }
        }
      };

      const Razorpay = (window as any).Razorpay;
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed');
      setIsProcessingPayment(false);
    }
  };

  const handleDeliveryPaymentCashfree = async (order: any) => {
    setIsProcessingPayment(true);
    try {
      const Cashfree = (window as any).Cashfree;
      if (!Cashfree) throw new Error('Cashfree SDK not loaded');

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.paymentStatus === 'Paid' ? order.deliveryCharge : (order.totalAmount + order.deliveryCharge - (order.walletDiscount || 0)),
          gateway: "cashfree",
          customerId: user?.uid || "guest",
          customerPhone: profile?.mobile || "9999999999",
          customerEmail: user?.email || "customer@example.com",
          orderId: `del_${order.id}_${Date.now()}`
        })
      });

      const data = await safeParseJson(response);
      if (!response.ok) {
        let errMsg = data.error || 'Failed to initialize session';
        if (data.message) {
          errMsg += `: ${data.message}`;
        }
        throw new Error(errMsg);
      }

      const mode = systemSettings?.paymentGateways?.cashfree?.mode === "production" ? "production" : "sandbox";
      const cf = new Cashfree({ mode: mode });
      
      if (!data.payment_session_id) throw new Error("No payment session ID received");

      cf.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      }).then((result: any) => {
        if (result.error) {
          toast.error(result.error.message);
          setIsProcessingPayment(false);
        }
      });
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed');
      setIsProcessingPayment(false);
    }
  };

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
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1"><Clock size={12} /> Pending</Badge>;
      case 'Verifying':
        return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 flex items-center gap-1"><Info size={12} /> Verifying</Badge>;
      case 'Delivery Payment Pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 flex items-center gap-1"><CreditCard size={12} /> Delivery Pay Pending</Badge>;
      case 'Assign Delivery Date':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1"><Calendar size={12} /> Date Planning</Badge>;
      case 'Accept':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1"><CheckCircle2 size={12} /> Order Accepted</Badge>;
      case 'Processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1"><Package size={12} /> Processing</Badge>;
      case 'Shipped':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1"><Truck size={12} /> Shipped</Badge>;
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
                <DialogTrigger asChild>
                  <div 
                    role="button"
                    tabIndex={0}
                    className="w-full text-left"
                    onClick={() => setSelectedOrder(order)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedOrder(order);
                      }
                    }}
                  >
                    <Card 
                      className="border-none shadow-sm bg-white rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all group"
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
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 rounded-md">#{order.orderId || order.id.slice(-6).toUpperCase()}</span>
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
                            <div className="flex items-center text-emerald-600 font-bold text-lg" id={`order-amount-${order.id}`}>
                              <IndianRupee size={16} />
                              <span>{order.totalAmount?.toLocaleString()}</span>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] sm:max-w-xl max-h-[85vh] overflow-y-auto border-none shadow-2xl p-0 no-scrollbar">
                <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 italic uppercase leading-none">Order Details</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: #{order.orderId || order.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                    <button 
                      onClick={() => setSelectedOrder(null)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="p-8 space-y-10">
                  {/* Action Alert for Settlements */}
                  {order.deliveryPaymentStatus !== 'Paid' && order.deliveryCharge > 0 && (
                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-amber-600 p-2.5 rounded-2xl text-white shadow-lg shadow-amber-200">
                          <AlertTriangle size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-900 uppercase italic">Settlement Required</p>
                          <p className="text-[10px] text-amber-700 leading-relaxed font-bold italic mt-1 uppercase tracking-tight">
                            {order.paymentStatus === 'Pending' 
                              ? "Total settlement (Inventory + Logistics) is pending. Authorize now." 
                              : "Logistics fees are pending. Authorize to start processing."}
                          </p>
                        </div>
                      </div>
                      <button 
                         disabled={isProcessingPayment}
                         className={`w-full bg-amber-600 hover:bg-amber-700 text-white font-black italic uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-amber-100 text-[10px] transition-all active:scale-95 ${isProcessingPayment ? 'opacity-50' : ''}`}
                         onClick={async () => {
                           const gateways = systemSettings?.paymentGateways;
                           const hasEnvRazorpay = !!(import.meta as any).env.VITE_RAZORPAY_KEY_ID;
                           if (!gateways && !hasEnvRazorpay) {
                             toast.error('Payment system not ready');
                             return;
                           }

                           if (gateways?.cashfree?.enabled) {
                             handleDeliveryPaymentCashfree(order);
                           } else if (gateways?.razorpay?.enabled || hasEnvRazorpay) {
                             handleDeliveryPaymentRazorpay(order);
                           } else {
                             toast.info('Pay via Wallet or at Point of Delivery as instructed by manager.');
                           }
                         }}
                      >
                        {isProcessingPayment ? 'Processing...' : `Authorize Settlement (₹${((order.paymentStatus === 'Paid' ? order.deliveryCharge : (order.totalAmount + order.deliveryCharge - (order.walletDiscount || 0)))).toLocaleString()})`}
                      </button>
                    </div>
                  )}

                  {/* Dispatch & Logistics Card - SHRUNK & PROFESSIONAL */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Logistics Protocol</h4>
                    
                    {order.status === 'Shipped' && order.shipment ? (
                      <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden group border border-white/5">
                        <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 scale-150 transition-transform duration-1000 group-hover:scale-175">
                          <Truck size={100} />
                        </div>
                        <div className="relative z-10 space-y-5">
                          <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/5">
                              <Truck size={18} className="text-emerald-400" />
                            </div>
                            <p className="text-sm font-black italic uppercase tracking-tight">via {order.shipment.type}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                            {order.shipment.type === 'Railway' && (
                              <>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Train</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.railway?.trainNumber} - {order.shipment.railway?.trainName}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Route</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.railway?.loadedStation} → {order.shipment.railway?.unloadingStation}</p>
                                </div>
                                {(order.shipment.railway?.builtyImage || order.shipment.railway?.proof) && (
                                  <div className="col-span-2 flex flex-col gap-2">
                                    {order.shipment.railway.builtyImage && (
                                      <a href={order.shipment.railway.builtyImage} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                                        <ExternalLink size={12} className="text-emerald-400" />
                                        <span className="text-[10px] font-black uppercase italic tracking-widest text-emerald-400">View Builty Doc</span>
                                      </a>
                                    )}
                                    {order.shipment.railway.proof && (
                                      <a href={order.shipment.railway.proof} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                                        <ExternalLink size={12} className="text-indigo-400" />
                                        <span className="text-[10px] font-black uppercase italic tracking-widest text-indigo-400">View Shipment Proof</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {order.shipment.type === 'Road' && (
                              <>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Pilot</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.road?.driverName}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Contact</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.road?.driverNumber}</p>
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Hub Destination</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.road?.unloadingLocation}</p>
                                </div>
                              </>
                            )}

                            {order.shipment.type === 'Courier' && (
                              <>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Tracking</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">{order.shipment.courier?.trackingNumber}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[7px] font-black text-white/30 uppercase tracking-widest italic">Expected</p>
                                  <p className="text-[11px] font-black italic uppercase truncate">
                                    {order.shipment.courier?.expectedDate ? format(new Date(order.shipment.courier.expectedDate), 'MMM dd, yyyy') : 'Calculated...'}
                                  </p>
                                </div>
                                {order.shipment.courier?.invoice && (
                                  <a href={order.shipment.courier.invoice} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                                    <ExternalLink size={12} className="text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase italic tracking-widest text-emerald-400">View Invoice PDF</span>
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
                         <div className="grid grid-cols-3 gap-4">
                           <div className="space-y-1">
                             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest italic">Node Status</p>
                             <p className="text-[10px] font-black text-slate-900 italic uppercase truncate">{order.deliveryMethod || 'Verifying Hub'}</p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest italic">ETA Dispatch</p>
                             <p className="text-[10px] font-black text-slate-900 italic uppercase truncate">
                               {order.deliveryDate ? format(new Date(order.deliveryDate), 'MMM dd') : 'Awaiting'}
                             </p>
                           </div>
                           <div className="space-y-1">
                             <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest italic">Destination</p>
                             <p className="text-[10px] font-black text-slate-900 italic uppercase truncate">{order.deliveryDestination || 'Verified Port'}</p>
                           </div>
                         </div>
                         {order.deliveryAddress && (
                           <div className="pt-4 border-t border-slate-50 flex items-start gap-2">
                             <MapPin size={10} className="text-slate-400 mt-0.5" />
                             <p className="text-[9px] font-bold text-slate-500 italic max-w-full truncate">
                               {typeof order.deliveryAddress === 'object' ? `${order.deliveryAddress.farmName || order.deliveryAddress.name}: ${order.deliveryAddress.line1}` : order.deliveryAddress}
                             </p>
                           </div>
                         )}
                      </div>
                    )}
                  </div>

                  {/* Order Evolution - SHRUNK & PROFESSIONAL */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-1">Order Status</h4>
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between gap-2 py-8 overflow-x-auto no-scrollbar">
                       {[
                         { id: 'Pending', label: 'Registered', icon: Clock },
                         { id: 'Verifying', label: 'Verify', icon: Info },
                         { id: 'DPP', label: 'Settlement', icon: IndianRupee },
                         { id: 'Accept', label: 'Accepted', icon: CheckCircle2 },
                         { id: 'Processing', label: 'Process', icon: Package },
                         { id: 'Shipped', label: 'Shipped', icon: Truck },
                         { id: 'Delivered', label: 'Delivered', icon: CheckCircle2 }
                       ].map((step, idx, arr) => {
                         const currentStatusIndex = arr.findIndex(s => s.id === order.status || (s.id === 'DPP' && order.status === 'Delivery Payment Pending'));
                         const isActive = idx <= currentStatusIndex;
                         const Icon = step.icon;
                         
                         return (
                           <div key={step.id} className="flex items-center gap-2 shrink-0">
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                    isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-200 border border-slate-100'
                                  }`}>
                                    <Icon size={14} />
                                  </div>
                                  <p className={`text-[7px] font-black uppercase italic tracking-tighter ${isActive ? 'text-slate-900' : 'text-slate-300'}`}>
                                    {step.label}
                                  </p>
                                </div>
                              {idx < arr.length - 1 && (
                                <div className={`h-[2px] w-4 rounded-full mb-4 transition-all ${
                                  idx < currentStatusIndex ? 'bg-slate-900' : 'bg-slate-100'
                                }`} />
                              )}
                           </div>
                         );
                       })}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Order Items</h4>
                      <Badge className="bg-slate-100 text-slate-600 font-black italic rounded px-2 text-[8px]">{order.items?.length || 1} ITEMS</Badge>
                    </div>
                    <div className="space-y-3">
                      {order.items ? order.items.map((it: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 group hover:shadow-md transition-shadow">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shrink-0 p-2">
                            <img src={fixImageUrl(it.imageUrl)} alt={it.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-black text-slate-900 uppercase truncate leading-none mb-1">{it.name}</p>
                                <p className="text-[8px] font-bold text-slate-400 italic uppercase tracking-widest">{it.variant || 'Standard Node'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-slate-900 italic leading-none mb-1">₹{(it.price * it.quantity).toLocaleString()}</p>
                                <p className="text-[8px] font-bold text-slate-400 italic">₹{it.price} x {it.quantity} {it.unit}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden p-2">
                             <Package size={24} className="text-slate-200" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-black text-slate-900 uppercase">{order.productName}</p>
                              <p className="text-xs font-black text-slate-900 italic">₹{order.totalAmount?.toLocaleString()}</p>
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 italic uppercase tracking-widest">Qty: {order.quantity} {order.unit}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Settlement Summary */}
                  <div className="pt-8 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between text-xs items-center">
                      <span className="font-bold text-slate-400 italic uppercase tracking-tighter">Item Total</span>
                      <span className="font-black text-slate-900 italic tracking-tight text-sm">₹{order.totalAmount?.toLocaleString()}</span>
                    </div>
                    {order.walletDiscount > 0 && (
                      <div className="flex justify-between text-xs items-center">
                        <span className="font-bold text-emerald-600 italic uppercase tracking-tighter">Wallet Credit</span>
                        <span className="font-black text-emerald-600 italic tracking-tight">- ₹{order.walletDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs items-center">
                      <span className="font-bold text-slate-400 italic uppercase tracking-tighter">Delivery Fees</span>
                      <div className="flex items-center gap-2">
                         <span className="font-black text-slate-900 italic tracking-tight text-sm">
                           {order.deliveryCharge > 0 ? `₹${order.deliveryCharge.toLocaleString()}` : 'Variable (Awaited)'}
                         </span>
                         {order.deliveryCharge > 0 && (
                           <Badge className={`text-[8px] px-1.5 py-0.5 rounded italic font-black uppercase tracking-widest ${
                             order.deliveryPaymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                           }`}>
                             {order.deliveryPaymentStatus === 'Paid' ? 'Paid' : 'Awaited'}
                           </Badge>
                         )}
                      </div>
                    </div>
                    
                    <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white flex justify-between items-center mt-6 shadow-xl shadow-slate-200">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Total Amount</p>
                        <IndianRupee size={16} className="text-emerald-400 mb-1" />
                        <span className="text-2xl font-black italic tracking-tighter">₹{((order.totalAmount || 0) + (order.deliveryCharge || 0) - (order.walletDiscount || 0)).toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] font-black text-white/50 uppercase tracking-widest italic mb-2">Payment Status</p>
                         <p className="text-[10px] font-bold italic text-white/70 uppercase">{order.paymentStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-4 pb-4 px-8 sticky bottom-0 z-20" />
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
