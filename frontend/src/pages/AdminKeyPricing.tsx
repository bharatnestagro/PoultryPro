import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { KeyRound, ShieldAlert, Sparkles, Plus, Edit2, CheckCircle2, IndianRupee, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const AdminKeyPricing: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New pricing plan states
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [editingCapacity, setEditingCapacity] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'licensePlans'),
      (snap) => {
        if (snap.empty) {
          // Initialize defaults offline if empty
          const defaults = [
            { id: 'starter', name: 'Standard Breeder Key', price: 8500, birdCapacity: 5000, durationMonths: 12, features: 'Core tracking, daily logs, automatic alerts' },
            { id: 'commercial', name: 'Commercial Hub Key', price: 15000, birdCapacity: 15000, durationMonths: 12, features: 'Enterprise logs, regional manager assignment, priority veterinary advisory' },
            { id: 'enterprise', name: 'Mega Farms Integration', price: 32000, birdCapacity: 50000, durationMonths: 12, features: 'Custom sub-admins, automated batch integrations, full API ledger output' }
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

  const handleUpdatePrice = async (planId: string) => {
    if (!editingPrice || Number(editingPrice) <= 0) {
      toast.error('Please input a valid price');
      return;
    }
    try {
      await updateDoc(doc(db, 'licensePlans', planId), {
        price: Number(editingPrice),
        birdCapacity: Number(editingCapacity)
      });
      toast.success('Licensing Tier pricing model adjusted successfully');
      setIsEditing(null);
    } catch (err) {
      toast.error('Failed to change pricing model');
    }
  };

  const startEdit = (plan: any) => {
    setIsEditing(plan.id);
    setEditingPrice(plan.price.toString());
    setEditingCapacity(plan.birdCapacity.toString());
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
      
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <KeyRound size={32} className="text-emerald-600" />
          KEY ACTIVATION & LICENSING PRICING
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Define commercial activation subscription models, bird caps, and standard pricing logs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-slate-100 shadow-md rounded-[2.2rem] bg-white overflow-hidden relative p-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className="bg-indigo-50 hover:bg-slate-100 text-[#4F46E5] text-[9px] font-black uppercase tracking-wider rounded-full border border-indigo-150 px-2.5">
                    {plan.durationMonths} MONTHS VALIDITY
                  </Badge>
                  <h3 className="text-xl font-bold text-slate-800 mt-2">{plan.name}</h3>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-[#4F46E5]">
                  <KeyRound size={18} />
                </div>
              </div>

              {isEditing === plan.id ? (
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-105">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-450">INR Yearly Price</Label>
                    <Input 
                      type="number"
                      value={editingPrice}
                      onChange={e => setEditingPrice(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-450">Max Batch Capacity (Birds)</Label>
                    <Input 
                      type="number"
                      value={editingCapacity}
                      onChange={e => setEditingCapacity(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm"
                      onClick={() => handleUpdatePrice(plan.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs rounded-xl"
                    >
                      Save
                    </Button>
                    <Button 
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditing(null)}
                      className="text-xs text-slate-500 rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-4xl font-extrabold text-slate-900 flex items-baseline gap-1">
                    ₹{plan.price.toLocaleString()}
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">/ Yr</span>
                  </p>
                  <p className="text-xs text-emerald-600 font-black mt-2">
                    Capacity Cap: {plan.birdCapacity.toLocaleString()} Active Birds
                  </p>
                </div>
              )}

              <div className="border-t border-slate-50 pt-4 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Plan Highlights:</span>
                <p className="text-xs text-slate-500 leading-normal font-semibold">
                  {plan.features}
                </p>
              </div>
            </div>

            {isEditing !== plan.id && (
              <div className="pt-6 border-t border-slate-50 mt-6 md:pt-0 md:mt-0">
                <Button 
                  onClick={() => startEdit(plan)}
                  className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold uppercase tracking-widest border-none"
                >
                  <Edit2 size={13} className="mr-2" /> Modify Tier Pricing
                </Button>
              </div>
            )}
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
              When farmers paste license keys, their active bird capacities and plan tiers are referenced automatically from this commercial database configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminKeyPricing;
