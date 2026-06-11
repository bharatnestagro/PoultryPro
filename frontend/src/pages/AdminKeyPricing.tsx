import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { KeyRound, ShieldAlert, Sparkles, Plus, Edit2, CheckCircle2, IndianRupee, Trash2, Calendar, Users, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const AdminKeyPricing: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog & state for Create/Edit Form
  const [isOpen, setIsOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [formDays, setFormDays] = useState('365');
  const [formFeatures, setFormFeatures] = useState('');

  // Dynamic pricing states
  const [pricingType, setPricingType] = useState<'flat' | 'per_bird'>('flat');
  const [pricePerBird, setPricePerBird] = useState('0');
  const [minCapacity, setMinCapacity] = useState('1000');
  const [autoFetchValidate, setAutoFetchValidate] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'licensePlans'),
      (snap) => {
        if (snap.empty) {
          // Initialize defaults offline if empty
          const defaults = [
            { id: 'starter', name: 'Standard Breeder Key', price: 8500, birdCapacity: 5000, days: 365, durationMonths: 12, features: 'Core tracking, daily logs, automatic alerts', pricingType: 'flat', pricePerBird: 0, minCapacity: 0 },
            { id: 'commercial', name: 'Commercial Hub Key', price: 15000, birdCapacity: 15000, days: 365, durationMonths: 12, features: 'Enterprise logs, regional manager assignment, priority veterinary advisory', pricingType: 'flat', pricePerBird: 0, minCapacity: 0 },
            { id: 'enterprise', name: 'Mega Farms Integration', price: 32000, birdCapacity: 50000, days: 365, durationMonths: 12, features: 'Custom sub-admins, automated batch integrations, full API ledger output', pricingType: 'flat', pricePerBird: 0, minCapacity: 0 }
          ];
          defaults.forEach(async (d) => {
            await setDoc(doc(db, 'licensePlans', d.id), d);
          });
          setPlans(defaults);
        } else {
          setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const openCreateModal = () => {
    setEditingPlanId(null);
    setFormName('');
    setFormPrice('');
    setFormCapacity('');
    setFormDays('365');
    setFormFeatures('');
    setPricingType('flat');
    setPricePerBird('0');
    setMinCapacity('1000');
    setAutoFetchValidate(true);
    setIsOpen(true);
  };

  const openEditModal = (plan: any) => {
    setEditingPlanId(plan.id);
    setFormName(plan.name || '');
    setFormPrice(plan.price?.toString() || '');
    setFormCapacity(plan.birdCapacity?.toString() || '');
    setFormDays(plan.days?.toString() || plan.durationDays?.toString() || (plan.durationMonths ? (plan.durationMonths * 30).toString() : '365'));
    setFormFeatures(plan.features || '');
    setPricingType(plan.pricingType || 'flat');
    setPricePerBird(plan.pricePerBird?.toString() || '0');
    setMinCapacity(plan.minCapacity?.toString() || '1000');
    setAutoFetchValidate(plan.autoFetchValidate !== false);
    setIsOpen(true);
  };

  const handleSavePlan = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    const priceNum = Number(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    const capacityNum = Number(formCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      toast.error('Please enter a valid farm capacity (must be greater than 0)');
      return;
    }
    const daysNum = Number(formDays);
    if (isNaN(daysNum) || daysNum <= 0) {
      toast.error('Please enter valid validity days');
      return;
    }

    const pricePerBirdNum = Number(pricePerBird);
    const minCapacityNum = Number(minCapacity);

    if (pricingType === 'per_bird') {
      if (isNaN(pricePerBirdNum) || pricePerBirdNum <= 0) {
        toast.error('Please enter a valid rate per bird');
        return;
      }
      if (isNaN(minCapacityNum) || minCapacityNum <= 0) {
        toast.error('Please enter a valid minimum capacity');
        return;
      }
      if (minCapacityNum >= capacityNum) {
        toast.error('Minimum capacity must be smaller than the maximum capacity');
        return;
      }
    }

    try {
      const planData = {
        name: formName.trim(),
        price: priceNum,
        birdCapacity: capacityNum,
        days: daysNum,
        durationMonths: Math.ceil(daysNum / 30),
        features: formFeatures.trim() || 'Core tracking, daily logs, automatic alerts',
        pricingType,
        pricePerBird: pricingType === 'per_bird' ? pricePerBirdNum : 0,
        minCapacity: pricingType === 'per_bird' ? minCapacityNum : 0,
        autoFetchValidate
      };

      if (editingPlanId) {
        await updateDoc(doc(db, 'licensePlans', editingPlanId), planData);
        toast.success(`License plan "${formName}" updated successfully`);
      } else {
        const newRef = doc(collection(db, 'licensePlans'));
        await setDoc(newRef, { id: newRef.id, ...planData });
        toast.success(`License plan "${formName}" created successfully`);
      }
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save plan: ' + err.message);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete the plan "${planName}"? Users will no longer be able to purchase it.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'licensePlans', planId));
      toast.success(`License plan "${planName}" deleted successfully`);
    } catch (err: any) {
      toast.error('Failed to delete licensing plan: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title block with Create Plan action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <KeyRound size={32} className="text-emerald-600" />
            KEY ACTIVATION & LICENSING PRICING
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Define commercial activation subscription models, bird caps, and standard pricing logs
          </p>
        </div>
        <Button 
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white uppercase text-xs tracking-wider rounded-2xl h-12 px-6 flex items-center gap-2 self-start sm:self-auto shadow-md"
        >
          <Plus size={16} /> Create New Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-slate-100 shadow-md rounded-[2.2rem] bg-white overflow-hidden relative p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className="bg-indigo-50 hover:bg-slate-100 text-[#4F46E5] text-[9px] font-black uppercase tracking-wider rounded-full border border-indigo-150 px-2.5">
                    {plan.days || plan.durationDays || (plan.durationMonths ? plan.durationMonths * 30 : 365)} DAYS VALIDITY
                  </Badge>
                  <h3 className="text-xl font-bold text-slate-800 mt-2">{plan.name}</h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-[#4F46E5]">
                  <KeyRound size={18} />
                </div>
              </div>

              <div className="space-y-1">
                {plan.pricingType === 'per_bird' ? (
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider block mb-0.5">Dynamic Tier Pricing</span>
                    <p className="text-3xl font-extrabold text-slate-900 flex items-baseline gap-1">
                      ₹{plan.price.toLocaleString()} Base
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      + <span className="text-emerald-600 font-extrabold">₹{plan.pricePerBird}</span> per bird capacity
                    </p>
                    <p className="text-[11px] text-indigo-600 font-bold mt-2">
                      Cap range: {plan.minCapacity?.toLocaleString() || '1,000'} - {plan.birdCapacity.toLocaleString()} Birds
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-extrabold text-slate-900 flex items-baseline gap-1">
                      ₹{plan.price.toLocaleString()}
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">/ Period</span>
                    </p>
                    <p className="text-xs text-emerald-600 font-black mt-2">
                      Flat Cap limit: {plan.birdCapacity.toLocaleString()} Active Birds
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-50 pt-4 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Plan Highlights:</span>
                <p className="text-xs text-slate-500 leading-normal font-semibold">
                  {plan.features}
                </p>
                {plan.autoFetchValidate !== false && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/75 border border-indigo-100 text-[9px] text-[#4F46E5] font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                    Auto-Fetch & Enforce Enabled
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 mt-6 grid grid-cols-2 gap-2">
              <Button 
                onClick={() => openEditModal(plan)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold uppercase tracking-wider border-none h-11"
              >
                <Edit2 size={13} className="mr-1.5" /> Edit
              </Button>
              <Button 
                onClick={() => handleDeletePlan(plan.id, plan.name)}
                variant="destructive"
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-2xl text-xs font-bold uppercase tracking-wider border-none h-11"
              >
                <Trash2 size={13} className="mr-1.5" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#4F46E5] uppercase tracking-wide">Dynamic Software Licensing Controls</h4>
            <p className="text-xs text-slate-500 leading-normal mt-0.5 max-w-xl">
              When farmers paste license keys, their active bird capacities and plan tiers are referenced automatically from this database configuration.
            </p>
          </div>
        </div>
      </div>

      {/* Plan Form Dialog (Create / Edit) */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-3xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase tracking-tight text-slate-900">
              {editingPlanId ? 'EDIT LICENSE PLAN' : 'CREATE NEW LICENSE PLAN'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {editingPlanId ? 'Adjust licensing configurations for this tier' : 'Establish a new commercial tier with custom bird and validity limits'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Pricing Type Segmented Control */}
            <div className="space-y-1 text-left">
              <Label className="text-[10px] font-black uppercase text-slate-500 pl-1">Pricing Scheme</Label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setPricingType('flat')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${pricingType === 'flat' ? 'bg-white text-[#4F46E5] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Flat Rate
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('per_bird')}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${pricingType === 'per_bird' ? 'bg-white text-[#4F46E5] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Per active Bird
                </button>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <Label htmlFor="plan-name" className="text-[10px] font-black uppercase text-slate-500 pl-1">Plan Name</Label>
              <div className="relative">
                <Input 
                  id="plan-name"
                  placeholder="e.g. Standard Breeder Key"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-left">
                <Label htmlFor="plan-price" className="text-[10px] font-black uppercase text-slate-500 pl-1">
                  {pricingType === 'per_bird' ? 'Base Price (₹ INR)' : 'Flat Price (₹ INR)'}
                </Label>
                <div className="relative">
                  <Input 
                    id="plan-price"
                    type="number"
                    placeholder="8500"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <Label htmlFor="plan-days" className="text-[10px] font-black uppercase text-slate-500 pl-1">Validity (Days)</Label>
                <div className="relative">
                  <Input 
                    id="plan-days"
                    type="number"
                    placeholder="365"
                    value={formDays}
                    onChange={e => setFormDays(e.target.value)}
                    className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                  />
                </div>
              </div>
            </div>

            {pricingType === 'per_bird' && (
              <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-1 text-left">
                  <Label htmlFor="price-per-bird" className="text-[10px] font-black uppercase text-slate-500 pl-1">Price Per Bird (₹)</Label>
                  <Input 
                    id="price-per-bird"
                    type="number"
                    step="0.01"
                    placeholder="1.50"
                    value={pricePerBird}
                    onChange={e => setPricePerBird(e.target.value)}
                    className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                  />
                </div>

                <div className="space-y-1 text-left">
                  <Label htmlFor="min-capacity" className="text-[10px] font-black uppercase text-slate-500 pl-1">Min Capacity</Label>
                  <Input 
                    id="min-capacity"
                    type="number"
                    placeholder="1000"
                    value={minCapacity}
                    onChange={e => setMinCapacity(e.target.value)}
                    className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1 text-left">
              <Label htmlFor="plan-capacity" className="text-[10px] font-black uppercase text-slate-500 pl-1">
                {pricingType === 'per_bird' ? 'Max Farm Capacity (Birds)' : 'Farm Capacity (Max Birds)'}
              </Label>
              <div className="relative">
                <Input 
                  id="plan-capacity"
                  type="number"
                  placeholder="5000"
                  value={formCapacity}
                  onChange={e => setFormCapacity(e.target.value)}
                  className="rounded-2xl h-12 pl-4 border-slate-100 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <Label htmlFor="plan-features" className="text-[10px] font-black uppercase text-slate-500 pl-1">Plan Highlights</Label>
              <div className="relative">
                <Input 
                  id="plan-features"
                  placeholder="Core tracking, daily logs, automatic alerts"
                  value={formFeatures}
                  onChange={e => setFormFeatures(e.target.value)}
                  className="rounded-2xl h-12 pl-4 border-slate-100 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-2xl text-left">
              <div className="space-y-0.5 max-w-[75%]">
                <Label className="text-[10px] font-black uppercase text-indigo-950 block">Auto-Fetch & Validate</Label>
                <p className="text-[9px] text-slate-500 font-semibold leading-normal">
                  Fetch farmer's profile capacity onto purchase, and prevent checking out capacity below their active flocks total birds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoFetchValidate(!autoFetchValidate)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-350 shrink-0 ${autoFetchValidate ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-350 ${autoFetchValidate ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)} 
              className="rounded-2xl h-12 border-slate-100 uppercase text-[10px] font-black tracking-widest flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSavePlan} 
              className="bg-[#22c55e] hover:bg-[#1ea852] text-white rounded-2xl h-12 uppercase text-[10px] font-black tracking-widest flex-1"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKeyPricing;
