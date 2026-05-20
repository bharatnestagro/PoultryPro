import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Trophy, Search, PlusCircle, Medal, Trash2, CheckCircle2, 
  Sparkles, Award, Star, Zap, User, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const AdminChallenges: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [userChallenges, setUserChallenges] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPlan, setShowAddPlan] = useState(false);

  const [newPlan, setNewPlan] = useState({
    title: '',
    targetMetric: 'FCR < 1.45',
    prizePool: '2500',
    description: '',
    durationDays: '35',
    active: true
  });

  useEffect(() => {
    // 1. Fetch real challenge plans
    const unsubPlans = onSnapshot(
      collection(db, 'challengePlans'),
      (snap) => {
        setPlans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback standard gamified challenges if collection empty
        const defaultPlans = [
          {
            id: 'plan-1',
            title: 'FCR Optimization Speedrun',
            targetMetric: 'Food Conversion Ratio < 1.40',
            prizePool: '5000',
            description: 'Maintain high bird body weight gain with minimal feed intake. Supervised audit.',
            durationDays: '35',
            active: true
          },
          {
            id: 'plan-2',
            title: 'Zero Mortalities Championship',
            targetMetric: 'Mortality Rate = 0%',
            prizePool: '10000',
            description: 'Successfully lift a full broiler batch without any bird casualties. Ideal bio-security.',
            durationDays: '40',
            active: true
          }
        ];
        setPlans(defaultPlans);
        setLoading(false);
      }
    );

    // 2. Fetch active participating user challenge links
    const unsubUserChalls = onSnapshot(collection(db, 'userChallenges'), (snap) => {
      setUserChallenges(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch farmers
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPlans();
      unsubUserChalls();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'N/A';
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.title || !newPlan.prizePool) {
      toast.error('Challenge Title and cash prize pool are required');
      return;
    }

    try {
      await addDoc(collection(db, 'challengePlans'), {
        title: newPlan.title,
        targetMetric: newPlan.targetMetric,
        prizePool: Number(newPlan.prizePool),
        description: newPlan.description,
        durationDays: Number(newPlan.durationDays),
        active: newPlan.active,
        createdAt: new Date().toISOString()
      });

      toast.success('Gamified challenge milestone activated inside the marketplace');
      setShowAddPlan(false);
      setNewPlan({ title: '', targetMetric: 'FCR < 1.45', prizePool: '2500', description: '', durationDays: '35', active: true });
    } catch (err) {
      toast.error('Failed to register challenge');
    }
  };

  const toggleChallengeActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'challengePlans', id), { active: !current });
      toast.info(`Challenge status toggled!`);
    } catch (err) {
      toast.error('Failed to edit challenge activation state');
    }
  };

  const handleDelete = async (planId: string) => {
    try {
      await deleteDoc(doc(db, 'challengePlans', planId));
      toast.success('Challenge milestone purged successfully');
    } catch (err) {
      toast.error('Challenge purge failed');
    }
  };

  const filteredPlans = plans.filter(p => {
    const title = (p.title || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return title.includes(term) || desc.includes(term);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none font-sans">
      
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Trophy size={32} className="text-yellow-500 animate-pulse fill-yellow-200" />
            GAMIFIED MILESTONES & REWARDS
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Motivate breeder standards through cash back challenges and digital tags
          </p>
        </div>

        <Dialog open={showAddPlan} onOpenChange={setShowAddPlan}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-indigo-600 hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Deploy New Challenge
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800 font-sans">DEPLOY BREEDER CHALLENGE</DialogTitle>
              <CardDescription className="text-xs">Breeder goals reward cash back directly inside the farmer wallet balances.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleCreatePlan} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Challenge Theme</Label>
                <Input 
                  id="title"
                  required
                  placeholder="e.g. 100% Vaccination Speedrun"
                  value={newPlan.title}
                  onChange={e => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Target Metric</Label>
                  <Input 
                    required
                    placeholder="e.g. FCR < 1.45"
                    value={newPlan.targetMetric}
                    onChange={e => setNewPlan({ ...newPlan, targetMetric: e.target.value })}
                    className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                  />
                </div>
                
                <div className="space-y-1.5 font-mono">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Prize Pool Cashback (INR)</Label>
                  <Input 
                    type="number"
                    required
                    placeholder="e.g. 5000"
                    value={newPlan.prizePool}
                    onChange={e => setNewPlan({ ...newPlan, prizePool: e.target.value })}
                    className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-center font-black italic text-[#10B981] text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Duration in Days</Label>
                  <Input 
                    type="number"
                    required
                    placeholder="e.g. 35"
                    value={newPlan.durationDays}
                    onChange={e => setNewPlan({ ...newPlan, durationDays: e.target.value })}
                    className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Milestone Description</Label>
                <textarea
                  id="desc"
                  required
                  placeholder="Elaborate rules... e.g., All active daily logs must be submitted before 22:00 with mortality = 0% throughout broiler life duration."
                  value={newPlan.description}
                  onChange={e => setNewPlan({ ...newPlan, description: e.target.value })}
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 rounded-2xl border border-slate-150 bg-slate-55 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:font-normal"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-opacity-95 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Deploy Challenge
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main active challenges grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Challenge blueprints setting catalog */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-50">
            <div>
              <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Active Challenges blueprints</CardTitle>
              <CardDescription className="text-xs">Master rewards deployed in the system catalogs</CardDescription>
            </div>
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 rounded-full text-xs font-medium focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-50 mt-4">
            {filteredPlans.length === 0 ? (
              <p className="text-center py-6 text-xs font-bold text-slate-405">No challenge plans active</p>
            ) : (
              filteredPlans.map((p) => (
                <div key={p.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-800">{p.title}</span>
                      <Badge className={p.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[8px] font-black' : 'bg-slate-100 text-slate-500 text-[8px]'}>
                        {p.active ? 'Deploy Active' : 'Suspended'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium max-w-sm">{p.description}</p>
                    <p className="text-[10px] text-emerald-600 font-bold font-mono">
                      Metric: {p.targetMetric} • Prize: ₹{p.prizePool.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => toggleChallengeActive(p.id, p.active)}
                      className="h-7 text-[9px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border-none font-bold uppercase tracking-wider"
                    >
                      {p.active ? 'Suspend' : 'Activate'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(p.id)}
                      className="w-7 h-7 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-full"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Real Live Participant Leaderboard */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Award className="text-yellow-500 fill-yellow-100" size={18} />
              Live Participant Standings
            </CardTitle>
            <CardDescription className="text-xs">Real time submissions and review status of live challenge seekers</CardDescription>
          </div>

          <div className="overflow-x-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider">Farmer</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider">Target Goal</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userChallenges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-xs text-slate-400 font-bold">
                      No participating farmers currently enrolled
                    </TableCell>
                  </TableRow>
                ) : (
                  userChallenges.map((uc) => (
                    <TableRow key={uc.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-3">
                        <p className="font-extrabold text-xs text-slate-805">{getFarmerName(uc.userId)}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">Enrolled: {uc.joinedAt || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-500">
                        {uc.planTitle || 'FCR Optimization'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`uppercase text-[8px] font-extrabold rounded-full ${
                          uc.status === 'Completed' || uc.status === 'Won'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {uc.status || 'Active Journey'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default AdminChallenges;
