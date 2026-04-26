import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CreditCard, Save, Plus, Trash2, Calendar } from 'lucide-react';

interface LicensePlan {
  id: string;
  name: string;
  days: number;
  price: number;
  description: string;
}

const AdminKeyPricing: React.FC = () => {
  const [plans, setPlans] = useState<LicensePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const d = await getDoc(doc(db, 'settings', 'licensePlans'));
        if (d.exists()) {
          setPlans(d.data().plans || []);
        } else {
          // Default plan if none exists
          setPlans([{ id: 'std', name: 'Standard Plan', days: 365, price: 999, description: '1 Year Full Access' }]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    };
    fetchPricing();
  }, []);

  const handleAddPlan = () => {
    const newPlan: LicensePlan = {
      id: Date.now().toString(),
      name: 'New Plan',
      days: 30,
      price: 0,
      description: 'Description here'
    };
    setPlans([...plans, newPlan]);
  };

  const handleUpdatePlan = (id: string, field: keyof LicensePlan, value: string | number) => {
    setPlans(plans.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemovePlan = (id: string) => {
    setPlans(plans.filter(p => p.id !== id));
  };

  const handleSave = async () => {
    if (!plans || plans.length === 0) {
      toast.error('Please add at least one plan');
      return;
    }
    console.log('Attempting to save license plans:', plans);
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const plansRef = doc(db, 'settings', 'licensePlans');
      const pricingRef = doc(db, 'settings', 'keyPricing');
      
      console.log('Writing to licensePlans:', plansRef.path);
      batch.set(plansRef, {
        plans,
        updatedAt: new Date().toISOString()
      });
      
      console.log('Writing to keyPricing (legacy):', pricingRef.path);
      batch.set(pricingRef, {
        price: plans[0].price,
        updatedAt: new Date().toISOString()
      });
      
      await batch.commit();
      console.log('Plans update batch committed successfully');
      toast.success('Pricing plans updated successfully');
    } catch (e: any) {
      console.error('CRITICAL: Plan Update Permission Error:', e);
      toast.error(`Failed to update plans: ${e.message || 'Check permissions'}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-slate-400">Loading plans...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">License Plans & Pricing</h1>
          <p className="text-slate-500 text-sm">Define subscription tiers for farmers</p>
        </div>
        <Button onClick={handleAddPlan} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2">
          <Plus size={18} />
          Add New Plan
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="bg-white border-none shadow-sm overflow-hidden group">
            <div className="h-1 w-full bg-indigo-500" />
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-bold">
                  <Input 
                    value={plan.name} 
                    onChange={e => handleUpdatePlan(plan.id, 'name', e.target.value)}
                    className="border-none p-0 text-lg font-bold h-7 focus-visible:ring-0 shadow-none bg-transparent"
                  />
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-300 hover:text-red-500 rounded-lg"
                  onClick={() => handleRemovePlan(plan.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <Input 
                value={plan.description} 
                onChange={e => handleUpdatePlan(plan.id, 'description', e.target.value)}
                className="border-none p-0 text-xs text-slate-500 h-5 focus-visible:ring-0 shadow-none bg-transparent"
                placeholder="Plan description..."
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Validity (Days)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <Input 
                      type="number"
                      value={plan.days}
                      onChange={e => handleUpdatePlan(plan.id, 'days', Number(e.target.value))}
                      className="rounded-xl pl-9 h-10 border-slate-100 bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                    <Input 
                      type="number"
                      value={plan.price}
                      onChange={e => handleUpdatePlan(plan.id, 'price', Number(e.target.value))}
                      className="rounded-xl pl-8 h-10 border-slate-100 bg-slate-50/50 font-bold"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <CreditCard className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-medium">No pricing plans defined yet.</p>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave} 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-12 py-6 gap-2 shadow-lg shadow-indigo-900/20"
        >
          <Save size={20} />
          {loading ? 'Saving Changes...' : 'Save All Plans'}
        </Button>
      </div>
    </div>
  );
};

export default AdminKeyPricing;
