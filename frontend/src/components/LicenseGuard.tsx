import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, getDoc, collection, onSnapshot, writeBatch, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ShoppingCart, Key, ShieldAlert, CreditCard, ChevronLeft, ChevronRight, Lock, CheckCircle2, Wallet, Coins, Upload } from 'lucide-react';
import { format } from 'date-fns';

const LicenseGuard: React.FC<{ children: React.ReactNode, mode?: string }> = ({ children, mode }) => {
  const { user, profile } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivatingKey, setIsActivatingKey] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<'razorpay' | 'cashfree' | 'payu' | 'wallet' | 'upi'>('razorpay');
  const [upiScreenshot, setUpiScreenshot] = useState<string>('');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);

  // Dynamic pricing for farmer
  const [farmerCapacity, setFarmerCapacity] = useState<number>(1000);

  useEffect(() => {
    if (plans[selectedPlanIndex]) {
      const plan = plans[selectedPlanIndex];
      if (plan.pricingType === 'per_bird') {
        setFarmerCapacity(plan.minCapacity || 1000);
      } else {
        setFarmerCapacity(plan.birdCapacity || 5000);
      }
    }
  }, [selectedPlanIndex, plans]);

  const calculatedPrice = useMemo(() => {
    const plan = plans[selectedPlanIndex];
    if (!plan) return 0;
    if (plan.pricingType === 'per_bird') {
      const cap = Number(farmerCapacity) || plan.minCapacity || 1000;
      const base = plan.price || 0;
      const rate = plan.pricePerBird || 0;
      return base + (cap * rate);
    }
    return plan.price || 0;
  }, [plans, selectedPlanIndex, farmerCapacity]);

  // Load plans and gateway configurations when the prompt is open
  useEffect(() => {
    if (!showPrompt) return;

    // Listen to licensePlans collection
    const unsubPlans = onSnapshot(collection(db, 'licensePlans'), (snap) => {
      if (!snap.empty) {
        setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        setPlans([
          { id: 'starter', name: 'Standard Breeder Key', price: 8500, birdCapacity: 5000, durationMonths: 12, features: 'Core tracking, daily logs, automatic alerts' },
          { id: 'commercial', name: 'Commercial Hub Key', price: 15000, birdCapacity: 15000, durationMonths: 12, features: 'Enterprise logs, regional manager assignment, priority veterinary advisory' },
          { id: 'enterprise', name: 'Mega Farms Integration', price: 32000, birdCapacity: 50000, durationMonths: 12, features: 'Custom sub-admins, automated batch integrations, full API ledger output' }
        ]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'licensePlans');
    });

    // Load available settings
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists()) {
          const settings = snap.data();
          setSystemSettings(settings);

          // Auto-select first enabled gateway
          const gateways = settings.paymentGateways;
          if (gateways?.cashfree?.enabled) {
            setSelectedGateway('cashfree');
          } else if (gateways?.razorpay?.enabled || (import.meta as any).env.VITE_RAZORPAY_KEY_ID) {
            setSelectedGateway('razorpay');
          } else if (gateways?.payu?.enabled) {
            setSelectedGateway('payu');
          }
          
          // Inject CDN scripts dynamically if they are enabled and not already loaded on window
          if (gateways?.razorpay?.enabled || (import.meta as any).env.VITE_RAZORPAY_KEY_ID) {
            if (!(window as any).Razorpay) {
              const script = document.createElement('script');
              script.src = 'https://checkout.razorpay.com/v1/checkout.js';
              script.async = true;
              document.body.appendChild(script);
            }
          }
          if (gateways?.cashfree?.enabled) {
            if (!(window as any).Cashfree) {
              const script = document.createElement('script');
              script.src = 'https://sdk.cashfree.com/js/v3/2021-11-01/cashfree.js';
              script.async = true;
              document.body.appendChild(script);
            }
          }
        }
      } catch (e) {
        console.error("Error loading system settings in LicenseGuard:", e);
      }
    };

    loadSettings();
    return () => unsubPlans();
  }, [showPrompt]);

  const isUnlicensed = profile && profile.role === 'farmer' && !profile.licenseActive;

  const handleContainerClick = (e: React.MouseEvent) => {
    if (isUnlicensed) {
      e.preventDefault();
      e.stopPropagation();
      setShowPrompt(true);
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

  const handleActivateLicense = async () => {
    if (!profile || !licenseKeyInput.trim()) return;
    setIsActivatingKey(true);
    try {
      // Query unused matching key
      const q = query(
        collection(db, 'licenseKeys'),
        where('key', '==', licenseKeyInput.trim()),
        where('status', '==', 'Unused')
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error('Invalid or already used license key');
        setIsActivatingKey(false);
        return;
      }

      const matchingDoc = snapshot.docs[0];
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'licenseKeys', matchingDoc.id), {
        status: 'Used',
        usedBy: profile.uid,
        usedByEmail: profile.email || '',
        activatedAt: Timestamp.now()
      });

      batch.update(doc(db, 'users', profile.uid), {
        licenseActive: true,
        licenseKey: licenseKeyInput.trim(),
        licenseActivatedAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success('License activated successfully! Enjoy full features.');
      setLicenseKeyInput('');
      setShowPrompt(false);
    } catch (e: any) {
      toast.error(`Failed to activate license: ${e.message || 'Permission denied'}`);
    } finally {
      setIsActivatingKey(false);
    }
  };

  const handlePurchaseKey = async () => {
    if (!profile) return;
    const plan = plans[selectedPlanIndex];
    if (!plan) {
      toast.error('No license plan selected');
      return;
    }

    setIsPurchasing(true);
    const finalPrice = plan.pricingType === 'per_bird' ? calculatedPrice : (plan.price || 0);
    const finalCapacity = plan.pricingType === 'per_bird' ? farmerCapacity : (plan.birdCapacity || 5000);

    try {
      if (finalPrice === 0) {
        await finalizePurchase(plan, 'FREE_PLAN');
        return;
      }

      if (selectedGateway === 'wallet') {
        const walletBalance = profile.walletBalance || 0;
        const rewardBalance = profile.rewardBalance || 0;
        if (walletBalance + rewardBalance < finalPrice) {
          toast.error("Insufficient wallet balance");
          setIsPurchasing(false);
          return;
        }
        await finalizePurchase(plan, 'WALLET_PAYMENT');
        return;
      }

      if (selectedGateway === 'upi') {
        if (!upiTxnId.trim()) {
          toast.error("Please enter the UPI Transaction Reference ID");
          setIsPurchasing(false);
          return;
        }
        if (!upiScreenshot) {
          toast.error("Please upload the payment screenshot receipt");
          setIsPurchasing(false);
          return;
        }

        const transId = Date.now().toString();
        const { setDoc, doc } = await import('firebase/firestore');
        
        await setDoc(doc(db, 'licenseVerifications', transId), {
          id: transId,
          userId: profile.uid,
          userName: profile.name || '',
          userEmail: profile.email || '',
          amount: finalPrice,
          planId: plan.id,
          planName: plan.name || '',
          days: plan.days || plan.durationDays || 365,
          birdCapacity: finalCapacity,
          transactionId: upiTxnId.trim(),
          screenshot: upiScreenshot,
          status: 'Pending',
          createdAt: new Date().toISOString()
        });

        // Also save to transactions as verification_pending
        await setDoc(doc(db, 'transactions', transId), {
          id: transId,
          userId: profile.uid,
          amount: finalPrice,
          type: 'Expense',
          description: `License Purchase Verification Pending (Ref: ${upiTxnId.trim()}): ${plan.name}`,
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'Pending Verification',
          createdAt: new Date()
        });

        toast.success("UPI Verification Request Submitted! Once approved by our team, your License Key will be activated.");
        setShowPrompt(false);
        setUpiScreenshot('');
        setUpiTxnId('');
        setIsPurchasing(false);
        return;
      }

      // Create Order on Server
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gateway: selectedGateway,
          amount: finalPrice,
          customerId: profile.uid,
          customerPhone: profile.phone || profile.mobile || "9999999999",
          customerEmail: profile.email || "customer@example.com"
        })
      });
      
      const orderData = await safeParseJson(orderRes);
      if (!orderRes.ok) throw new Error(orderData.error || orderData.message || "Failed to create order");

      if (selectedGateway === "razorpay") {
        const rzpKey = systemSettings?.paymentGateways?.razorpay?.apiKey || (import.meta as any).env.VITE_RAZORPAY_KEY_ID || "";
        const options = {
          key: rzpKey,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Bharat Nest Agro",
          description: `License Plan: ${plan.name}`,
          order_id: orderData.id,
          handler: function (response: any) {
            finalizePurchase(plan, response.razorpay_payment_id);
          },
          prefill: {
            name: profile.name || "",
            email: profile.email || "",
            contact: profile.phone || profile.mobile || ""
          },
          theme: { color: "#22c55e" },
          modal: {
            ondismiss: function() {
              setIsPurchasing(false);
            }
          }
        };

        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) {
          throw new Error("Razorpay SDK not loaded yet. Please try again.");
        }
        const rzp = new Razorpay(options);
        rzp.open();
      } else if (selectedGateway === "cashfree") {
        const Cashfree = (window as any).Cashfree;
        if (!Cashfree) {
          throw new Error('Cashfree SDK not loaded yet. Please try again.');
        }

        const mode = systemSettings?.paymentGateways?.cashfree?.mode === "production" ? "production" : "sandbox";
        const cashfree = new Cashfree({
          mode: mode, 
        });

        cashfree.checkout({
          paymentSessionId: orderData.payment_session_id,
          redirectTarget: "_self",
        }).catch((err: any) => {
          console.error("Cashfree redirect error:", err);
          toast.error("Cashfree redirection failed");
          setIsPurchasing(false);
        });
      } else if (selectedGateway === "payu") {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = orderData.action;

        const fields = {
          key: orderData.merchantKey,
          txnid: orderData.txnid,
          amount: orderData.amount,
          productinfo: orderData.productinfo || `License Plan: ${plan.name}`,
          firstname: profile.name || "Customer",
          email: orderData.email || profile.email || "customer@example.com",
          phone: profile.phone || profile.mobile || "9999999999",
          surl: `${window.location.origin}/profile?status=success&license_plan_id=${plan.id}&order_id=${orderData.txnid}`,
          furl: `${window.location.origin}/profile?status=failure&order_id=${orderData.txnid}`,
          hash: orderData.hash,
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
        return;
      }
    } catch (err: any) {
      console.error('Purchase Initialization Error:', err);
      toast.error(err.message || 'Could not initialize gateway checkout');
      setIsPurchasing(false);
    }
  };

  const finalizePurchase = async (plan: any, transactionId: string) => {
    try {
      const finalPrice = plan.pricingType === 'per_bird' ? calculatedPrice : (plan.price || 0);
      const finalCapacity = plan.pricingType === 'per_bird' ? farmerCapacity : (plan.birdCapacity || 5000);

      const newKey = `KEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const batch = writeBatch(db);
      
      const keyRef = doc(db, 'licenseKeys', newKey);
      batch.set(keyRef, {
        key: newKey,
        status: 'Active',
        createdAt: Timestamp.now(),
        planId: plan.id,
        planName: plan.name,
        validityDays: plan.days || plan.durationDays || 365,
        price: finalPrice,
        birdCapacity: finalCapacity,
        usedBy: profile?.uid,
        usedByEmail: profile?.email || '',
        activatedAt: Timestamp.now(),
        source: 'Online Purchase',
        transactionId: transactionId
      });

      const transId = Date.now().toString();
      batch.set(doc(db, 'transactions', transId), {
        id: transId,
        userId: profile?.uid,
        amount: finalPrice,
        type: 'Expense',
        description: `License Purchase: ${plan.name}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: Timestamp.now()
      });

      // Deduct wallet balance if paid via wallet
      if (transactionId === 'WALLET_PAYMENT') {
        const walletBalance = profile?.walletBalance || 0;
        const rewardBalance = profile?.rewardBalance || 0;
        let leftToDeduct = finalPrice;
        let newWallet = walletBalance;
        let newReward = rewardBalance;

        if (walletBalance >= leftToDeduct) {
          newWallet = walletBalance - leftToDeduct;
          leftToDeduct = 0;
        } else {
          newWallet = 0;
          leftToDeduct -= walletBalance;
          newReward = rewardBalance - leftToDeduct;
        }

        batch.update(doc(db, 'users', profile?.uid as string), {
          walletBalance: newWallet,
          rewardBalance: newReward
        });
      }

      batch.update(doc(db, 'users', profile?.uid as string), {
        licenseActive: true,
        licenseKey: newKey,
        licenseActivatedAt: new Date().toISOString(),
        birdCapacity: finalCapacity
      });

      await batch.commit();
      toast.success(`License "${plan.name}" successfully purchased & activated!`);
      setShowPrompt(false);
    } catch (e: any) {
      console.error('Finalize Purchase Error in LicenseGuard:', e);
      toast.error(`Failed to activate: ${e.message}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <div 
        onClickCapture={handleContainerClick} 
        className={isUnlicensed ? "cursor-pointer" : ""}
      >
        {children}
      </div>

      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="rounded-2xl max-w-md w-[95vw] border-slate-200 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-2">
              <ShieldAlert size={24} />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-center text-slate-900">
              ACTIVATION REQUIRED
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 text-center">
              This card is a premium module. Please purchase an authorized access plan or activate a valid serial key to proceed.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl w-full mb-6">
              <TabsTrigger value="plans" className="rounded-lg text-xs font-bold uppercase transition-all">Buy Plan</TabsTrigger>
              <TabsTrigger value="activate" className="rounded-lg text-xs font-bold uppercase transition-all">Enter Key</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full border-slate-200" 
                  onClick={() => setSelectedPlanIndex(prev => Math.max(0, prev - 1))} 
                  disabled={selectedPlanIndex === 0}
                >
                  <ChevronLeft size={16} />
                </Button>
                <div className="text-center flex-1 px-2">
                  <p className="text-sm font-black uppercase text-slate-900">{plans[selectedPlanIndex]?.name || 'Standard Plan'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{plans[selectedPlanIndex]?.durationMonths || 12} Months Validity</p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full border-slate-200" 
                  onClick={() => setSelectedPlanIndex(prev => Math.min(plans.length - 1, prev + 1))} 
                  disabled={selectedPlanIndex === plans.length - 1 || plans.length === 0}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>

              <div className="p-4 bg-[#FAF9F5] rounded-2xl border border-slate-100 text-center space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount to Pay</p>
                <p className="text-3xl font-black text-slate-900">₹{calculatedPrice.toLocaleString()}</p>
                {plans[selectedPlanIndex]?.pricingType === 'per_bird' ? (
                  <p className="text-[10px] font-medium text-indigo-650 font-semibold">Dynamic Rate: ₹{plans[selectedPlanIndex].pricePerBird}/bird + ₹{plans[selectedPlanIndex].price} base</p>
                ) : (
                  plans[selectedPlanIndex]?.birdCapacity && (
                    <p className="text-[10px] font-medium text-slate-500">Up to {plans[selectedPlanIndex].birdCapacity.toLocaleString()} Bird Capacity</p>
                  )
                )}
              </div>

              {plans[selectedPlanIndex]?.pricingType === 'per_bird' && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-left animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Specify Bird Capacity</Label>
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      Range: {plans[selectedPlanIndex].minCapacity?.toLocaleString() || '1,000'} - {plans[selectedPlanIndex].birdCapacity?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={plans[selectedPlanIndex].minCapacity || 1000}
                      max={plans[selectedPlanIndex].birdCapacity || 100000}
                      value={farmerCapacity}
                      onChange={(e) => setFarmerCapacity(Number(e.target.value) || 0)}
                      className="rounded-xl border-slate-200 bg-white font-bold h-10 text-sm"
                    />
                    <span className="text-xs font-bold text-slate-500">Birds</span>
                  </div>
                </div>
              )}

              {/* Payment Gateway Chooser */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Payment Method</Label>
                <div className="grid grid-cols-1 gap-2">
                  {/* Wallet Balance Integration */}
                  {(((profile?.walletBalance || 0) + (profile?.rewardBalance || 0)) >= calculatedPrice) && (
                    <div 
                      onClick={() => setSelectedGateway('wallet')}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedGateway === 'wallet' ? 'border-[#22c55e] bg-emerald-50/20' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Wallet Balance</p>
                          <p className="text-[10px] text-slate-400">Bal: ₹{(profile?.walletBalance || 0) + (profile?.rewardBalance || 0)}</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'wallet' ? 'border-[#22c55e] bg-[#22c55e]' : 'border-slate-300'}`}>
                        {selectedGateway === 'wallet' && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    </div>
                  )}

                  {/* Cashfree Integration */}
                  {systemSettings?.paymentGateways?.cashfree?.enabled && (
                    <div 
                      onClick={() => setSelectedGateway('cashfree')}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedGateway === 'cashfree' ? 'border-[#22c55e] bg-emerald-50/20' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Coins size={16} className="text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Cashfree instant Checkout</p>
                          <p className="text-[10px] text-slate-400">Cards, NetBanking, Walllets</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'cashfree' ? 'border-[#22c55e] bg-[#22c55e]' : 'border-slate-300'}`}>
                        {selectedGateway === 'cashfree' && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    </div>
                  )}

                  {/* Razorpay Integration */}
                  {(systemSettings?.paymentGateways?.razorpay?.enabled || (import.meta as any).env.VITE_RAZORPAY_KEY_ID) && (
                    <div 
                      onClick={() => setSelectedGateway('razorpay')}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedGateway === 'razorpay' ? 'border-[#22c55e] bg-emerald-50/20' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">Razorpay Unified Checkout</p>
                          <p className="text-[10px] text-slate-400">UPI, Cards, GPay, PhonePe</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'razorpay' ? 'border-[#22c55e] bg-[#22c55e]' : 'border-slate-300'}`}>
                        {selectedGateway === 'razorpay' && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    </div>
                  )}

                  {/* PayU Integration */}
                  {systemSettings?.paymentGateways?.payu?.enabled && (
                    <div 
                      onClick={() => setSelectedGateway('payu')}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedGateway === 'payu' ? 'border-[#22c55e] bg-emerald-50/20' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Coins size={16} className="text-indigo-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">PayU Secure Pay</p>
                          <p className="text-[10px] text-slate-400">Credit/Debit Cards, NetBanking</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'payu' ? 'border-[#22c55e] bg-[#22c55e]' : 'border-slate-300'}`}>
                        {selectedGateway === 'payu' && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    </div>
                  )}

                  {/* UPI Manual Bank Transfer */}
                  {systemSettings?.paymentGateways?.upi?.enabled && (
                    <div 
                      onClick={() => setSelectedGateway('upi')}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedGateway === 'upi' ? 'border-[#22c55e] bg-emerald-50/20' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-700">UPI Bank Transfer</p>
                          <p className="text-[10px] text-slate-400">Scan QR or Transfer manually</p>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'upi' ? 'border-[#22c55e] bg-[#22c55e]' : 'border-slate-300'}`}>
                        {selectedGateway === 'upi' && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* UPI Fields */}
              {selectedGateway === 'upi' && (
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-4 text-left">
                  <div className="text-center space-y-2 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Scan QR Code to pay</p>
                    {systemSettings?.paymentGateways?.upi?.qrCodeUrl && (
                      <img 
                        src={systemSettings.paymentGateways.upi.qrCodeUrl} 
                        alt="UPI QR Code" 
                        className="w-32 h-32 object-contain mx-auto border rounded-xl p-2 bg-slate-50"
                      />
                    )}
                    <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg inline-block select-all">
                      {systemSettings?.paymentGateways?.upi?.upiId || 'N/A'}
                    </p>
                    {systemSettings?.paymentGateways?.upi?.displayName && (
                      <p className="text-[10px] text-slate-500 font-semibold">{systemSettings.paymentGateways.upi.displayName}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">UPI Transaction Ref ID (12 Digit)</span>
                    <Input
                      id="guard-upi-txn-id"
                      placeholder="e.g. 340912345678"
                      value={upiTxnId}
                      onChange={(e) => setUpiTxnId(e.target.value)}
                      className="rounded-xl border-slate-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Upload Screenshot Receipt</span>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/*"
                        id="guard-upi-screenshot-input"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingScreenshot(true);
                            const reader = new FileReader();
                            reader.onload = () => {
                              setUpiScreenshot(reader.result as string);
                              setIsUploadingScreenshot(false);
                              toast.success("Screenshot uploaded successfully!");
                            };
                            reader.onerror = () => {
                              setIsUploadingScreenshot(false);
                              toast.error("Failed to read file screenshot");
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Button 
                        type="button"
                        variant="outline"
                        className="rounded-xl w-full border-dashed border-2 py-6 border-slate-300 flex items-center justify-center gap-2 hover:bg-slate-50 bg-white"
                        onClick={() => document.getElementById('guard-upi-screenshot-input')?.click()}
                      >
                        <Upload size={16} className="text-slate-500" />
                        <span className="text-xs font-medium text-slate-600">
                          {isUploadingScreenshot ? "Reading Receipt File..." : upiScreenshot ? "Change Screenshot Receipt" : "Choose Image Screenshot"}
                        </span>
                      </Button>
                    </div>
                    {upiScreenshot && (
                      <div className="relative mt-2 w-28 h-28 border rounded-xl overflow-hidden shadow-sm mx-auto">
                        <img src={upiScreenshot} alt="Screenshot Receipt" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button 
                className="w-full bg-[#22c55e] hover:bg-[#1ea852] text-white rounded-xl py-6 font-bold uppercase text-xs tracking-wider gap-2 shadow-sm transition-all"
                onClick={handlePurchaseKey}
                disabled={isPurchasing || plans.length === 0}
              >
                {isPurchasing ? 'Processing checkout...' : `Pay ₹${plans[selectedPlanIndex]?.price || 0} via ${selectedGateway === 'wallet' ? 'Wallet' : selectedGateway === 'cashfree' ? 'Cashfree' : selectedGateway === 'razorpay' ? 'Razorpay' : selectedGateway === 'payu' ? 'PayU' : 'UPI Transfer'}`}
              </Button>
            </TabsContent>

            <TabsContent value="activate" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guard-license-key" className="text-xs font-semibold uppercase text-slate-400">Enter License Key</Label>
                <Input 
                  id="guard-license-key"
                  placeholder="e.g. KEY-A1B2C3D4" 
                  value={licenseKeyInput}
                  onChange={e => setLicenseKeyInput(e.target.value.toUpperCase())}
                  className="rounded-xl border-slate-200 uppercase tracking-widest text-center py-5 text-sm"
                />
              </div>

              <Button 
                className="w-full bg-[#22c55e] hover:bg-[#1ea852] text-white rounded-xl py-5 font-bold uppercase text-xs tracking-wider gap-2 shadow-sm transition-all"
                onClick={handleActivateLicense} 
                disabled={isActivatingKey || !licenseKeyInput.trim()}
              >
                {isActivatingKey ? 'Activating Key...' : 'Validate & Activate Key'}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LicenseGuard;
