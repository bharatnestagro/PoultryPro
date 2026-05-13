import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User, LogOut, Save, Building2, MapPin, Maximize2, Users, Trash2, Phone, Edit2, Plus, ShieldCheck, Shield, Key, CreditCard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShoppingCart, Bell, MapPinned, Database, Cloud, RefreshCw, FileText, Lock, Wallet, Trophy, Minus, AlertCircle, ShoppingBag } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { runBackup, checkAndRunAutoBackup } from '@/src/lib/backupManager';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth as firebaseAuth } from '@/src/lib/firebase';

const Profile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [managerData, setManagerData] = useState<{
    name: string; 
    phone: string;
    email: string;
    district?: string;
    state?: string;
  } | null>(null);

  // Collapsible states
  const [openSection, setOpenSection] = useState<string | null>(null);
  
  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [keyPrice, setKeyPrice] = useState<number | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'main' | 'reward'>('main');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activePurchaseTab, setActivePurchaseTab] = useState<'plans'|'challenges'>('plans');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [availableChallenges, setAvailableChallenges] = useState<any[]>([]);
  const [userChallenges, setUserChallenges] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'walletTransactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setWalletTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'challengePlans'), where('active', '==', true)), (snap) => {
      setAvailableChallenges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'userChallenges'), where('userId', '==', user.uid)), (snap) => {
      setUserChallenges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Query without orderBy first to avoid index requirements if not needed, 
    // or use 'date' if 'createdAt' is inconsistent.
    // We'll try to find any order for this user to show as "Last Order"
    const q = query(
      collection(db, 'orders'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Order fetch error:", err);
      // Fallback: try without ordering if index fails
      const fallbackQ = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        limit(1)
      );
      getDocs(fallbackQ).then(s => {
        setRecentOrders(s.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(fallbackErr => {
        handleFirestoreError(fallbackErr, OperationType.LIST, 'orders');
      });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
      const fetchSettings = async () => {
        try {
          const snap = await getDoc(doc(db, 'system', 'settings'));
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
      const scripts = document.querySelectorAll('script[src*="razorpay"], script[src*="cashfree"]');
      scripts.forEach(s => s.remove());
    };
  }, []);
  
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'purchase') {
      setShowPurchaseDialog(true);
      // Clean up the URL
      setSearchParams({}, { replace: true });
      setTimeout(() => {
        document.getElementById('license-activation-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    } else if (action === 'activate') {
      const element = document.getElementById('license-activation-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setSearchParams({}, { replace: true });
    } else if (action === 'manager') {
      const element = document.getElementById('manager-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const d = await getDoc(doc(db, 'settings', 'keyPricing'));
        if (d.exists()) setKeyPrice(d.data().price);
      } catch (e) { 
        handleFirestoreError(e, OperationType.GET, 'settings/keyPricing');
      }
    };
    fetchPricing();
  }, []);

  const finalizePurchase = async (selectedPlan: any, transactionId: string) => {
    try {
      const { writeBatch, Timestamp, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const isChallenge = !!selectedPlan.durationDays && !!selectedPlan.dailyReward;
      const cost = isChallenge ? (selectedPlan.cost || 0) : (selectedPlan.price || 0);

      // Handle Wallet Deduction if paid via wallet
      if (transactionId === 'WALLET_PAYMENT') {
        const userRef = doc(db, 'users', profile?.uid);
        let remainingToDeduct = cost;
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
      }
      
      if (isChallenge) {
        // Handle Challenge Purchase
        const participationId = `${profile?.uid}_${selectedPlan.id}`;
        batch.set(doc(db, 'userChallenges', participationId), {
          userId: profile?.uid,
          userName: profile?.name || 'Unknown',
          userPhone: profile?.phone || profile?.mobile || '',
          challengeId: selectedPlan.id,
          challengeTitle: selectedPlan.title,
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(addDays(new Date(), selectedPlan.durationDays), 'yyyy-MM-dd'),
          status: 'Active',
          dailyEntries: {},
          totalEarned: 0,
          createdAt: Timestamp.now()
        });

        const transId = Date.now().toString();
        batch.set(doc(db, 'walletTransactions', transId), {
          userId: profile?.uid,
          amount: -selectedPlan.cost,
          type: 'Debit',
          source: 'Challenge Reward',
          description: `Participated in Challenge: ${selectedPlan.title}`,
          referenceId: participationId,
          createdAt: Timestamp.now()
        });

        // Add to main transactions as well
        batch.set(doc(db, 'transactions', transId), {
          id: transId,
          userId: profile?.uid,
          amount: selectedPlan.cost,
          type: 'Expense',
          description: `Challenge Entry Fee: ${selectedPlan.title}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          createdAt: Timestamp.now()
        });

        toast.success(`Challenge "${selectedPlan.title}" activated!`);
      } else {
        // Handle License Purchase
        const newKey = `KEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const keyRef = doc(db, 'licenseKeys', newKey);
        batch.set(keyRef, {
          key: newKey,
          status: 'Active',
          createdAt: Timestamp.now(),
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          validityDays: selectedPlan.days || 365,
          price: selectedPlan.price,
          usedBy: profile?.uid,
          usedByEmail: profile?.email,
          activatedAt: Timestamp.now(),
          source: 'Online Purchase',
          transactionId: transactionId
        });

        const transId = Date.now().toString();
        batch.set(doc(db, 'transactions', transId), {
          id: transId,
          userId: profile?.uid,
          amount: selectedPlan.price,
          type: 'Expense',
          description: `License Purchase: ${selectedPlan.name}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          createdAt: Timestamp.now()
        });

        batch.update(doc(db, 'users', profile?.uid as string), {
          licenseActive: true,
          licenseKey: newKey,
          licenseActivatedAt: new Date().toISOString()
        });

        toast.success(`License "${selectedPlan.name}" activated!`);
      }

      await batch.commit();
      setShowPurchaseDialog(false);
      setPurchaseSuccess(true);
      setCountdown(3);
    } catch (e: any) {
      console.error('Finalize Purchase Error:', e);
      toast.error(`Failed to purchase: ${e.message}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!profile || !withdrawAmount) return;
    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    const balance = withdrawType === 'main' ? (profile.walletBalance || 0) : (profile.rewardBalance || 0);
    const minLimit = withdrawType === 'main' ? 0 : (systemSettings?.minRewardWithdraw || 500);

    if (amount > balance) {
      toast.error('Insufficient balance');
      return;
    }

    if (amount < minLimit) {
      toast.error(`Minimum withdrawal for rewards is ₹${minLimit}`);
      return;
    }

    try {
      setIsPurchasing(true); // Re-using loading state
      const { writeBatch, Timestamp, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const userRef = doc(db, 'users', profile.uid);
      const transId = `WD-${Date.now()}`;
      
      if (withdrawType === 'main') {
        batch.update(userRef, {
          walletBalance: (profile.walletBalance || 0) - amount
        });
      } else {
        batch.update(userRef, {
          rewardBalance: (profile.rewardBalance || 0) - amount
        });
      }

      batch.set(doc(db, 'walletTransactions', transId), {
        userId: profile.uid,
        amount: -amount,
        type: 'Debit',
        source: 'Withdrawal',
        status: 'Pending', // Common in apps
        description: `Withdrawal from ${withdrawType === 'main' ? 'Main' : 'Reward'} Wallet`,
        createdAt: Timestamp.now()
      });

      await batch.commit();
      toast.success('Withdrawal request submitted!');
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
    } catch (e: any) {
      toast.error('Withdrawal failed: ' + e.message);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePurchaseKey = async () => {
    if (!profile) return;
    const selectedPlan = activePurchaseTab === 'plans' ? plans[selectedPlanIndex] : availableChallenges[selectedPlanIndex];
    
    if (!selectedPlan) {
      toast.error('No selection available to purchase');
      return;
    }

    const price = activePurchaseTab === 'plans' ? (selectedPlan.price || 0) : (selectedPlan.cost || 0);
    
    if (price === 0) {
      // Free plan/challenge - bypass payment gateway
      setIsPurchasing(true);
      await finalizePurchase(selectedPlan, 'FREE_PLAN');
      return;
    }

    const gateways = systemSettings?.paymentGateways;
    if (!gateways) {
      toast.error('Online payment system is not configured');
      return;
    }

    if (gateways.cashfree?.enabled && gateways.cashfree?.appId) {
      handleCashfreePurchase(selectedPlan);
    } else if (gateways.razorpay?.enabled && gateways.razorpay?.apiKey) {
      handleRazorpayPurchase(selectedPlan);
    } else {
      toast.error('Online payment is currently unavailable. Contact admin.');
    }
  };

  const handleRazorpayPurchase = async (selectedPlan: any) => {
    setIsPurchasing(true);
    
    try {
      const price = activePurchaseTab === 'plans' ? selectedPlan.price : selectedPlan.cost;
      const description = activePurchaseTab === 'plans' ? `License Plan: ${selectedPlan.name}` : `Challenge Entry: ${selectedPlan.title}`;
      
      // 1. Create Order on Server
      const orderRes = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: price })
      });
      
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: systemSettings.paymentGateways.razorpay.apiKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Bharat Nest Agro",
        description: description,
        order_id: orderData.id,
        image: "https://ais-dev-lebhqgu6cqvssmp5inx73h-837596617831.asia-southeast1.run.app/logo.png",
        handler: function (response: any) {
          finalizePurchase(selectedPlan, response.razorpay_payment_id);
        },
        prefill: {
          name: profile?.name || "",
          email: user?.email || "",
          contact: profile?.phone || ""
        },
        theme: { color: "#4f46e5" }, // indigo-600
        modal: {
          ondismiss: function() {
            setIsPurchasing(false);
          }
        }
      };

      const Razorpay = (window as any).Razorpay;
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay Init Error:', err);
      toast.error(err.message || 'Could not initialize Razorpay');
      setIsPurchasing(false);
    }
  };

  const handleCashfreePurchase = async (selectedPlan: any) => {
    setIsPurchasing(true);
    
    try {
      const Cashfree = (window as any).Cashfree;
      if (!Cashfree) {
        toast.error('Cashfree SDK not loaded');
        setIsPurchasing(false);
        return;
      }

      // 1. Create Session
      const response = await fetch("/api/create-cashfree-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedPlan.price,
          customerId: user?.uid || "guest",
          customerPhone: profile?.phone || "9999999999",
          customerEmail: user?.email || "customer@example.com",
          orderId: `plan_${Date.now()}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize session');
      }

      // 2. Initialize checkout
      const cashfree = new Cashfree({
        mode: "sandbox", 
      });

      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_self",
      }).then((result: any) => {
        if (result.error) {
          toast.error(result.error.message);
          setIsPurchasing(false);
        }
      });

    } catch (err: any) {
      console.error('Cashfree Init Error:', err);
      toast.error(err.message || 'Could not initialize Cashfree');
      setIsPurchasing(false);
    }
  };

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    farmName: profile?.farmName || '',
    address: profile?.address || '',
    farmArea: profile?.farmArea?.toString() || '',
    birdCapacity: profile?.birdCapacity?.toString() || '',
    farmType: profile?.farmType || '',
  });
  
  const [licensingInfo, setLicensingInfo] = useState<{ activatedAt?: string; validityDays?: number }>({});
  
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        farmName: profile.farmName || '',
        address: profile.address || '',
        farmArea: profile.farmArea?.toString() || '',
        birdCapacity: profile.birdCapacity?.toString() || '',
        farmType: profile.farmType || '',
      });
    }
  }, [profile]);
  
  const safeFormatDate = (dateStringOrObj: any): string => {
    try {
      if (!dateStringOrObj) return 'N/A';
      const d = dateStringOrObj.toDate ? dateStringOrObj.toDate() : new Date(dateStringOrObj);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return format(d, 'dd MMM yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const [addressFormData, setAddressFormData] = useState({
    name: '',
    type: 'Farm',
    line1: '',
    locality: '',
    district: '',
    state: '',
    pincode: '',
    mobile: ''
  });

  useEffect(() => {
    const mId = profile?.managerId || profile?.assignedManagerId;
    if (mId) {
      const fetchManager = async () => {
        try {
          const mDoc = await getDoc(doc(db, 'users', mId));
          if (mDoc.exists()) {
            const data = mDoc.data();
            setManagerData({
              name: data.name,
              phone: data.phone || 'No phone provided',
              email: data.email || '',
              district: data.district,
              state: data.state
            });
          } else {
            setManagerData(null);
          }
        } catch (e) {
          console.error("Error fetching manager:", e);
        }
      };
      fetchManager();
    } else {
      setManagerData(null);
    }
  }, [profile?.managerId, profile?.assignedManagerId]);

  const [licenseData, setLicenseData] = useState<any>(null);
  const [fetchingLicense, setFetchingLicense] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'licensePlans'), (d) => {
      if (d.exists() && Array.isArray(d.data().plans)) {
        setPlans(d.data().plans);
      } else {
        setPlans([]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/licensePlans');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchLicenseDetails = async () => {
      if (profile?.licenseKey) {
        setFetchingLicense(true);
        try {
          const q = query(collection(db, 'licenseKeys'), where('key', '==', profile.licenseKey));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setLicenseData(snap.docs[0].data());
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.LIST, 'licenseKeys');
        } finally {
          setFetchingLicense(false);
        }
      } else {
        setLicenseData(null);
      }
    };
    fetchLicenseDetails();
  }, [profile?.licenseKey]);

  const handleActivateLicense = async () => {
    if (!profile || !licenseKeyInput.trim()) return;
    setIsActivating(true);
    try {
      // 1. Check if key exists and is unused
      const { collection, query, where, getDocs, updateDoc, doc, Timestamp, writeBatch } = await import('firebase/firestore');
      const q = query(collection(db, 'licenseKeys'), where('key', '==', licenseKeyInput.trim()), where('status', '==', 'Unused'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error('Invalid or already used license key');
        return;
      }

      const keyDoc = snapshot.docs[0];
      const batch = writeBatch(db);

      // 2. Mark key as used
      batch.update(doc(db, 'licenseKeys', keyDoc.id), {
        status: 'Active',
        usedBy: profile.uid,
        usedByEmail: profile.email,
        activatedAt: Timestamp.now()
      });

      // 3. Update user profile
      batch.update(doc(db, 'users', profile.uid), {
        licenseActive: true,
        licenseKey: licenseKeyInput.trim(),
        licenseActivatedAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success('License activated successfully! Enjoy full features.');
      setLicenseKeyInput('');
    } catch (e: any) {
      console.error('Activation Error:', e);
      toast.error(`Failed to activate license: ${e.message || 'Permission denied'}`);
    } finally {
      setIsActivating(false);
    }
  };

  useEffect(() => {
    if (user && profile?.lastBackupAt) {
      checkAndRunAutoBackup(user.uid, profile.lastBackupAt);
    }
  }, [user, profile?.lastBackupAt]);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const currentUser = firebaseAuth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
        toast.success('Password updated successfully');
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error('No authenticated user found');
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('This action requires a recent login. Please logout and login again to change your password.');
      } else {
        toast.error(error.message || 'Failed to update password');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(firebaseAuth, user.email);
      toast.success('Password reset email sent to your registered email address.');
    } catch (error: any) {
      toast.error('Failed to send reset email: ' + error.message);
    }
  };

  const handleManualBackup = async () => {
    if (!user) return;
    setIsBackingUp(true);
    try {
      await runBackup(user.uid);
      toast.success('System data successfully backed up to your Google Drive!');
    } catch (e: any) {
      toast.error('Backup failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ...formData,
        farmArea: Number(formData.farmArea),
        birdCapacity: Number(formData.birdCapacity),
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!profile) return;
    const newAddress = {
      ...addressFormData,
      id: editingAddressId || Date.now().toString()
    };

    let updatedAddresses = [...(profile.savedAddresses || [])];
    if (editingAddressId) {
      updatedAddresses = updatedAddresses.map(a => a.id === editingAddressId ? newAddress : a);
    } else {
      updatedAddresses.push(newAddress);
    }

    try {
      await updateDoc(doc(db, 'users', profile.uid), { savedAddresses: updatedAddresses });
      toast.success(editingAddressId ? 'Address updated' : 'Address added');
      setIsAddressModalOpen(false);
      setEditingAddressId(null);
      setAddressFormData({
        name: '', type: 'Farm', line1: '', locality: '', district: '', state: '', pincode: '', mobile: ''
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
      toast.error('Failed to save address');
    }
  };

  const startEditAddress = (addr: any) => {
    setEditingAddressId(addr.id);
    setAddressFormData({ ...addr });
    setIsAddressModalOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10">
      {/* Success Overlay */}
      <AnimatePresence>
        {purchaseSuccess && (
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
              className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6"
            >
              <ShieldCheck size={48} />
            </motion.div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">License Activated!</h2>
            <p className="text-slate-500 mb-8 max-w-xs">Congratulations! Your license has been purchased and activated. You now have full access to all features.</p>
            
            <div className="space-y-4 w-full max-w-xs">
              <Button 
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold"
                onClick={() => setPurchaseSuccess(false)}
              >
                Close Now
              </Button>
              <p className="text-xs text-slate-400 font-mono">
                {countdown}s remaining
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
          <p className="text-slate-500">Manage your account & farm</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
            <DialogTrigger nativeButton={true} render={
              <Button 
                variant="outline" 
                className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl gap-2 shadow-sm h-10"
              >
                <Lock size={16} />
                <span className="hidden sm:inline">Password</span>
              </Button>
            } />
            <DialogContent className="rounded-3xl max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="text-emerald-600" size={20} />
                  Security Settings
                </DialogTitle>
                <DialogDescription>Update your account password</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <p className="text-xs text-emerald-700 font-medium mb-3">Option 1: Get a reset link in your email</p>
                  <Button 
                    variant="outline" 
                    className="w-full bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl font-bold h-11"
                    onClick={handleSendResetEmail}
                  >
                    Send Reset Email
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100"></span>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-3 font-bold text-slate-400 tracking-widest">OR SET MANUALLY</span>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-pass" className="text-xs font-bold text-slate-500">New Password</Label>
                    <Input 
                      id="new-pass" 
                      type="password"
                      value={newPassword}
                      placeholder="Minimum 6 characters"
                      onChange={e => setNewPassword(e.target.value)}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-pass" className="text-xs font-bold text-slate-500">Confirm Password</Label>
                    <Input 
                      id="confirm-pass" 
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isUpdatingPassword} 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold mt-2"
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update Password Manually'}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
            <DialogTrigger nativeButton={true} render={
              <Button 
                variant="outline" 
                className="border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-xl gap-2 shadow-sm h-10"
              >
                <Edit2 size={16} />
                <span className="hidden sm:inline">Edit Profile</span>
              </Button>
            } />
            <DialogContent className="rounded-3xl max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Personal & Farm Information</DialogTitle>
                <CardDescription>Update your essential details</CardDescription>
              </DialogHeader>
              <form onSubmit={async (e) => {
                await handleUpdate(e);
                setIsEditProfileOpen(false);
              }} className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="name" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      Full Name
                    </Label>
                    <Input 
                      id="name" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="phone" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <Phone size={14} className="text-slate-400" />
                      Mobile Number
                    </Label>
                    <Input 
                      id="phone" 
                      value={formData.phone}
                      placeholder="e.g. +91 9876543210"
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="farmName" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      Farm Name
                    </Label>
                    <Input 
                      id="farmName" 
                      value={formData.farmName}
                      onChange={e => setFormData({...formData, farmName: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="farmType" className="text-xs font-bold text-slate-500">Farm Type</Label>
                    <Select 
                      value={formData.farmType} 
                      onValueChange={(value) => setFormData({ ...formData, farmType: value })}
                    >
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gavthi Farm">Gavthi Farm</SelectItem>
                        <SelectItem value="Sonali Farm">Sonali Farm</SelectItem>
                        <SelectItem value="Broiler Farm">Broiler Farm</SelectItem>
                        <SelectItem value="Layer Farm">Layer Farm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="address" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" />
                    Default Address
                  </Label>
                  <Input 
                    id="address" 
                    value={formData.address}
                    placeholder="Full address for bills/logs"
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="rounded-xl border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2 text-left">
                    <Label htmlFor="farmArea" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <Maximize2 size={14} className="text-slate-400" />
                      Farm Area (Sq.Ft)
                    </Label>
                    <Input 
                      id="farmArea" 
                      type="number"
                      value={formData.farmArea}
                      onChange={e => setFormData({...formData, farmArea: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="birdCapacity" className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      Bird Capacity
                    </Label>
                    <Input 
                      id="birdCapacity" 
                      type="number"
                      value={formData.birdCapacity}
                      onChange={e => setFormData({...formData, birdCapacity: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl h-12 font-bold shadow-lg shadow-emerald-900/10">
                    {loading ? 'Saving...' : 'Update Profile Details'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-2 shadow-sm h-10"
            onClick={() => signOut()}
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Mobile Switcher Buttons */}
      {(profile?.role === 'admin' || profile?.role === 'manager') && (
        <div className="sm:hidden flex gap-2 pt-2">
          {profile?.role === 'admin' && (
            <Button 
              variant="default" 
              className="flex-1 rounded-xl bg-slate-900 font-black italic uppercase text-[10px] h-10 shadow-sm"
              onClick={() => navigate('/admin')}
            >
              Admin Dashboard
            </Button>
          )}
          <Button 
            variant="default" 
            className="flex-1 rounded-xl bg-indigo-600 font-black italic uppercase text-[10px] h-10 shadow-sm"
            onClick={() => navigate('/manager')}
          >
            Manager Dashboard
          </Button>
        </div>
      )}

      {/* User Summary */}
      <div className="bg-white rounded-3xl p-6 flex items-center gap-4 shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
          <User size={40} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 truncate text-left">{profile?.name}</h2>
          <p className="text-slate-500 text-sm truncate text-left">{profile?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-emerald-100">
              {profile?.role}
            </Badge>
            {profile?.role === 'manager' && profile?.managerCode && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-bold uppercase">
                ID: {profile.managerCode}
              </Badge>
            )}
            {profile?.licenseActive && (
              <Badge variant="outline" className="flex items-center gap-1 text-[10px] bg-indigo-50 border-indigo-100 text-indigo-600 font-bold uppercase">
                <ShieldCheck size={10} />
                Activated
              </Badge>
            )}
          </div>
        </div>
        <Link to="/notifications" className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-colors">
          <Bell size={20} />
        </Link>
      </div>

      {/* Collapsible: Data Backup & Sync */}
      <CollapsibleSection 
        title="Backup & Data Sync" 
        icon={Database} 
        isOpen={openSection === 'backup'} 
        onToggle={() => toggleSection('backup')}
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
              <Cloud size={28} />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-bold text-blue-900">Google Drive Backup</h4>
              <p className="text-[10px] text-blue-700 leading-tight">Securely store your farm data in your personal Google Drive. Syncs automatically every 24 hours.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Last Sync</p>
                <p className="text-xs font-bold text-slate-700">{profile?.lastBackupAt ? safeFormatDate(profile.lastBackupAt) : 'Never backed up'}</p>
              </div>
              <Button 
                onClick={handleManualBackup}
                disabled={isBackingUp}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 px-4 font-bold gap-2"
              >
                <RefreshCw size={14} className={isBackingUp ? 'animate-spin' : ''} />
                {isBackingUp ? 'Syncing...' : 'Backup Now'}
              </Button>
            </div>
          </div>

          {!(import.meta as any).env.VITE_GOOGLE_CLIENT_ID && (
            <p className="text-[10px] text-amber-600 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
              Note: Google Drive integration requires a Client ID from Google Cloud Console.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Collapsible: Your Last Order */}
      <CollapsibleSection 
        title="Your Last Order" 
        icon={ShoppingCart} 
        isOpen={openSection === 'lastOrder'} 
        onToggle={() => toggleSection('lastOrder')}
        extraHeader={<Link to="/orders" className="text-xs font-bold text-indigo-600 hover:underline">View All</Link>}
      >
        {recentOrders.length > 0 ? (
          recentOrders.map(order => (
            <div key={order.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Order #{order.id.slice(-6).toUpperCase()}</p>
                <p className="text-xs text-slate-500">{order.items?.length || 0} items • ₹{order.totalAmount?.toLocaleString() || order.total?.toLocaleString()}</p>
              </div>
              <Badge className={
                order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700 border-none' :
                order.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-none' :
                'bg-amber-100 text-amber-700 border-none'
              }>
                {order.status}
              </Badge>
            </div>
          ))
        ) : (
          <div className="bg-slate-50 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400 font-medium">No recent orders found</p>
            <Button variant="link" render={<Link to="/shop">Shop Now</Link>} className="h-auto p-0 text-xs mt-1 text-indigo-600 font-bold" />
          </div>
        )}
      </CollapsibleSection>

      {/* Collapsible: Your Manager */}
      <CollapsibleSection 
        title="Your Manager" 
        icon={Users} 
        isOpen={openSection === 'manager'} 
        onToggle={() => toggleSection('manager')}
      >
        {(profile?.managerId || profile?.assignedManagerId) ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                  <User size={28} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-lg">{managerData?.name || 'Loading manager...'}</p>
                  <p className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full inline-block">Area Manager</p>
                </div>
              </div>
              {managerData?.phone && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  render={
                    <a href={`tel:${managerData.phone}`}>
                      <Phone size={14} className="mr-2" />
                      Call
                    </a>
                  }
                  className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 h-10 px-4"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-50 text-left">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</p>
                <p className="text-sm font-medium text-slate-700">{managerData?.phone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                <p className="text-sm font-medium text-slate-700 truncate">{managerData?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Area</p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <MapPin size={12} className="text-slate-400" />
                  <span>{managerData?.district || 'Not strictly defined'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manager Role</p>
                <p className="text-xs font-bold text-emerald-600">Verified Support Partner</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-amber-50 rounded-2xl border border-amber-100">
            <ShieldCheck className="text-amber-600 mx-auto mb-2" size={32} />
            <p className="font-bold text-amber-900">No Manager Assigned</p>
            <p className="text-xs text-amber-700/80 max-w-sm mx-auto mt-1 px-4 text-center">
              Please contact PoultryPro support to get assigned an Area Manager.
            </p>
          </div>
        )}
      </CollapsibleSection>

      {/* Unified Wallet Section */}
      <CollapsibleSection 
        title="Wallet & Earnings" 
        icon={Wallet} 
        isOpen={openSection === 'wallet'} 
        onToggle={() => toggleSection('wallet')}
        extraHeader={
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
            <span className="text-[10px] font-black text-emerald-600 uppercase italic">₹{(profile?.walletBalance || 0) + (profile?.rewardBalance || 0)}</span>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6 rounded-[2rem] bg-indigo-600 text-white border-none shadow-lg shadow-indigo-950/20 relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-[10px] font-black italic uppercase text-indigo-100 tracking-widest opacity-80">Main Wallet Balance</p>
                  <h2 className="text-4xl font-black italic mt-1">₹{profile?.walletBalance || 0}</h2>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-white/20 hover:bg-white/30 rounded-xl h-10 font-bold italic uppercase text-[10px] backdrop-blur-md"
                    onClick={() => {
                      setWithdrawType('main');
                      setShowWithdrawDialog(true);
                    }}
                  >
                    Withdraw
                  </Button>
                  <Button 
                    variant="link"
                    className="text-white font-black italic uppercase text-[10px]"
                    onClick={() => {
                        // Trigger add cash (logic pending or via top-up)
                        toast.info('Top-up via payment gateway');
                    }}
                  >
                    + Top Up
                  </Button>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
            </Card>

            <Card className="p-6 rounded-[2rem] bg-[#FACC15] text-[#122B21] border-none shadow-lg shadow-amber-950/20 relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-[10px] font-black italic uppercase text-amber-900 tracking-widest opacity-80">Reward Earnings</p>
                  <h2 className="text-4xl font-black italic mt-1">₹{profile?.rewardBalance || 0}</h2>
                </div>
                <div className="flex gap-2">
                  <Button 
                    disabled={(profile?.rewardBalance || 0) < (systemSettings?.minRewardWithdraw || 500)}
                    className="flex-1 bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl h-10 font-bold italic uppercase text-[10px] disabled:opacity-30"
                    onClick={() => {
                      setWithdrawType('reward');
                      setShowWithdrawDialog(true);
                    }}
                  >
                    { (profile?.rewardBalance || 0) < (systemSettings?.minRewardWithdraw || 500) ? `Min ₹${systemSettings?.minRewardWithdraw || 500}` : 'Withdraw Reward' }
                  </Button>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/30 rounded-full blur-2xl group-hover:bg-white/40 transition-all" />
            </Card>
          </div>

          <Tabs defaultValue="challenges" className="w-full">
            <TabsList className="bg-slate-100 p-1 rounded-2xl w-full">
              <TabsTrigger value="challenges" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">Active Challenges</TabsTrigger>
              <TabsTrigger value="transactions" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="challenges" className="pt-4 space-y-4">
              {userChallenges.length === 0 ? (
                <Card className="border-none shadow-none bg-slate-50 rounded-[2rem] p-8 text-center">
                   <Trophy className="mx-auto text-slate-200 mb-2" size={32} />
                   <p className="text-xs font-bold italic text-slate-400 uppercase">No active challenges</p>
                   <Button 
                    variant="link" 
                    className="text-indigo-600 font-black italic uppercase text-[10px]"
                    onClick={() => {
                        document.getElementById('license-section')?.scrollIntoView({ behavior: 'smooth' });
                        setTimeout(() => toggleSection('license'), 300);
                    }}
                   >
                     Browse Challenges
                   </Button>
                </Card>
              ) : (
                userChallenges.map(uc => {
                  const plan = availableChallenges.find(p => p.id === uc.challengeId);
                  return (
                    <div key={uc.id} className="p-4 bg-white border border-slate-100 rounded-3xl space-y-3">
                       <div className="flex justify-between items-start">
                          <div className="text-left">
                             <h4 className="font-black italic uppercase text-sm text-slate-900">{plan?.title || 'Unknown Challenge'}</h4>
                             <p className="text-[10px] font-bold italic text-slate-400 uppercase">Started: {safeFormatDate(uc.startDate)}</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-600 font-black italic uppercase text-[8px]">{uc.status}</Badge>
                       </div>
                       
                       <div className="space-y-1">
                          <div className="flex justify-between text-[8px] font-black italic uppercase">
                             <span className="text-slate-400">Progress</span>
                             <span className="text-indigo-600">Earnings: ₹{uc.totalEarned || 0}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-indigo-600 rounded-full"
                               style={{ width: `${Math.min(100, (Object.keys(uc.dailyEntries || {}).length / (plan?.durationDays || 90)) * 100)}%` }}
                             />
                          </div>
                       </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
            
            <TabsContent value="transactions" className="pt-4">
               <div className="space-y-2">
                  {walletTransactions.length === 0 ? (
                    <p className="text-center py-8 text-[10px] font-bold italic text-slate-400 uppercase text-slate-300">No transactions yet</p>
                  ) : (
                    walletTransactions.map(vt => (
                      <div key={vt.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${vt.type === 'Credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                               {vt.type === 'Credit' ? <Plus size={14} /> : <Database size={14} />}
                            </div>
                            <div className="text-left">
                               <p className="text-[11px] font-black italic uppercase text-slate-700">{vt.source}</p>
                               <p className="text-[9px] font-bold italic text-slate-400">{safeFormatDate(vt.createdAt)}</p>
                            </div>
                         </div>
                         <p className={`text-xs font-black italic ${vt.type === 'Credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {vt.type === 'Credit' ? '+' : '-'}₹{Math.abs(vt.amount)}
                         </p>
                      </div>
                    ))
                  )}
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleSection>

      {/* Collapsible: License & Activation */}
      <CollapsibleSection 
        title="License & Activation" 
        icon={Key} 
        isOpen={openSection === 'license'} 
        onToggle={() => toggleSection('license')}
      >
        <div className="space-y-6">
          {profile?.licenseActive ? (
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <ShieldCheck size={80} />
                </div>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                  <ShieldCheck size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-emerald-900">License Active</p>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[8px] uppercase font-bold">Verified</Badge>
                  </div>
                  <p className="text-xs font-mono font-bold text-emerald-600 bg-emerald-100/30 px-2 py-0.5 rounded inline-block">
                    {profile.licenseKey}
                  </p>
                </div>
              </div>

              {licenseData && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Activated On</p>
                    <p className="text-xs font-bold text-slate-700">
                      {licenseData.activatedAt ? safeFormatDate(licenseData.activatedAt) : safeFormatDate(profile.licenseActivatedAt)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Validity</p>
                    <p className="text-xs font-bold text-slate-700">{licenseData.validityDays || 365} Days</p>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl col-span-2 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Status</p>
                      <p className="text-sm font-black text-indigo-600 uppercase">Premium Access</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Remaining</p>
                      <p className="text-sm font-black text-indigo-600">
                        {(() => {
                          if (!licenseData.activatedAt?.toDate || !licenseData.validityDays) return '---';
                          const expiryDate = addDays(licenseData.activatedAt.toDate(), licenseData.validityDays);
                          const diff = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return diff > 0 ? `${diff} Days` : 'Expired';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter License Key" 
                  value={licenseKeyInput}
                  onChange={e => setLicenseKeyInput(e.target.value.toUpperCase())}
                  className="rounded-xl font-mono uppercase h-12"
                />
                <Button 
                  onClick={handleActivateLicense} 
                  disabled={isActivating || !licenseKeyInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 px-6 shadow-md shadow-indigo-100"
                >
                  {isActivating ? '...' : 'Activate'}
                </Button>
              </div>
            </div>
          )}

          {profile?.licenseActive && (
            <div className="border-t border-slate-100 mt-8 pt-8 px-2">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                   <ShoppingBag size={24} />
                </div>
                <h4 className="text-lg font-black italic uppercase text-slate-900">Explore New Opportunities</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase italic">Upgrade license or take new challenges below</p>
              </div>
            </div>
          )}

          {/* Available Offers / Store Section */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between px-2">
               <div className="text-left">
                  <h3 className="text-sm font-black italic uppercase text-indigo-600">Upgrade or Join Challenges</h3>
                  <p className="text-[10px] font-bold italic text-slate-400 uppercase">Available plans and daily rewards</p>
               </div>
               <Badge className="bg-indigo-50 text-indigo-600 border-none font-black italic uppercase text-[8px]">New Offers</Badge>
            </div>

            <Tabs defaultValue="plans" className="w-full">
              <TabsList className="bg-slate-100 p-1 rounded-2xl w-full mb-4">
                <TabsTrigger value="plans" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">License Plans</TabsTrigger>
                <TabsTrigger value="item_challenges" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">Daily Rewards</TabsTrigger>
              </TabsList>

              <TabsContent value="plans">
                <div className="grid grid-cols-1 gap-3 text-left">
                  {plans.map((plan, idx) => (
                    <div key={idx} className={`p-4 rounded-3xl border border-slate-100 bg-white transition-all hover:border-indigo-200 group`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-left">
                          <p className="font-black italic uppercase text-slate-900 text-sm">{plan.name}</p>
                          <p className="text-[10px] font-bold italic text-slate-400 uppercase">{plan.days || plan.durationDays || 365} Days Validity</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black italic text-indigo-600 text-xl">₹{plan.price}</p>
                        </div>
                      </div>
                      <Button 
                        className="w-full rounded-2xl text-[10px] h-10 bg-indigo-600 hover:bg-indigo-700 font-black italic uppercase gap-2 transition-all group-hover:shadow-lg group-hover:shadow-indigo-100"
                        onClick={() => {
                          setSelectedPlanIndex(idx);
                          setActivePurchaseTab('plans');
                          setShowPurchaseDialog(true);
                        }}
                      >
                        <ShoppingCart size={14} />
                        Buy & Activate
                      </Button>
                    </div>
                  ))}
                  {plans.length === 0 && <p className="text-center py-4 text-[10px] font-bold italic text-slate-400 uppercase">No plans available</p>}
                </div>
              </TabsContent>

              <TabsContent value="item_challenges">
                <div className="grid grid-cols-1 gap-3 text-left">
                  {availableChallenges.map((challenge, idx) => {
                    const isJoined = userChallenges.some(uc => uc.challengeId === challenge.id && uc.status === 'Active');
                    return (
                      <div key={challenge.id} className={`p-4 rounded-3xl border ${isJoined ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'} transition-all group`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-left">
                            <p className="font-black italic uppercase text-slate-900 text-sm">{challenge.title}</p>
                            <p className="text-[10px] font-bold italic text-slate-400 uppercase">{challenge.durationDays} Days • Reward ₹{challenge.dailyReward}/Day</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black italic text-amber-500 text-xl">₹{challenge.cost}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            className={`flex-1 rounded-2xl text-[10px] h-10 font-black italic uppercase gap-2 transition-all ${isJoined ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 shadow-none' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                            onClick={() => {
                              if (isJoined) {
                                toggleSection('wallet');
                              } else {
                                // Find index in availableChallenges
                                const aIdx = availableChallenges.findIndex(c => c.id === challenge.id);
                                setSelectedPlanIndex(aIdx);
                                setActivePurchaseTab('challenges');
                                setShowPurchaseDialog(true);
                              }
                            }}
                          >
                            <Trophy size={14} />
                            {isJoined ? 'View Progress' : 'Join Challenge'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {availableChallenges.length === 0 && <p className="text-center py-4 text-[10px] font-bold italic text-slate-400 uppercase">No active challenges</p>}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CollapsibleSection>


      {/* Collapsible: Saved Delivery Addresses */}
      <CollapsibleSection 
        title="Saved Delivery Addresses" 
        icon={MapPinned} 
        isOpen={openSection === 'addresses'} 
        onToggle={() => toggleSection('addresses')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-left">
            {profile?.savedAddresses?.map((addr: any) => (
              <div key={addr.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-600" />
                    <p className="font-bold text-slate-900">{addr.name}</p>
                    <Badge variant="secondary" className="text-[8px] uppercase font-bold px-1.5 py-0 h-4">{addr.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-white" onClick={() => startEditAddress(addr)}>
                      <Edit2 size={12} className="text-slate-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-lg hover:bg-white text-red-500"
                      onClick={async () => {
                        if (confirm('Delete this address?')) {
                          try {
                            const updated = profile.savedAddresses.filter((a: any) => a.id !== addr.id);
                            await updateDoc(doc(db, 'users', profile.uid), { savedAddresses: updated });
                            toast.success('Address removed');
                          } catch (err) {
                            toast.error('Failed to remove address');
                          }
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed pr-8">
                  {addr.line1}, {addr.locality}, {addr.district}, {addr.state} - {addr.pincode}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1 lowercase">
                  <Phone size={10} /> {addr.mobile}
                </p>
              </div>
            ))}
          </div>

          <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
            <DialogTrigger nativeButton={true} render={
              <Button variant="outline" className="w-full rounded-2xl border-dashed border-2 border-slate-200 h-14 bg-slate-50/50 hover:bg-slate-50 text-slate-500 font-bold gap-2" onClick={() => {
                setEditingAddressId(null);
                setAddressFormData({ name: '', type: 'Farm', line1: '', locality: '', district: '', state: '', pincode: '', mobile: profile?.phone || '' });
              }}>
                <Plus size={18} />
                Add New Address
              </Button>
            } />
            <DialogContent className="rounded-3xl max-w-lg w-[95vw]">
              <DialogHeader>
                <DialogTitle>{editingAddressId ? 'Edit Address' : 'New Delivery Address'}</DialogTitle>
                <CardDescription>Enter details for secure delivery</CardDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4 text-left">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Save As (e.g. Home, Office)</Label>
                  <Input value={addressFormData.name} onChange={e => setAddressFormData({...addressFormData, name: e.target.value})} className="rounded-xl h-11" placeholder="Farm Location 1" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Type</Label>
                  <Select value={addressFormData.type} onValueChange={v => setAddressFormData({...addressFormData, type: v})}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Farm">Farm</SelectItem>
                      <SelectItem value="Warehouse">Warehouse</SelectItem>
                      <SelectItem value="Home">Home</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</Label>
                  <Input value={addressFormData.mobile} onChange={e => setAddressFormData({...addressFormData, mobile: e.target.value})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 1</Label>
                  <Input value={addressFormData.line1} onChange={e => setAddressFormData({...addressFormData, line1: e.target.value})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Locality/Town</Label>
                  <Input value={addressFormData.locality} onChange={e => setAddressFormData({...addressFormData, locality: e.target.value})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">District</Label>
                  <Input value={addressFormData.district} onChange={e => setAddressFormData({...addressFormData, district: e.target.value})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">State</Label>
                  <Input value={addressFormData.state} onChange={e => setAddressFormData({...addressFormData, state: e.target.value})} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Pincode</Label>
                  <Input value={addressFormData.pincode} onChange={e => setAddressFormData({...addressFormData, pincode: e.target.value})} className="rounded-xl h-11" />
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full bg-indigo-600 rounded-xl py-6 font-bold" onClick={handleSaveAddress}>
                  {editingAddressId ? 'Update Address' : 'Save Address'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CollapsibleSection>

      {/* Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="rounded-3xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase">Withdraw Funds</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center space-y-1">
              <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">
                {withdrawType === 'main' ? 'Main' : 'Reward'} Balance
              </p>
              <p className="text-4xl font-black italic text-slate-900">
                ₹{withdrawType === 'main' ? (profile?.walletBalance || 0) : (profile?.rewardBalance || 0)}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <Label className="text-[10px] font-black italic uppercase text-slate-500 pl-1">Amount to Withdraw</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black italic text-slate-400">₹</span>
                  <Input 
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="rounded-2xl h-14 pl-8 border-slate-100 font-black italic text-lg"
                  />
                </div>
                {withdrawType === 'reward' && (
                  <p className="text-[9px] font-bold italic text-amber-600 uppercase pl-1">* Minimum ₹{systemSettings?.minRewardWithdraw || 500} required for rewards withdrawal.</p>
                )}
              </div>
              
              <Button 
                className="w-full bg-slate-900 hover:bg-black rounded-2xl py-7 font-black italic uppercase text-[10px] tracking-widest shadow-xl"
                onClick={handleWithdraw}
                disabled={isPurchasing || !withdrawAmount}
              >
                {isPurchasing ? 'Processing...' : 'Confirm Withdrawal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan Purchase Dialog - Re-used from existing store */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="rounded-3xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase">Store</DialogTitle>
            <CardDescription className="font-bold italic text-slate-500 uppercase text-[10px]">Activate your license or participate in rewards challenges</CardDescription>
          </DialogHeader>
          
          <Tabs value={activePurchaseTab} onValueChange={(v: any) => { setActivePurchaseTab(v); setSelectedPlanIndex(0); }} className="w-full">
            <TabsList className="bg-slate-100 p-1 rounded-2xl w-full mb-6">
              <TabsTrigger value="plans" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">License Keys</TabsTrigger>
              <TabsTrigger value="challenges" className="flex-1 rounded-xl font-black italic uppercase text-[10px]">Challenges</TabsTrigger>
            </TabsList>

            <TabsContent value="plans">
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full" onClick={() => setSelectedPlanIndex(prev => Math.max(0, prev - 1))} disabled={selectedPlanIndex === 0}>
                    <ChevronLeft size={18} />
                  </Button>
                  <div className="text-center flex-1 px-2">
                      <p className="text-sm font-black italic uppercase text-slate-900">{plans[selectedPlanIndex]?.name || 'Standard Plan'}</p>
                      <p className="text-[10px] italic font-bold text-slate-500 uppercase tracking-tight">{plans[selectedPlanIndex]?.days || 365} Days Validity</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full" onClick={() => setSelectedPlanIndex(prev => Math.min(plans.length - 1, prev + 1))} disabled={selectedPlanIndex === plans.length - 1 || plans.length === 0}>
                    <ChevronRight size={18} />
                  </Button>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center space-y-2 border-l-4 border-l-indigo-600">
                  <p className="text-xs font-black italic text-slate-400 uppercase tracking-widest">Amount to Pay</p>
                  <p className="text-4xl font-black italic text-slate-900">₹{plans[selectedPlanIndex]?.price || 0}</p>
                </div>

                <div className="space-y-2">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl py-6 font-black italic uppercase text-[10px] gap-2 shadow-lg shadow-indigo-900/20"
                    onClick={handlePurchaseKey}
                    disabled={isPurchasing || plans.length === 0}
                  >
                    {isPurchasing ? 'Processing...' : `Pay ₹${plans[selectedPlanIndex]?.price || 0} via Online`}
                  </Button>

                  {((profile?.walletBalance || 0) + (profile?.rewardBalance || 0)) >= (plans[selectedPlanIndex]?.price || 0) && (
                    <Button 
                      variant="outline"
                      className="w-full border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 text-indigo-600 rounded-2xl py-6 font-black italic uppercase text-[10px]"
                      onClick={() => finalizePurchase(plans[selectedPlanIndex], 'WALLET_PAYMENT')}
                      disabled={isPurchasing}
                    >
                      Pay using Wallet Balance
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="challenges">
              <div className="space-y-6">
                {availableChallenges.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold italic uppercase text-[10px]">No active challenges at the moment</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-2">
                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full" onClick={() => setSelectedPlanIndex(prev => Math.max(0, prev - 1))} disabled={selectedPlanIndex === 0}>
                         <ChevronLeft size={18} />
                       </Button>
                       <div className="text-center flex-1 px-2">
                          <p className="text-sm font-black italic uppercase text-slate-900">{availableChallenges[selectedPlanIndex]?.title}</p>
                          <p className="text-[10px] italic font-bold text-slate-500 uppercase tracking-tight">{availableChallenges[selectedPlanIndex]?.durationDays} Days Duration</p>
                       </div>
                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full" onClick={() => setSelectedPlanIndex(prev => Math.min(availableChallenges.length - 1, prev + 1))} disabled={selectedPlanIndex === availableChallenges.length - 1}>
                         <ChevronRight size={18} />
                       </Button>
                    </div>

                    <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 text-center space-y-2 border-l-4 border-l-amber-500">
                      <p className="text-xs font-black italic text-amber-500 uppercase tracking-widest">Entry Fee</p>
                      <p className="text-4xl font-black italic text-slate-900">₹{availableChallenges[selectedPlanIndex]?.cost}</p>
                      <p className="text-[10px] font-bold italic text-amber-600 uppercase">Daily Reward: ₹{availableChallenges[selectedPlanIndex]?.dailyReward}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black italic uppercase text-slate-400 flex items-center gap-1">
                        <AlertCircle size={12} className="text-slate-300" />
                        Penalty Rule
                      </p>
                      <p className="text-xs font-bold italic text-slate-600 leading-tight">
                        {availableChallenges[selectedPlanIndex]?.penaltyRule}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-amber-500 hover:bg-amber-600 rounded-2xl py-6 font-black italic uppercase text-[10px] gap-2 shadow-lg shadow-amber-900/10 text-white"
                        onClick={handlePurchaseKey}
                        disabled={isPurchasing}
                      >
                        {isPurchasing ? 'Processing...' : `Pay ₹${availableChallenges[selectedPlanIndex]?.cost || 0} via Online`}
                      </Button>

                      {((profile?.walletBalance || 0) + (profile?.rewardBalance || 0)) >= (availableChallenges[selectedPlanIndex]?.cost || 0) && (
                        <Button 
                          variant="outline"
                          className="w-full border-amber-100 bg-amber-50 text-amber-600 rounded-2xl py-6 font-black italic uppercase text-[10px]"
                          onClick={() => finalizePurchase(availableChallenges[selectedPlanIndex], 'WALLET_PAYMENT')}
                          disabled={isPurchasing}
                        >
                          Pay using Wallet Balance
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      {/* Collapsible: Terms & Conditions */}
      <CollapsibleSection 
        title="Terms & Conditions" 
        icon={FileText} 
        isOpen={openSection === 'terms'} 
        onToggle={() => toggleSection('terms')}
      >
        <div className="space-y-4 text-left">
          {systemSettings?.termsList && Array.isArray(systemSettings.termsList) && systemSettings.termsList.length > 0 ? (
            <div className="grid gap-3">
              {systemSettings.termsList.map((term: any) => (
                <Dialog key={term.id}>
                  <DialogTrigger nativeButton={false} render={
                    <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:bg-slate-50 transition-all cursor-pointer group shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-400 group-hover:text-indigo-500 transition-colors">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{term.title}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Released: {new Date(term.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-400 transition-all" />
                    </div>
                  } />
                  <DialogContent className="rounded-[2rem] sm:max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4">
                      <DialogTitle className="text-2xl font-black italic">{term.title}</DialogTitle>
                      <DialogDescription>Effective from {new Date(term.createdAt).toLocaleDateString()}</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-8 pb-8">
                      <div className="prose prose-slate prose-sm max-w-none">
                        <ReactMarkdown>{term.content}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">End of Document</p>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-[2rem] border border-slate-100">
              <FileText className="text-slate-200 mx-auto mb-2" size={40} />
              <p className="text-sm text-slate-400 font-bold italic tracking-tight">No active agreements found.</p>
            </div>
          )}
          <p className="text-[10px] text-slate-400 font-medium italic px-4">
            * All agreements are binding and should be reviewed carefully.
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
};

// Helper component for collapsible sections
const CollapsibleSection: React.FC<{
  title: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  extraHeader?: React.ReactNode;
}> = ({ title, icon: Icon, isOpen, onToggle, children, extraHeader }) => {
  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white">
      <div className="flex items-center pr-4">
        <button 
          type="button"
          className="flex-1 flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-none outline-none text-left"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${isOpen ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'} transition-all`}>
              <Icon size={20} />
            </div>
            <h3 className={`font-bold text-sm ${isOpen ? 'text-indigo-600' : 'text-slate-900'}`}>{title}</h3>
          </div>
          {isOpen ? <ChevronUp size={18} className="text-indigo-600" /> : <ChevronDown size={18} className="text-slate-300" />}
        </button>
        {extraHeader && <div className="ml-2">{extraHeader}</div>}
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-2 pb-6 px-6">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default Profile;
