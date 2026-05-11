import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, addDoc, where, orderBy, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  IndianRupee, 
  Package, 
  Search, 
  Filter, 
  ShoppingBag, 
  Minus, 
  Plus, 
  Trash2, 
  X, 
  Bird, 
  Wrench, 
  Wheat, 
  LayoutGrid, 
  ChevronRight, 
  Star, 
  MapPin, 
  History, 
  RotateCcw,
  CheckCircle2,
  Truck,
  Wallet
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'motion/react';

const Shop: React.FC = () => {
  const { user, profile } = useAuth();
  const { isSidebarOpen } = useOutletContext<{ isSidebarOpen: boolean }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'All', name: 'All', icon: <LayoutGrid size={18} /> }]);
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentView, setCurrentView] = useState<'catalog' | 'details'>('catalog');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  
  const [newAddress, setNewAddress] = useState({
    farmName: '',
    line1: '',
    area: '',
    locality: '',
    district: '',
    state: '',
    pincode: '',
    name: '',
    mobile: '',
    type: 'Farm'
  });

  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('farm_supply_cart');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [isCartLoaded, setIsCartLoaded] = useState(false);

  // Categories will be fetched from Firestore

  useEffect(() => {
    const q = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shopItems');
      setLoading(false);
    });

    const qCats = query(collection(db, 'shopCategories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      const dbCats = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name, 
        iconUrl: doc.data().imageUrl 
      }));
      setCategories([{ id: 'All', name: 'All', icon: <LayoutGrid size={18} /> }, ...dbCats]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shopCategories');
    });

    return () => {
      unsubscribe();
      unsubscribeCats();
    };
  }, []);

  useEffect(() => {
    if (user && !isCartLoaded) {
      const fetchCart = async () => {
        try {
          const cartDoc = await getDoc(doc(db, 'carts', user.uid));
          if (cartDoc.exists()) {
            const data = cartDoc.data();
            if (data.items && Array.isArray(data.items)) {
              setCart(data.items);
            }
          }
          setIsCartLoaded(true);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `carts/${user.uid}`);
          setIsCartLoaded(true);
        }
      };
      fetchCart();
    }
  }, [user, isCartLoaded]);

  useEffect(() => {
    if (user && isCartLoaded) {
      localStorage.setItem('farm_supply_cart', JSON.stringify(cart));
      const syncCart = async () => {
        try {
          await setDoc(doc(db, 'carts', user.uid), {
            userId: user.uid,
            items: cart,
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `carts/${user.uid}`);
        }
      };
      const timeoutId = setTimeout(syncCart, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [cart, user, isCartLoaded]);

  const addToCart = (product: any, variant?: any) => {
    const cartItemId = variant ? `${product.id}-${variant.name}` : product.id;
    setCart(prev => {
      const existing = prev.find(item => item.cartId === cartItemId);
      if (existing) {
        toast.success(`Increased quantity of ${product.name}`);
        return prev.map(item => item.cartId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`Added ${product.name} to cart`);
      return [...prev, { 
        ...product, 
        cartId: cartItemId,
        quantity: 1, 
        selectedVariant: variant || null,
        price: variant ? variant.price : product.price 
      }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const [cartTotal, setCartTotal] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const walletAmount = useMemo(() => {
    const totalBalance = (profile?.walletBalance || 0) + (profile?.rewardBalance || 0);
    if (!useWallet || totalBalance <= 0) return 0;
    return Math.min(totalBalance, cartTotal);
  }, [useWallet, profile?.walletBalance, profile?.rewardBalance, cartTotal]);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Online'>('COD');
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setCartTotal(total);
  }, [cart]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = doc(db, 'system', 'settings');
        const snap = await getDoc(q);
        if (snap.exists()) {
          const settings = snap.data();
          setSystemSettings(settings);
          
          // Load Appropriate Scripts
          if (settings.paymentGateways?.razorpay?.enabled) {
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
        handleFirestoreError(e, OperationType.GET, 'system/settings');
      }
    };
    fetchSettings();

    return () => {
      // Cleanup scripts if necessary, though generally fine to leave
      const scripts = document.querySelectorAll('script[src*="razorpay"], script[src*="cashfree"]');
      scripts.forEach(s => s.remove());
    };
  }, []);

  const finalizeOrder = async (method: 'COD' | 'Online', address: any, transactionId?: string) => {
    if (!user) {
      toast.error('User session expired. Please log in again.');
      return;
    }

    try {
      const { writeBatch, Timestamp, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const orderId = `${Date.now()}`;
      const orderRef = doc(db, 'orders', orderId);
      
      const finalAmount = cartTotal - (useWallet ? walletAmount : 0);

      batch.set(orderRef, {
        userId: user.uid,
        userName: profile?.name || 'Customer',
        userMobile: profile?.mobile || address?.mobile || '',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          unit: item.selectedVariant ? item.selectedVariant.unit : item.unit,
          variant: item.selectedVariant ? item.selectedVariant.name : 'Standard'
        })),
        status: 'Received',
        totalAmount: cartTotal,
        walletDiscount: useWallet ? walletAmount : 0,
        paidAmount: finalAmount,
        deliveryAddress: address || null,
        paymentMethod: method === 'COD' ? 'Cash on Delivery' : 'Online Payment',
        paymentStatus: method === 'Online' ? 'Paid' : 'Pending',
        transactionId: transactionId || '',
        assignedManagerId: profile?.assignedManagerId || '',
        date: new Date().toISOString()
      });

      // Update Wallet if used
      if (useWallet && walletAmount > 0) {
        const userRef = doc(db, 'users', user.uid);
        let remainingToDeduct = walletAmount;
        const currentReward = profile?.rewardBalance || 0;
        const currentMain = profile?.walletBalance || 0;

        let newReward = currentReward;
        let newMain = currentMain;

        if (currentReward >= remainingToDeduct) {
          newReward -= remainingToDeduct;
          remainingToDeduct = 0;
        } else {
          remainingToDeduct -= currentReward;
          newReward = 0;
          newMain -= remainingToDeduct;
        }

        batch.update(userRef, {
          walletBalance: newMain,
          rewardBalance: newReward
        });

        const walletTransId = `WITHDRAW-${Date.now()}`;
        batch.set(doc(db, 'walletTransactions', walletTransId), {
          userId: user.uid,
          amount: -walletAmount,
          type: 'Debit',
          source: 'Order Payment',
          description: `Used for Order: ${orderId}`,
          referenceId: orderId,
          createdAt: Timestamp.now()
        });
      }
      
      await batch.commit();
      toast.success('Order placed successfully!');
      setCart([]);
      setIsCartOpen(false);
      setIsProcessingPayment(false);
      
      // Start success countdown
      setOrderSuccess(true);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/orders');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
      setIsProcessingPayment(false);
    }
  };

  const handleOnlinePayment = async (address: any) => {
    const gateways = systemSettings?.paymentGateways;
    if (!gateways) {
      toast.error('Online payment system is not configured');
      return;
    }

    // Check for enabled gateway
    if (gateways.cashfree?.enabled && gateways.cashfree?.appId) {
      handleCashfreePayment(address);
    } else if (gateways.razorpay?.enabled && gateways.razorpay?.apiKey) {
      handleRazorpayPayment(address);
    } else {
      toast.error('Online payment is currently unavailable. No gateway is enabled.');
    }
  };

  const handleRazorpayPayment = async (address: any) => {
    setIsProcessingPayment(true);
    
    try {
      const orderRes = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cartTotal })
      });
      
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: systemSettings.paymentGateways.razorpay.apiKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Bharat Nest Agro",
        description: "Supply Order Payment",
        order_id: orderData.id,
        image: "https://ais-dev-lebhqgu6cqvssmp5inx73h-837596617831.asia-southeast1.run.app/logo.png",
        handler: function (response: any) {
          finalizeOrder('Online', address, response.razorpay_payment_id);
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
      console.error('Razorpay Init Error:', err);
      toast.error(err.message || 'Could not initialize Razorpay');
      setIsProcessingPayment(false);
    }
  };

  const handleCashfreePayment = async (address: any) => {
    setIsProcessingPayment(true);
    
    try {
      const Cashfree = (window as any).Cashfree;
      if (!Cashfree) {
        toast.error('Cashfree SDK not loaded');
        setIsProcessingPayment(false);
        return;
      }

      // 1. Create Session via our backend
      const response = await fetch("/api/create-cashfree-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cartTotal,
          customerId: user?.uid || "guest",
          customerPhone: profile?.phone || "9999999999",
          customerEmail: user?.email || "customer@example.com",
          orderId: `shop_${Date.now()}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize session');
      }

      // 2. Initialize checkout
      const cashfree = new Cashfree({
        mode: "sandbox", // TODO: Make this dynamic from settings if needed
      });

      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self", // Or "_modal"
      }).then((result: any) => {
        if (result.error) {
          console.error("Cashfree Payment Error:", result.error);
          toast.error(result.error.message);
          setIsProcessingPayment(false);
        }
        if (result.redirect) {
          // This will be handled by the redirect_url set in backend
          console.log("Redirecting to Cashfree...");
        }
      });

    } catch (err: any) {
      console.error('Cashfree Init Error:', err);
      toast.error(err.message || 'Could not initialize Cashfree');
      setIsProcessingPayment(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, categoryFilter]);

  const handlePlaceOrder = async () => {
    if (!user || cart.length === 0) return;
    
    let addressObj = profile?.savedAddresses?.find((a: any) => a.id === selectedAddressId);
    
    if (!addressObj && profile?.savedAddresses?.length > 0) {
      addressObj = profile.savedAddresses[0];
    }

    if (!addressObj) {
      toast.error('Please add a delivery address first');
      setIsAddressModalOpen(true);
      return;
    }

    if (paymentMethod === 'Online') {
      handleOnlinePayment(addressObj);
    } else {
      finalizeOrder('COD', addressObj);
    }
  };

  const handleAddNewAddress = async () => {
    if (!user) return;
    if (!newAddress.mobile || !newAddress.line1 || !newAddress.pincode) {
      toast.error('Please fill required fields');
      return;
    }

    const addressRecord = {
      ...newAddress,
      id: Date.now().toString(),
    };

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        savedAddresses: arrayUnion(addressRecord)
      });
      toast.success('Address added');
      setSelectedAddressId(addressRecord.id);
      setIsAddressModalOpen(false);
      setNewAddress({
        farmName: '',
        line1: '',
        area: '',
        locality: '',
        district: '',
        state: '',
        pincode: '',
        name: '',
        mobile: '',
        type: 'Farm'
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const fixImageUrl = (url: string) => {
    if (!url) return 'https://placehold.co/400x400?text=Product';
    return url;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Success Overlay */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2 size={48} />
            </motion.div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Order Confirmed!</h2>
            <p className="text-slate-500 mb-8 max-w-xs">Your order has been placed successfully and will be processed soon.</p>
            
            <div className="space-y-4 w-full max-w-xs">
              <Button 
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                onClick={() => navigate('/orders')}
              >
                Go to Orders Now
              </Button>
              <p className="text-xs text-slate-400">
                Redirecting to order page in <span className="font-bold text-emerald-600 font-mono text-sm">{countdown}</span> seconds...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {currentView === 'details' && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentView('catalog')}>
              <X size={20} />
            </Button>
          )}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Search Feed, Medicine, Chicks..." 
              className="pl-10 h-10 bg-slate-100/50 border-none rounded-full focus-visible:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger render={
              <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-slate-100">
                <ShoppingCart size={22} className="text-slate-600" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </Button>
            } />
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
              <SheetHeader className="p-6 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingCart className="text-emerald-600" />
                  Your Cart ({cart.length})
                </SheetTitle>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                    <ShoppingBag size={64} className="mb-4 opacity-20" />
                    <p className="font-medium">Your cart is empty</p>
                    <Button variant="link" className="text-emerald-600" onClick={() => setIsCartOpen(false)}>Start Shopping</Button>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.cartId} className="flex gap-4 p-3 bg-white border rounded-2xl">
                      <img src={fixImageUrl(item.imageUrl)} alt={item.name} className="w-20 h-20 object-cover rounded-xl border" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold break-words pr-4">{item.name}</h4>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removeFromCart(item.cartId)}>
                            <X size={14} />
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">Variant: {item.selectedVariant?.name || 'Standard'}</p>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-emerald-600">₹{item.price.toLocaleString()}</p>
                          <div className="flex items-center border rounded-lg overflow-hidden">
                            <button className="p-1 hover:bg-slate-100" onClick={() => updateQuantity(item.cartId, -1)}><Minus size={14} /></button>
                            <span className="px-3 text-xs font-bold">{item.quantity}</span>
                            <button className="p-1 hover:bg-slate-100" onClick={() => updateQuantity(item.cartId, 1)}><Plus size={14} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 bg-white border-t space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold">₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Delivery</span>
                      <span className="text-emerald-600 font-bold">FREE</span>
                    </div>
                    <div className="pt-2 border-t space-y-2">
                       {profile?.walletBalance !== undefined && (profile.walletBalance > 0 || profile.rewardBalance > 0) && (
                        <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${useWallet ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`} onClick={() => setUseWallet(!useWallet)}>
                           <div className="flex items-center gap-2">
                              <Wallet className={`h-4 w-4 ${useWallet ? 'text-emerald-600' : 'text-slate-400'}`} />
                              <div className="text-left">
                                 <p className="text-[10px] font-black italic uppercase text-slate-700">Use Wallet Balance</p>
                                 <p className="text-[9px] font-bold italic text-slate-400">Available: ₹{profile.walletBalance}</p>
                              </div>
                           </div>
                           <Switch checked={useWallet} onCheckedChange={setUseWallet} className="scale-75 data-[state=checked]:bg-emerald-600" />
                        </div>
                       )}

                       {useWallet && walletAmount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 italic font-bold">
                           <span>Wallet Discount</span>
                           <span>- ₹{walletAmount.toLocaleString()}</span>
                        </div>
                       )}

                      <div className="flex justify-between items-center pt-2">
                        <span className="font-bold text-lg">Total</span>
                        <span className="text-xl font-bold text-emerald-600 flex items-center">
                          <IndianRupee size={18} />
                          {(cartTotal - walletAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between cursor-pointer" onClick={() => setIsAddressModalOpen(true)}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <MapPin size={16} className="text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Deliver to</p>
                          <p className="text-xs font-bold truncate">
                            {selectedAddressId ? profile?.savedAddresses?.find(a => a.id === selectedAddressId)?.farmName || 'Selected Address' : 'Choose Address'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Payment Method</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setPaymentMethod('COD')}
                          className={`p-3 rounded-xl border-2 text-[10px] font-bold transition-all ${
                            paymentMethod === 'COD' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          CASH ON DELIVERY
                        </button>
                        <button 
                          onClick={() => setPaymentMethod('Online')}
                          className={`p-3 rounded-xl border-2 text-[10px] font-bold transition-all ${
                            paymentMethod === 'Online' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          ONLINE PAYMENT
                        </button>
                      </div>
                    </div>

                    <Button 
                      className={`w-full py-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg ${isProcessingPayment ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={handlePlaceOrder}
                    >
                      {isProcessingPayment ? 'Processing...' : `Place Order (${paymentMethod})`}
                    </Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {currentView === 'catalog' ? (
        <>
          {/* Category Slider */}
          <section className="bg-white px-4 py-4 space-y-3 shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categories</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`flex flex-col items-center gap-2 min-w-[70px] p-2 rounded-2xl transition-all ${
                    categoryFilter === cat.name ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all overflow-hidden ${
                    categoryFilter === cat.name ? 'border-emerald-500 bg-emerald-100' : 'border-slate-100 bg-slate-50'
                  }`}>
                    {cat.iconUrl ? (
                      <img src={cat.iconUrl} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      cat.icon || <Package size={18} />
                    )}
                  </div>
                  <span className="text-[10px] font-bold truncate max-w-[64px]">{cat.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Product List - Flipkart Style */}
          <main className="max-w-7xl mx-auto p-4 space-y-3">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <ShoppingBag size={64} className="mx-auto text-slate-200" />
                <h3 className="text-xl font-bold text-slate-900">No products found</h3>
                <p className="text-slate-500">Try a different category or search term</p>
              </div>
            ) : (
              filteredItems.map(item => (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm flex items-center cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => { 
                    setSelectedItem(item); 
                    setSelectedVariant(item.variants?.[0] || null); 
                    setCurrentView('details');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="w-1/3 aspect-square relative bg-slate-50 flex-shrink-0">
                    <img src={fixImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-contain p-2" />
                    {item.discountPercentage > 0 && (
                      <Badge className="absolute top-2 left-2 bg-emerald-500 border-none font-bold text-[8px]">
                        {item.discountPercentage}% OFF
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 p-4 min-w-0 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm text-slate-900 break-words leading-tight group-hover:text-emerald-600 transition-colors uppercase">{item.name}</h3>
                        <div className="flex items-center gap-0.5 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-lg text-[10px] font-bold shrink-0">
                          {item.rating || '4.5'} <Star size={10} className="fill-current" />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2">
                        {item.variants ? `${item.variants.length} Variants available` : item.unit}
                      </p>
                      
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-slate-900 flex items-center">
                          <IndianRupee size={14} />
                          {item.price.toLocaleString()}
                        </span>
                        {item.mrp && (
                          <span className="text-[10px] text-slate-400 line-through">₹{item.mrp.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-medium text-slate-600">Free Delivery</span>
                    </div>
                  </div>
                  <div className="pr-4">
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))
            )}
          </main>
        </>
      ) : (
        <div className="max-w-4xl mx-auto bg-white min-h-screen">
          {selectedItem && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="pb-32"
            >
              <div className="relative aspect-square bg-slate-50">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={selectedItem.currentImageUrl || selectedItem.imageUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    src={fixImageUrl(selectedItem.currentImageUrl || selectedItem.imageUrl)} 
                    alt={selectedItem.name} 
                    className="w-full h-full object-contain p-8" 
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>
                <button 
                  className="absolute top-4 left-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-lg z-10" 
                  onClick={() => setCurrentView('catalog')}
                >
                  <ChevronRight size={24} className="rotate-180" />
                </button>

                {/* Multiple Images Indicator/Thumbnails */}
                {selectedItem.imageUrls && selectedItem.imageUrls.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto no-scrollbar pb-1">
                    {selectedItem.imageUrls.map((url: string, i: number) => (
                      <button 
                        key={i}
                        className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 ${
                          (selectedItem.currentImageUrl || selectedItem.imageUrl) === url ? 'border-emerald-500 bg-white' : 'border-white/50 bg-white/50'
                        }`}
                        onClick={() => setSelectedItem({...selectedItem, currentImageUrl: url})}
                      >
                        <img src={fixImageUrl(url)} alt={`View ${i}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 font-bold text-[10px] tracking-widest uppercase">
                      {selectedItem.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={12} className="fill-current" />
                      <span className="text-xs font-bold">{selectedItem.rating || '4.5'}</span>
                      <span className="text-slate-400 text-xs">(128 Reviews)</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2 break-words">{selectedItem.name}</h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">₹{selectedVariant ? selectedVariant.price.toLocaleString() : selectedItem.price.toLocaleString()}</span>
                      <span className="text-sm text-slate-400 font-medium">/ {selectedVariant ? selectedVariant.unit : selectedItem.unit}</span>
                    </div>
                    {selectedItem.mrp && (
                      <div className="space-y-0 text-left">
                        <p className="text-xs text-slate-400 line-through">MRP: ₹{selectedItem.mrp.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-emerald-600">{selectedItem.discountPercentage}% OFF</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedItem.variants && selectedItem.variants.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Variant</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.variants.map((v: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                            selectedVariant?.name === v.name 
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-600 shadow-sm' 
                              : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between cursor-pointer" onClick={() => setIsAddressModalOpen(true)}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-white p-2 rounded-xl shadow-sm text-emerald-600 flex-shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Deliver to</p>
                      <p className="text-xs font-bold truncate">
                        {selectedAddressId ? profile?.savedAddresses?.find(a => a.id === selectedAddressId)?.farmName || 'Selected Location' : 'Select Delivery Location'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 flex-shrink-0" />
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Details</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {selectedItem.description || "High-quality farm supply tested for maximum results."}
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl flex items-center gap-3">
                  <Truck size={20} className="text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-600">Free Delivery</p>
                    <p className="text-[10px] text-emerald-600/70">Estimated delivery within 2-3 business days</p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div 
                className={`fixed bottom-[64px] md:bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 flex gap-4 transition-all duration-300 z-[45] ${isSidebarOpen ? 'md:left-64' : 'md:left-0'}`}
              >
                <div className="max-w-4xl mx-auto w-full flex gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 py-6 rounded-2xl border-emerald-600 text-emerald-600 font-bold gap-2 hover:bg-emerald-50"
                    onClick={() => addToCart(selectedItem, selectedVariant)}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </Button>
                  <Button 
                    className="flex-1 py-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 font-bold gap-2 text-white"
                    onClick={() => { 
                      addToCart(selectedItem, selectedVariant); 
                      setIsCartOpen(true); 
                    }}
                  >
                    Buy Now
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Address Selection Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="rounded-[2rem] max-w-md p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Select Delivery Address</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
            {profile?.savedAddresses?.map((addr: any) => (
              <div 
                key={addr.id} 
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedAddressId === addr.id ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-100 hover:border-slate-300'
                }`}
                onClick={() => setSelectedAddressId(addr.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{addr.farmName}</p>
                    <Badge variant="outline" className="text-[10px]">{addr.type}</Badge>
                  </div>
                  {selectedAddressId === addr.id && <CheckCircle2 size={18} className="text-emerald-500" />}
                </div>
                <p className="text-xs text-slate-500 mt-1">{addr.line1}, {addr.locality}</p>
                <p className="text-xs text-slate-500">{addr.district}, {addr.state} - {addr.pincode}</p>
                <p className="text-[10px] font-bold text-slate-900 mt-2">{addr.name} | {addr.mobile}</p>
              </div>
            ))}

            <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-4">
              <p className="text-sm font-bold text-slate-900">Add New Delivery Location</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Full Name</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.name} onChange={e => setNewAddress({...newAddress, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Mobile Number</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.mobile} onChange={e => setNewAddress({...newAddress, mobile: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Farm/Shop Name</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.farmName} onChange={e => setNewAddress({...newAddress, farmName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Address Type</Label>
                  <Select value={newAddress.type} onValueChange={v => setNewAddress({...newAddress, type: v})}>
                    <SelectTrigger className="h-9 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Farm">Farm</SelectItem>
                      <SelectItem value="Home">Home</SelectItem>
                      <SelectItem value="Shop">Shop</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Address (Line 1, Locality)</Label>
                <Input className="h-9 rounded-lg" value={newAddress.line1} onChange={e => setNewAddress({...newAddress, line1: e.target.value})} placeholder="e.g. Near Shiv Temple, Main Road" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Locality/Area</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.locality} onChange={e => setNewAddress({...newAddress, locality: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">Pincode</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.pincode} onChange={e => setNewAddress({...newAddress, pincode: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">District</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.district} onChange={e => setNewAddress({...newAddress, district: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-400">State</Label>
                  <Input className="h-9 rounded-lg" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} />
                </div>
              </div>
              <Button className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={handleAddNewAddress}>Save Delivery Address</Button>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-slate-50">
            <Button className="w-full h-12 rounded-xl bg-slate-900" onClick={() => setIsAddressModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shop;
