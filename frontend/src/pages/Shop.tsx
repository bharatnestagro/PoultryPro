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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
  Wallet,
  AlertTriangle,
  Info,
  PlusCircle,
  CreditCard,
  Copy,
  Check,
  Upload
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'motion/react';
import LoginModal from '@/src/components/LoginModal';

const Shop: React.FC = () => {
  const { user, profile } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { isSidebarOpen } = useOutletContext<{ isSidebarOpen: boolean }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'All', name: 'All', icon: <LayoutGrid size={18} /> }]);
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentView, setCurrentView] = useState<'catalog' | 'details' | 'cart' | 'checkout'>('catalog');
  const [checkoutStep, setCheckoutStep] = useState<'information' | 'payment'>('information');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  
  const checkAccess = (action: () => void) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    action();
  };

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
    const q = query(
      collection(db, 'shopItems'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as any[];
      let filtered;
      if (profile?.assignedManagerId) {
        // Show manager's items
        const managerItems = allItems.filter(item => item.managerId === profile.assignedManagerId);
        
        // Track which admin items have been imported/personalized by this manager
        const importedAdminIds = new Set(managerItems.map(m => (m as any).originalAdminProductId).filter(id => id));
        
        // Find admin items that HAVEN'T been imported by this manager yet
        const adminItems = allItems.filter(item => (!item.managerId || item.managerId === 'admin' || item.managerId === '') && !importedAdminIds.has(item.id));
        
        // Combine them - prioritizing manager's custom pricing/items
        filtered = [...managerItems, ...adminItems];
      } else {
        // Show products added by admin
        filtered = allItems.filter(item => !item.managerId || item.managerId === 'admin' || item.managerId === '');
      }
      setItems(filtered);
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
  const hasSpecialItems = useMemo(() => cart.some(item => item.isHeavy || item.isLiveStock || item.isByRoad), [cart]);
  const hasHeavyItems = useMemo(() => cart.some(item => item.isHeavy), [cart]);
  const hasLiveStock = useMemo(() => cart.some(item => item.isLiveStock), [cart]);
  const hasByRoadItems = useMemo(() => cart.some(item => item.isByRoad), [cart]);
  const [useWallet, setUseWallet] = useState(false);
  const walletAmount = useMemo(() => {
    const totalBalance = (profile?.walletBalance || 0) + (profile?.rewardBalance || 0);
    if (!useWallet || totalBalance <= 0) return 0;
    return Math.min(totalBalance, cartTotal);
  }, [useWallet, profile?.walletBalance, profile?.rewardBalance, cartTotal]);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Online' | 'UPI'>('COD');
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [upiScreenshot, setUpiScreenshot] = useState<string>('');
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<any>(null);
  const [upiTxnId, setUpiTxnId] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [deliverySettings, setDeliverySettings] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setCartTotal(total);
  }, [cart]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
      let rzpEnabled = false;
      let cfEnabled = false;

      if (snap.exists()) {
        const settings = snap.data();
        setSystemSettings(settings);
        rzpEnabled = !!settings.paymentGateways?.razorpay?.enabled;
        cfEnabled = !!settings.paymentGateways?.cashfree?.enabled;
      }

      // Load Scripts from Firestore state or direct Env fallbacks
      if ((rzpEnabled || !!(import.meta as any).env.VITE_RAZORPAY_KEY_ID) && !document.getElementById('razorpay-sdk')) {
        const script = document.createElement('script');
        script.id = 'razorpay-sdk';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
      
      if ((cfEnabled) && !document.getElementById('cashfree-sdk')) {
        const script = document.createElement('script');
        script.id = 'cashfree-sdk';
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'system/settings');
    });

    const fetchDeliverySettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'deliverySettings'));
        if (snap.exists()) setDeliverySettings(snap.data());
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'system/deliverySettings');
      }
    };
    fetchDeliverySettings();

    return () => unsubSettings();
  }, []);

  const finalizeOrder = async (method: 'COD' | 'Online' | 'UPI', address: any, transactionId?: string, upiScreenshotUrl?: string) => {
    if (!user) {
      toast.error('User session expired. Please log in again.');
      return;
    }

    try {
      const { writeBatch, Timestamp, doc, runTransaction } = await import('firebase/firestore');
      
      // 1. Get sequential Order ID
      const counterRef = doc(db, 'counters', 'orders');
      let orderNumber = 100001;
      
      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        if (counterSnap.exists()) {
          orderNumber = counterSnap.data().lastId + 1;
        }
        transaction.set(counterRef, { lastId: orderNumber }, { merge: true });
      });

      const batch = writeBatch(db);
      
      const orderId = `${Date.now()}`;
      const orderRef = doc(db, 'orders', orderId);
      
      const finalAmount = cartTotal - (useWallet ? walletAmount : 0);

      batch.set(orderRef, {
        orderId: orderNumber.toString(), // Numeric 6-digit ID
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
        status: hasSpecialItems ? 'Verifying' : 'Pending',
        totalAmount: cartTotal,
        walletDiscount: useWallet ? walletAmount : 0,
        paidAmount: finalAmount,
        deliveryCharge: 0,
        deliveryPaymentStatus: 'Unpaid',
        deliveryAddress: address || null,
        paymentMethod: method === 'COD' ? 'Cash on Delivery' : method === 'UPI' ? 'UPI Payment' : 'Online Payment',
        paymentStatus: method === 'Online' ? 'Paid' : method === 'UPI' ? 'payment_pending_verification' : 'Pending',
        transactionId: transactionId || '',
        upiScreenshotUrl: upiScreenshotUrl || '',
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
    const hasEnvRazorpay = !!(import.meta as any).env.VITE_RAZORPAY_KEY_ID;

    if (!gateways && !hasEnvRazorpay) {
      toast.error('Online payment system is not configured');
      return;
    }

    // Check for enabled gateway preference or just pick first enabled
    if (gateways?.cashfree?.enabled) {
      handleCashfreePayment(address);
    } else if (gateways?.razorpay?.enabled || hasEnvRazorpay) {
      handleRazorpayPayment(address);
    } else if (gateways?.payu?.enabled) {
      handlePayUPayment(address);
    } else {
      toast.error('Online payment is currently unavailable. No gateway is enabled.');
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

  const handleRazorpayPayment = async (address: any) => {
    setIsProcessingPayment(true);
    
    try {
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: cartTotal,
          gateway: "razorpay",
          customerEmail: user?.email,
          customerPhone: profile?.mobile || address?.mobile
        })
      });
      
      const orderData = await safeParseJson(orderRes);
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create Razorpay order");

      const options = {
        key: systemSettings?.paymentGateways?.razorpay?.apiKey || (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Bharat Nest Agro",
        description: "Supply Order Payment",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await safeParseJson(verifyRes);
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment signature verification failed");
            }

            finalizeOrder('Online', address, response.razorpay_payment_id);
          } catch (verifyErr: any) {
            console.error("Razorpay Signature Verification Failure:", verifyErr);
            toast.error(verifyErr.message || "Failed to verify transaction signature. Please contact admin.");
            setIsProcessingPayment(false);
          }
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
      if (!Razorpay) throw new Error("Razorpay SDK not loaded. Check your internet or configuration.");
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Razorpay payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setIsProcessingPayment(false);
      });
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

      // 1. Create Session via Vercel API Route
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cartTotal,
          gateway: "cashfree",
          customerId: user?.uid || "guest",
          customerPhone: profile?.mobile || address?.mobile || "9999999999",
          customerEmail: user?.email || "customer@example.com",
          orderId: `shop_${Date.now()}`
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

      // 2. Initialize checkout
      const mode = systemSettings?.paymentGateways?.cashfree?.mode === "production" ? "production" : "sandbox";
      const cf = new Cashfree({
        mode: mode,
      });

      if (!data.payment_session_id) {
        throw new Error("No payment session ID received from server. Check Cashfree configuration.");
      }

      cf.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self", 
      }).then((result: any) => {
        if (result.error) {
          console.error("Cashfree Payment Error:", result.error);
          toast.error(result.error.message);
          setIsProcessingPayment(false);
        }
      });

    } catch (err: any) {
      console.error('Cashfree Init Error:', err);
      toast.error(err.message || 'Could not initialize Cashfree');
      setIsProcessingPayment(false);
    }
  };

  const handlePayUPayment = async (address: any) => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cartTotal,
          gateway: "payu",
          customerEmail: user?.email || "customer@example.com",
          customerPhone: profile?.mobile || address?.mobile,
          orderId: `payu_${Date.now()}`
        })
      });

      const data = await safeParseJson(response);
      if (!response.ok) throw new Error(data.error || "Failed to initialize PayU");

      // PayU requires a form POST redirect
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action;

      const fields = {
        key: data.merchantKey,
        txnid: data.txnid,
        amount: data.amount,
        productinfo: data.productinfo,
        firstname: data.firstname,
        email: data.email,
        phone: profile?.mobile || address?.mobile || "9999999999",
        surl: `${window.location.origin}/transactions?status=success&order_id=${data.txnid}`,
        furl: `${window.location.origin}/transactions?status=failure&order_id=${data.txnid}`,
        hash: data.hash,
        service_provider: 'payu_paisa'
      };

      for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      console.error('PayU Init Error:', err);
      toast.error(err.message || 'Could not initialize PayU');
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
    } else if (paymentMethod === 'UPI') {
      const uniqueTxnRef = `UPI${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      setUpiTxnId(uniqueTxnRef);
      setPendingAddress(addressObj);
      setUpiScreenshot(''); // reset screenshot state
      setIsUpiModalOpen(true);
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
          {(currentView === 'checkout' || currentView === 'cart') && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentView('catalog')}>
              <RotateCcw size={20} />
            </Button>
          )}
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
          <Button 
            variant="ghost" 
            size="icon" 
            className={`relative rounded-full hover:bg-slate-100 ${currentView === 'cart' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600'}`}
            onClick={() => setCurrentView(currentView === 'cart' ? 'catalog' : 'cart')}
          >
            <ShoppingCart size={22} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </Button>
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
                      <img src={fixImageUrl(cat.iconUrl)} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
      ) : currentView === 'cart' ? (
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-16 bg-white min-h-screen">
          <h1 className="text-3xl font-medium text-slate-900 mb-12">Your cart</h1>

          {cart.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-slate-500 mb-8">Your cart is currently empty.</p>
              <Button onClick={() => setCurrentView('catalog')} className="bg-black text-white hover:bg-slate-800 px-8 py-6 rounded-none uppercase text-xs tracking-widest transition-all">
                Continue shopping
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-8">
                {/* Table Header - Desktop only */}
                <div className="hidden md:grid grid-cols-12 pb-4 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-medium">
                  <div className="col-span-12 md:col-span-7">Product</div>
                  <div className="col-span-12 md:col-span-2 text-center">Quantity</div>
                  <div className="col-span-12 md:col-span-3 text-right">Total</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.cartId} className="py-8 grid grid-cols-12 gap-4 md:gap-0 items-center">
                      {/* Product Detail */}
                      <div className="col-span-12 md:col-span-7 flex gap-6">
                        <div className="w-24 h-24 bg-slate-50 border border-slate-100 flex-shrink-0">
                          <img src={fixImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-contain p-2" />
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                          <h3 className="text-sm font-medium text-slate-900">{item.name}</h3>
                          <p className="text-xs text-slate-500">{item.selectedVariant?.name || 'Standard'}</p>
                          <p className="text-xs text-slate-900 mt-1">₹{item.price.toLocaleString()}</p>
                          <button 
                            onClick={() => removeFromCart(item.cartId)}
                            className="text-[10px] text-slate-400 hover:text-red-500 underline text-left mt-2 uppercase tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Quantity Selector */}
                      <div className="col-span-6 md:col-span-2 flex justify-start md:justify-center">
                        <div className="flex items-center border border-slate-200">
                          <button className="p-2 hover:bg-slate-50 text-slate-400" onClick={() => updateQuantity(item.cartId, -1)}><Minus size={14} /></button>
                          <span className="px-4 text-xs font-medium w-10 text-center">{item.quantity}</span>
                          <button className="p-2 hover:bg-slate-50 text-slate-400" onClick={() => updateQuantity(item.cartId, 1)}><Plus size={14} /></button>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="col-span-6 md:col-span-3 text-right">
                        <p className="text-sm font-medium text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-4 bg-slate-50 p-8 h-fit">
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="text-sm font-medium capitalize">Subtotal</span>
                    <span className="text-lg font-medium">₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Taxes and shipping calculated at checkout. Delivery fees for heavy freight (Chicks, Feed) will be finalized after order verification.
                  </p>
                  
                  <div className="pt-4 space-y-3">
                    <Button 
                      className="w-full bg-black text-white hover:bg-slate-800 py-7 rounded-none uppercase text-xs tracking-[0.2em] transition-all font-medium"
                      onClick={() => checkAccess(() => setCurrentView('checkout'))}
                    >
                      Check out
                    </Button>
                    <div className="flex justify-center">
                       <button onClick={() => setCurrentView('catalog')} className="text-xs text-slate-400 hover:text-slate-900 underline underline-offset-4 font-medium transition-colors">
                         Continue shopping
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : currentView === 'checkout' ? (
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row min-h-screen bg-white">
          {/* Main Checkout Form Area */}
          <div className="flex-1 px-4 py-8 md:p-16 lg:pr-24 border-r border-slate-100">
            <div className="max-w-xl mx-auto lg:ml-auto lg:mr-0 space-y-12">
              <header className="space-y-4">
                <h1 className="text-2xl font-light text-slate-900 tracking-tight">Checkout</h1>
                <nav className="flex gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                  <button onClick={() => setCurrentView('cart')} className="hover:text-slate-900 transition-colors">Cart</button>
                  <span>/</span>
                  <button 
                    onClick={() => setCheckoutStep('information')} 
                    className={`transition-colors ${checkoutStep === 'information' ? 'text-slate-900' : 'hover:text-slate-900'}`}
                  >
                    Information
                  </button>
                  <span>/</span>
                  <button 
                    onClick={() => selectedAddressId && setCheckoutStep('payment')} 
                    className={`transition-colors ${checkoutStep === 'payment' ? 'text-slate-900' : 'hover:text-slate-900'} ${!selectedAddressId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!selectedAddressId}
                  >
                    Payment
                  </button>
                </nav>
              </header>

              {checkoutStep === 'information' ? (
                /* Section 1: Contact & Shipping */
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-900">Shipping address</h3>
                      {selectedAddressId && (
                        <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-100">Validated</Badge>
                      )}
                    </div>
                    
                    {selectedAddressId ? (
                      <div className="p-6 border border-slate-200 flex items-center justify-between group rounded-2xl bg-slate-50/30">
                        <div className="flex items-center gap-4">
                          <MapPin size={18} className="text-emerald-500" />
                          <div className="text-xs text-slate-600 leading-relaxed font-normal">
                            {(() => {
                              const addr = profile?.savedAddresses?.find((a: any) => a.id === selectedAddressId);
                              return (
                                <>
                                  <p className="font-bold text-slate-900">{addr?.farmName || addr?.name}</p>
                                  <p>{addr?.line1}, {addr?.locality}</p>
                                  <p>{addr?.district}, {addr?.state} - {addr?.pincode}</p>
                                  <p className="mt-2 font-medium text-slate-400">{addr?.name} | {addr?.mobile}</p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <Button variant="ghost" onClick={() => setIsAddressModalOpen(true)} className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 underline uppercase tracking-widest px-4 h-10 rounded-xl transition-all">Change</Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => setIsAddressModalOpen(true)}
                        className="w-full h-20 border-2 border-dashed border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all bg-white text-xs uppercase tracking-widest font-black rounded-3xl"
                      >
                        Select delivery location
                      </Button>
                    )}
                  </div>

                  <div className="pt-8">
                    <Button 
                      disabled={!selectedAddressId}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 py-8 rounded-2xl uppercase text-[10px] tracking-[0.2em] transition-all font-black disabled:opacity-30 flex items-center justify-center gap-2"
                      onClick={() => setCheckoutStep('payment')}
                    >
                      Continue to Payment
                      <ChevronRight size={14} />
                    </Button>
                    <div className="flex justify-center mt-6">
                      <button onClick={() => setCurrentView('cart')} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 font-bold transition-colors">Return to cart</button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Section 2: Payment */
                <div className="space-y-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-slate-400" />
                      <div className="text-[10px] text-slate-600 font-medium">
                        {profile?.savedAddresses?.find((a: any) => a.id === selectedAddressId)?.farmName}
                      </div>
                    </div>
                    <button onClick={() => setCheckoutStep('information')} className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest hover:underline">Change</button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-900">Payment method</h3>
                    <p className="text-[11px] text-slate-500">All transactions are secure and encrypted.</p>
                    
                    <div className="border border-slate-200 divide-y divide-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      {systemSettings?.paymentGateways?.cashOnDelivery?.enabled === true && (
                        <button 
                          onClick={() => setPaymentMethod('COD')}
                          className={`w-full flex items-center justify-between p-6 transition-all text-left ${
                            paymentMethod === 'COD' ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'COD' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'COD' && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">Cash on Delivery (COD)</span>
                              <span className="text-[10px] text-slate-500 font-medium">Pay when you receive the order</span>
                            </div>
                          </div>
                        </button>
                      )}

                      {systemSettings?.paymentGateways?.upi?.enabled === true && (
                        <button 
                          onClick={() => setPaymentMethod('UPI')}
                          className={`w-full flex items-center justify-between p-6 transition-all text-left ${
                            paymentMethod === 'UPI' ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'UPI' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'UPI' && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                                {systemSettings.paymentGateways.upi.displayName || 'UPI Payment'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">Pay directly via Google Pay, PhonePe, Paytm, BHIM, etc.</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 tracking-wider">UPI</span>
                          </div>
                        </button>
                      )}

                      {(systemSettings?.paymentGateways?.razorpay?.enabled === true || 
                        !!(import.meta as any).env.VITE_RAZORPAY_KEY_ID ||
                        systemSettings?.paymentGateways?.cashfree?.enabled === true || 
                        systemSettings?.paymentGateways?.payu?.enabled === true) && (
                        <button 
                          onClick={() => setPaymentMethod('Online')}
                          className={`w-full flex items-center justify-between p-6 transition-all text-left ${
                            paymentMethod === 'Online' ? 'bg-emerald-50/50' : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${paymentMethod === 'Online' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {paymentMethod === 'Online' && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">Online Payment</span>
                              <span className="text-[10px] text-slate-500 font-medium">Razorpay / Cashfree Secure Checkout</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                             <CreditCard size={18} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 space-y-4">
                    <Button 
                      disabled={isProcessingPayment}
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 py-8 rounded-2xl uppercase text-[10px] tracking-[0.2em] transition-all font-black shadow-lg shadow-emerald-900/10"
                      onClick={handlePlaceOrder}
                    >
                      {isProcessingPayment ? 'Processing Transaction...' : 'Complete Purchase'}
                    </Button>
                    <div className="flex justify-center mt-6">
                      <button onClick={() => setCheckoutStep('information')} className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 font-bold transition-colors">Return to information</button>
                    </div>
                  </div>
                </div>
              )}

              <footer className="pt-12 border-t border-slate-100 flex flex-wrap gap-4 text-[9px] text-slate-400 uppercase tracking-widest font-medium">
                 {systemSettings?.termsList && Array.isArray(systemSettings.termsList) && systemSettings.termsList.map((term: any) => (
                   <Dialog key={term.id}>
                     <DialogTrigger asChild>
                       <button className="hover:text-slate-900 transition-colors">{term.title}</button>
                     </DialogTrigger>
                     <DialogContent className="rounded-[2rem] sm:max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                       <DialogHeader className="p-8 pb-4">
                         <DialogTitle className="text-2xl font-black italic">{term.title}</DialogTitle>
                         <DialogDescription>Effective from {new Date(term.createdAt).toLocaleDateString()}</DialogDescription>
                       </DialogHeader>
                       <div className="flex-1 overflow-y-auto px-8 pb-8">
                         <div className="prose prose-slate max-w-none">
                           <div className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                             {term.content}
                           </div>
                         </div>
                       </div>
                     </DialogContent>
                   </Dialog>
                 ))}
                 {!systemSettings?.termsList?.length && (
                   <>
                     <button className="hover:text-slate-900 transition-colors">Refund policy</button>
                     <button className="hover:text-slate-900 transition-colors">Shipping policy</button>
                     <button className="hover:text-slate-900 transition-colors">Privacy policy</button>
                   </>
                 )}
              </footer>
            </div>
          </div>

          {/* Sidebar Order Summary */}
          <div className="w-full lg:w-[450px] bg-slate-50 px-4 py-8 md:p-16 min-h-screen">
            <div className="max-w-md mx-auto space-y-8">
              <div className="divide-y divide-slate-200">
                {cart.map(item => (
                  <div key={item.cartId} className="py-4 flex gap-4 items-center group">
                    <div className="relative w-16 h-16 bg-white border border-slate-200 flex-shrink-0 rounded-lg">
                      <img src={fixImageUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-contain p-2" />
                      <span className="absolute -top-2 -right-2 bg-slate-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.selectedVariant?.name || 'Standard'}</p>
                    </div>
                    <p className="text-sm font-medium text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 space-y-3">
                <div className="flex justify-between text-xs text-slate-600 font-normal">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">₹{cartTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 font-normal">
                  <span>Shipping</span>
                  <span className="text-slate-400 italic">Calculated at next step</span>
                </div>
                <div className="pt-4 flex justify-between items-center text-slate-900">
                  <span className="text-base font-medium">Total</span>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 mr-2 uppercase tracking-widest font-normal">INR</span>
                    <span className="text-xl font-medium">₹{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                {selectedItem.imageUrls && Array.isArray(selectedItem.imageUrls) && selectedItem.imageUrls.filter(u => u).length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto no-scrollbar pb-1">
                    {selectedItem.imageUrls.filter((u: string) => u).map((url: string, i: number) => (
                      <button 
                        key={i}
                        className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 bg-white shadow-md ${
                          (selectedItem.currentImageUrl || selectedItem.imageUrl) === url ? 'border-emerald-500 scale-110' : 'border-white'
                        }`}
                        onClick={() => setSelectedItem({...selectedItem, currentImageUrl: url})}
                      >
                        <img src={fixImageUrl(url)} alt={`View ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                    onClick={() => checkAccess(() => addToCart(selectedItem, selectedVariant))}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </Button>
                  <Button 
                    className="flex-1 py-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 font-bold gap-2 text-white"
                    onClick={() => checkAccess(() => { 
                      addToCart(selectedItem, selectedVariant); 
                      setIsCartOpen(true); 
                    })}
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
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
      />
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

      {/* UPI Payment Modal */}
      <Dialog open={isUpiModalOpen} onOpenChange={setIsUpiModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg p-0 overflow-hidden flex flex-col bg-slate-50 border-none shadow-2xl">
          <DialogHeader className="p-8 pb-4 bg-white/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="text-left w-full pr-8">
              <DialogTitle className="text-lg font-black tracking-wider uppercase italic text-indigo-950">
                {systemSettings?.paymentGateways?.upi?.displayName || 'UPI Payment'}
              </DialogTitle>
              <DialogDescription className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">
                Order Reference: <span className="font-mono font-bold text-slate-900">{upiTxnId}</span>
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-h-[60vh]">
            {/* Total Price Display */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-950 rounded-3xl p-6 text-white text-center shadow-lg shadow-indigo-900/10">
              <span className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-black italic">Amount Payable</span>
              <h2 className="text-3xl font-black italic mt-1 pb-1">₹{(cartTotal - (useWallet ? walletAmount : 0)).toLocaleString()}</h2>
              <div className="w-12 h-1 bg-white/10 mx-auto my-3 rounded-full" />
              <p className="text-[10px] text-indigo-200/90 leading-relaxed font-semibold">
                Please transfer the exact amount. QR code and link are dynamically generated for your order.
              </p>
            </div>

            {/* Dynamic UPI Details & Copy */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-55">
                <div>
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Payee Name</span>
                  <p className="text-sm font-extrabold text-slate-900">{systemSettings?.paymentGateways?.upi?.displayName || 'BharatNest Agro'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Payment Network</span>
                  <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">BHIM UPI</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">UPI Virtual Private Address (VPA)</span>
                  <p className="text-xs font-mono font-bold text-slate-900 truncate mr-3">
                    {systemSettings?.paymentGateways?.upi?.upiId || 'N/A'}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const vpa = systemSettings?.paymentGateways?.upi?.upiId || '';
                    if (vpa) {
                      navigator.clipboard.writeText(vpa);
                      setIsCopied(true);
                      toast.success("UPI Address copied to clipboard!");
                      setTimeout(() => setIsCopied(false), 2000);
                    }
                  }}
                  className="px-3.5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 bg-white shrink-0 shadow-sm"
                >
                  {isCopied ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Dynamic QR Code & Direct Deeplink */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-150">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `upi://pay?pa=${systemSettings?.paymentGateways?.upi?.upiId || ''}&pn=${encodeURIComponent(systemSettings?.paymentGateways?.upi?.displayName || 'BharatNest Agro')}&am=${(cartTotal - (useWallet ? walletAmount : 0)).toFixed(2)}&cu=INR&tn=${encodeURIComponent(upiTxnId)}`
                  )}`}
                  alt="Dynamic UPI QR Code"
                  className="w-48 h-48 object-contain rounded-xl select-none"
                />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Scan with any UPI App</p>
                <p className="text-[9px] text-slate-500 font-medium leading-relaxed mt-1 max-w-xs mx-auto">
                  Scan this QR with Google Pay, PhonePe, Paytm, BHIM, or any banking portal to transact immediately.
                </p>
              </div>

              <div className="w-full pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    const payee = systemSettings?.paymentGateways?.upi?.displayName || 'BharatNest Agro';
                    const vpa = systemSettings?.paymentGateways?.upi?.upiId || '';
                    const amountValue = (cartTotal - (useWallet ? walletAmount : 0)).toFixed(2);
                    const deepLink = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payee)}&am=${amountValue}&cu=INR&tn=${encodeURIComponent(upiTxnId)}`;
                    window.location.href = deepLink;
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                >
                  <Copy size={14} />
                  Open UPI App & Pay
                </button>
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-2">Mobile Deep linking enabled</p>
              </div>
            </div>

            {/* Step-by-Step Helper Instructions */}
            <div className="bg-slate-150/30 p-5 rounded-3xl border border-slate-200/30 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-indigo-600 shrink-0" />
                <span className="text-[10px] text-indigo-950 font-black uppercase tracking-wider">Instructions:</span>
              </div>
              <ol className="list-decimal pl-4 text-[9px] text-slate-600 font-semibold space-y-1.5 leading-relaxed">
                <li>Scan the dynamic QR code OR tap <span className="text-indigo-600">"Open UPI App & Pay"</span>.</li>
                <li>Proceed with security confirmation inside your mobile UPI client app.</li>
                <li>Take a screenshot of the successful transaction receipt.</li>
                <li>Upload proof in the attachment drawer below (highly recommended).</li>
                <li>Hit <span className="text-slate-900">"I Have Completed Payment"</span> to trigger dispatch verification!</li>
              </ol>
            </div>

            {/* Image upload widget */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block font-bold">Upload Payment Screenshot</span>
              
              <label 
                htmlFor="upi-proof-upload" 
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 cursor-pointer p-6 rounded-2xl bg-slate-50/50 hover:bg-indigo-50/10 hover:border-indigo-300 transition-all group"
              >
                <Upload size={22} className="text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
                <span className="text-[10px] font-black uppercase text-slate-700 group-hover:text-indigo-950 transition-colors">
                  {isUploadingScreenshot ? 'Analyzing Image...' : 'Select Screenshot Receipt'}
                </span>
                <span className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">JPEG, PNG format (Max 4MB)</span>
              </label>
              <input 
                type="file" 
                accept="image/*" 
                id="upi-proof-upload" 
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setIsUploadingScreenshot(true);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setUpiScreenshot(reader.result as string);
                      setIsUploadingScreenshot(false);
                      toast.success("Verification receipt attached!");
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />

              {upiScreenshot && (
                <div className="relative border border-slate-250 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-between p-3.5 mt-2 animate-fade-in">
                  <div className="flex items-center gap-3 text-left">
                    <img 
                      src={upiScreenshot} 
                      alt="UPI screenshot" 
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm" 
                    />
                    <div>
                      <p className="text-[9px] font-extrabold uppercase text-slate-900 leading-none">Receipt attached</p>
                      <p className="text-[8px] text-slate-400 uppercase tracking-widest leading-none mt-1">Ready to finalize</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setUpiScreenshot('')}
                    className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-wider hover:underline"
                  >
                    Delete File
                  </button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-5 border-t border-slate-100 bg-white">
            <Button 
              disabled={isUploadingScreenshot || isProcessingPayment}
              className="w-full py-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white uppercase text-[10px] font-black tracking-[0.2em] shadow-lg shadow-indigo-600/10 active:scale-95 transition-all"
              onClick={async () => {
                setIsProcessingPayment(true);
                try {
                  await finalizeOrder('UPI', pendingAddress, upiTxnId, upiScreenshot);
                  setIsUpiModalOpen(false);
                } catch (err) {
                  toast.error("Failed to complete purchase. Try again!");
                } finally {
                  setIsProcessingPayment(false);
                }
              }}
            >
              {isProcessingPayment ? "Registering Transaction..." : "I Have Completed Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shop;
