import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, writeBatch, collection, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CreditCard, Save, Plus, Trash2, Calendar, Trophy, AlertCircle, Wallet, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LicensePlan {
  id: string;
  name: string;
  days: number;
  price: number;
  description: string;
}

interface ChallengePlan {
  id: string;
  title: string;
  cost: number;
  durationDays: number;
  dailyReward: number;
  penaltyRule: string;
  minWithdrawalPerOrder: number;
  active: boolean;
}

const AdminKeyPricing: React.FC = () => {
  const [plans, setPlans] = useState<LicensePlan[]>([]);
  const [challenges, setChallenges] = useState<ChallengePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const d = await getDoc(doc(db, 'settings', 'licensePlans'));
        if (d.exists()) {
          setPlans(d.data().plans || []);
        } else {
          setPlans([{ id: 'std', name: 'Standard Plan', days: 365, price: 999, description: '1 Year Full Access' }]);
        }

        const s = await getDoc(doc(db, 'system', 'settings'));
        if (s.exists()) {
          setSystemSettings(s.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    };

    const unsubChallenges = onSnapshot(collection(db, 'challengePlans'), (snap) => {
      setChallenges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChallengePlan)));
    });

    fetchPricing();
    return () => unsubChallenges();
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

  const handleAddChallenge = async () => {
    const newChallenge: Partial<ChallengePlan> = {
      title: 'New Challenge',
      cost: 3000,
      durationDays: 90,
      dailyReward: 30,
      penaltyRule: 'Miss 1 day in a week -> Lose that week reward (30x7)',
      minWithdrawalPerOrder: 1000,
      active: true
    };
    try {
      await addDoc(collection(db, 'challengePlans'), {
        ...newChallenge,
        createdAt: Timestamp.now()
      });
      toast.success('Challenge added successfully');
    } catch (e) {
      toast.error('Failed to add challenge');
    }
  };

  const handleUpdateChallenge = async (id: string, field: keyof ChallengePlan, value: any) => {
    try {
      await updateDoc(doc(db, 'challengePlans', id), { [field]: value });
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) return;
    try {
      await deleteDoc(doc(db, 'challengePlans', id));
      toast.success('Challenge deleted');
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const handleSave = async () => {
    if (!plans || plans.length === 0) {
      toast.error('Please add at least one plan');
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const plansRef = doc(db, 'settings', 'licensePlans');
      const pricingRef = doc(db, 'settings', 'keyPricing');
      const systemRef = doc(db, 'system', 'settings');
      
      batch.set(plansRef, {
        plans,
        updatedAt: new Date().toISOString()
      });
      
      batch.set(pricingRef, {
        price: plans[0].price,
        updatedAt: new Date().toISOString()
      });

      if (systemSettings) {
        batch.set(systemRef, {
          ...systemSettings,
          updatedAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast.success('Pricing plans and settings updated successfully');
    } catch (e: any) {
      toast.error(`Failed to update plans: ${e.message || 'Check permissions'}`);
    } finally {
      setLoading(false);
    }
  };

  const [isEditingChallenge, setIsEditingChallenge] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<any>(null);

  const handleOpenEdit = (challenge: any) => {
    setCurrentChallenge({ ...challenge });
    setIsEditingChallenge(true);
  };

  const saveChallengeEdit = async () => {
    if (!currentChallenge) return;
    try {
      setLoading(true);
      const { id, ...data } = currentChallenge;
      await updateDoc(doc(db, 'challengePlans', id), {
        ...data,
        updatedAt: Timestamp.now()
      });
      toast.success('Challenge updated successfully');
      setIsEditingChallenge(false);
    } catch (e: any) {
      toast.error('Failed to update challenge: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-slate-400">Loading plans...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      {/* License Plans Section */}
      <section className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black italic text-slate-900 uppercase">License Plans & Pricing</h1>
            <p className="text-slate-500 font-bold italic text-sm">Define subscription tiers for farmers</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
               <Label className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Global Reward Withdraw Limit (₹)</Label>
               <Input 
                 type="number"
                 value={systemSettings?.minRewardWithdraw || 500}
                 onChange={e => setSystemSettings({...systemSettings, minRewardWithdraw: Number(e.target.value)})}
                 className="w-32 h-10 rounded-xl font-black italic text-center border-slate-100 bg-slate-50/50"
               />
            </div>
            <Button onClick={handleAddPlan} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2 font-bold italic text-xs uppercase h-10">
              <Plus size={18} />
              Add New Plan
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="bg-white border-none shadow-sm overflow-hidden group border-l-4 border-l-indigo-500">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold">
                    <Input 
                      value={plan.name} 
                      onChange={e => handleUpdatePlan(plan.id, 'name', e.target.value)}
                      className="border-none p-0 text-lg font-black italic uppercase h-7 focus-visible:ring-0 shadow-none bg-transparent"
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
                  className="border-none p-0 text-xs font-bold italic text-slate-500 h-5 focus-visible:ring-0 shadow-none bg-transparent"
                  placeholder="Plan description..."
                />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Validity (Days)</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <Input 
                        type="number"
                        value={plan.days}
                        onChange={e => handleUpdatePlan(plan.id, 'days', Number(e.target.value))}
                        className="rounded-xl pl-9 h-10 border-slate-100 bg-slate-50/50 font-bold italic"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase italic">Price (₹)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs italic">₹</span>
                      <Input 
                        type="number"
                        value={plan.price}
                        onChange={e => handleUpdatePlan(plan.id, 'price', Number(e.target.value))}
                        className="rounded-xl pl-8 h-10 border-slate-100 bg-slate-50/50 font-black italic"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-12 py-6 gap-2 shadow-lg shadow-indigo-900/20 font-black italic uppercase text-xs"
          >
            <Save size={20} />
            {loading ? 'Saving Changes...' : 'Save All Plans'}
          </Button>
        </div>
      </section>

      {/* Challenges Section */}
      <section className="space-y-6 pt-12 border-t border-slate-100">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black italic text-slate-900 uppercase flex items-center gap-2">
              <Trophy className="text-amber-500" />
              Farmer Challenges
            </h2>
            <p className="text-slate-500 font-bold italic text-sm">Create earning challenges for daily data entry</p>
          </div>
          <Button onClick={handleAddChallenge} className="bg-amber-500 hover:bg-amber-600 rounded-xl gap-2 font-black italic text-xs uppercase text-white shadow-lg shadow-amber-900/20">
            <Plus size={18} />
            Add New Challenge
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="bg-white border-none shadow-sm overflow-hidden group border-l-4 border-l-amber-500">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="text-left">
                     <h3 className="text-lg font-black italic uppercase text-slate-900">{challenge.title}</h3>
                     <p className="text-[10px] font-bold italic text-slate-400 uppercase">Status: {challenge.active ? 'Available' : 'Paused'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-300 hover:text-indigo-600 rounded-lg"
                      onClick={() => handleOpenEdit(challenge)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-300 hover:text-red-500 rounded-lg"
                      onClick={() => handleDeleteChallenge(challenge.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black italic text-slate-400 uppercase">Daily Reward</p>
                    <p className="text-lg font-black italic text-emerald-600">₹{challenge.dailyReward}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black italic text-slate-400 uppercase">Entry Fee</p>
                    <p className="text-lg font-black italic text-slate-900">₹{challenge.cost}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black italic uppercase text-slate-500 bg-slate-50 p-3 rounded-xl">
                   <span>Duration: {challenge.durationDays} Days</span>
                   <span className="text-amber-600 border-l border-slate-200 pl-3">Min Withdrawal: ₹{challenge.minWithdrawalPerOrder}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {challenges.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-black italic uppercase text-xs">No challenge plans defined yet.</p>
          </div>
        )}
      </section>

      {/* Edit Challenge Dialog */}
      <Dialog open={isEditingChallenge} onOpenChange={setIsEditingChallenge}>
        <DialogContent className="rounded-[2rem] max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase">Edit Challenge</DialogTitle>
          </DialogHeader>
          {currentChallenge && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-black italic uppercase text-slate-500">Challenge Title</Label>
                <Input 
                  value={currentChallenge.title}
                  onChange={e => setCurrentChallenge({...currentChallenge, title: e.target.value})}
                  className="rounded-xl border-slate-200 font-bold italic"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black italic uppercase text-slate-500">Duration (Days)</Label>
                  <Input 
                    type="number"
                    value={currentChallenge.durationDays}
                    onChange={e => setCurrentChallenge({...currentChallenge, durationDays: Number(e.target.value)})}
                    className="rounded-xl border-slate-200 font-bold italic"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black italic uppercase text-slate-500">Entry Fee (₹)</Label>
                  <Input 
                    type="number"
                    value={currentChallenge.cost}
                    onChange={e => setCurrentChallenge({...currentChallenge, cost: Number(e.target.value)})}
                    className="rounded-xl border-slate-200 font-bold italic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black italic uppercase text-slate-500">Daily Reward (₹)</Label>
                  <Input 
                    type="number"
                    value={currentChallenge.dailyReward}
                    onChange={e => setCurrentChallenge({...currentChallenge, dailyReward: Number(e.target.value)})}
                    className="rounded-xl border-slate-200 font-bold italic"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black italic uppercase text-slate-500">Min. Withdrawal (₹)</Label>
                  <Input 
                    type="number"
                    value={currentChallenge.minWithdrawalPerOrder}
                    onChange={e => setCurrentChallenge({...currentChallenge, minWithdrawalPerOrder: Number(e.target.value)})}
                    className="rounded-xl border-slate-200 font-bold italic"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black italic uppercase text-slate-500">Penalty / Rules</Label>
                <Textarea 
                  value={currentChallenge.penaltyRule}
                  onChange={e => setCurrentChallenge({...currentChallenge, penaltyRule: e.target.value})}
                  className="rounded-xl border-slate-200 font-bold italic min-h-[100px]"
                  placeholder="What happens if farmer misses a day?"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="text-left">
                    <p className="text-[10px] font-black italic uppercase text-slate-700">Active Status</p>
                    <p className="text-[8px] font-bold italic text-slate-400 uppercase">If inactive, farmers can't see/join this</p>
                 </div>
                 <Switch 
                   checked={currentChallenge.active} 
                   onCheckedChange={(checked) => setCurrentChallenge({...currentChallenge, active: checked})}
                 />
              </div>

              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6 font-black italic uppercase text-xs shadow-lg shadow-indigo-900/20 mt-4"
                onClick={saveChallengeEdit}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Save Challenge Details'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKeyPricing;
