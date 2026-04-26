import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Bird, 
  Settings2, 
  Weight, 
  Calendar,
  IndianRupee,
  Truck,
  ArrowRight,
  ClipboardCheck,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const ManagerFlocks: React.FC = () => {
  const { profile } = useAuth();
  const [flocks, setFlocks] = useState<any[]>([]);
  const [myFarmers, setMyFarmers] = useState<any[]>([]);
  const [selectedFlock, setSelectedFlock] = useState<any>(null);
  const [isLiftingModalOpen, setIsLiftingModalOpen] = useState(false);
  const [liftingData, setLiftingData] = useState({
    liftingRate: '',
    maleRate: '',
    femaleRate: '',
    avgWeightRequired: '',
    targetCosting: '',
    liftingDays: '',
    scheduledDate: '',
    notes: ''
  });

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(collection(db, 'users'), where('managerId', '==', profile.uid));
    const unsubscribeFarmers = onSnapshot(q, (snapshot) => {
      const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyFarmers(farmers);
      
      const farmerIds = farmers.map(f => f.id);
      if (farmerIds.length > 0) {
        const flockQ = query(collection(db, 'flocks'), where('status', '==', 'Active'));
        onSnapshot(flockQ, (flockSnap) => {
          const allFlocks = flockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFlocks(allFlocks.filter((f: any) => farmerIds.includes(f.userId)));
        });
      }
    });

    return () => unsubscribeFarmers();
  }, [profile?.uid]);

  const openLiftingModal = (flock: any) => {
    setSelectedFlock(flock);
    setLiftingData({
      liftingRate: flock.liftingStrategy?.liftingRate || '',
      maleRate: flock.liftingStrategy?.maleRate || '',
      femaleRate: flock.liftingStrategy?.femaleRate || '',
      avgWeightRequired: flock.liftingStrategy?.avgWeightRequired || '',
      targetCosting: flock.liftingStrategy?.targetCosting || '',
      liftingDays: flock.liftingStrategy?.liftingDays || '',
      scheduledDate: flock.liftingStrategy?.scheduledDate || '',
      notes: flock.liftingStrategy?.notes || ''
    });
    setIsLiftingModalOpen(true);
  };

  const handleUpdateLifting = async () => {
    if (!selectedFlock) return;
    
    try {
      await updateDoc(doc(db, 'flocks', selectedFlock.id), {
        liftingStrategy: {
          ...liftingData,
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.uid
        }
      });
      toast.success('Lifting strategy updated');
      setIsLiftingModalOpen(false);
    } catch (error) {
      toast.error('Failed to update strategy');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Flock Management</h1>
        <p className="text-slate-500 font-medium">Configure lifting strategies and market rates for active batches</p>
      </div>

      <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100 h-16">
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 px-8">Batch Details</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Age (Days)</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Lifting Rate</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Scheduled</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-right px-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flocks.map(flock => {
                const owner = myFarmers.find(f => f.id === flock.userId);
                const age = Math.floor((new Date().getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                const strategy = flock.liftingStrategy;

                return (
                  <TableRow key={flock.id} className="group border-slate-50 hover:bg-slate-50/80 transition-colors h-22">
                    <TableCell className="px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-all">
                          <Bird size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{flock.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{owner?.name || 'Unknown Farmer'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-lg font-black px-4 py-1.5 h-8">
                        {age} Days
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black">
                      {strategy?.liftingRate ? (
                        <div className="flex flex-col items-center">
                          <span className="text-slate-900 text-sm italic font-black">₹{strategy.liftingRate}/kg</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-tighter">M: ₹{strategy.maleRate} | F: ₹{strategy.femaleRate}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs italic font-medium">Not Set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {strategy?.scheduledDate ? (
                        <div className="flex flex-col items-center">
                          <span className="text-emerald-600 text-sm font-black">{strategy.scheduledDate}</span>
                          <span className="text-[9px] text-emerald-400 uppercase tracking-widest font-black">Lifting Scheduled</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 text-[9px] font-bold border-slate-100">UNSCHEDULED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-2xl h-10 px-6 bg-slate-900 text-white font-black text-[10px] hover:bg-black transition-all shadow-md active:scale-95"
                        onClick={() => openLiftingModal(flock)}
                      >
                         <Settings2 size={14} className="mr-2" />
                         MANAGE STRATEGY
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {flocks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-60 text-center text-slate-300 italic">
                    No active batches found for management.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isLiftingModalOpen} onOpenChange={setIsLiftingModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-xl w-[95vw] border-none shadow-2xl overflow-hidden p-0">
          <div className="p-8 bg-slate-900 text-white">
             <div className="flex items-center gap-4 mb-2 opacity-50">
                <Bird size={20} />
                <span className="text-xs font-bold uppercase tracking-widest">Lifting Strategy Configuration</span>
             </div>
             <DialogTitle className="text-4xl font-black italic">{selectedFlock?.name}</DialogTitle>
             <p className="text-slate-400 font-medium text-sm mt-2">Set market rates and schedule for this batch</p>
          </div>
          
          <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Base Lifting Rate (₹/KG)</Label>
                   <div className="relative">
                      <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <Input 
                        placeholder="e.g. 105" 
                        className="rounded-2xl pl-10 h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900" 
                        value={liftingData.liftingRate}
                        onChange={(e) => setLiftingData({...liftingData, liftingRate: e.target.value})}
                      />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Avg Weight Required (KG)</Label>
                   <div className="relative">
                      <Weight size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <Input 
                        placeholder="e.g. 2.100" 
                        className="rounded-2xl pl-10 h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900"
                        value={liftingData.avgWeightRequired}
                        onChange={(e) => setLiftingData({...liftingData, avgWeightRequired: e.target.value})}
                      />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Target Production Cost / Bird (₹)</Label>
                   <div className="relative">
                      <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <Input 
                        placeholder="e.g. 185" 
                        className="rounded-2xl pl-10 h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900" 
                        value={liftingData.targetCosting}
                        onChange={(e) => setLiftingData({...liftingData, targetCosting: e.target.value})}
                      />
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Male Rate</Label>
                   <Input 
                     placeholder="e.g. 108" 
                     className="rounded-2xl h-12 bg-white border-slate-100" 
                     value={liftingData.maleRate}
                     onChange={(e) => setLiftingData({...liftingData, maleRate: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Female Rate</Label>
                   <Input 
                     placeholder="e.g. 102" 
                     className="rounded-2xl h-12 bg-white border-slate-100" 
                     value={liftingData.femaleRate}
                     onChange={(e) => setLiftingData({...liftingData, femaleRate: e.target.value})}
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Lifting Cycle (Days)</Label>
                   <div className="relative">
                      <ArrowRight size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <Input 
                        placeholder="e.g. 38" 
                        className="rounded-2xl pl-10 h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900" 
                        value={liftingData.liftingDays}
                        onChange={(e) => setLiftingData({...liftingData, liftingDays: e.target.value})}
                      />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Schedule Lifting Date</Label>
                   <div className="relative">
                      <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <Input 
                        type="date" 
                        className="rounded-2xl pl-10 h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900" 
                        value={liftingData.scheduledDate}
                        onChange={(e) => setLiftingData({...liftingData, scheduledDate: e.target.value})}
                      />
                   </div>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Strategy Notes</Label>
                <Input 
                  placeholder="Additional instructions for logistics..." 
                  className="rounded-2xl h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900" 
                  value={liftingData.notes}
                  onChange={(e) => setLiftingData({...liftingData, notes: e.target.value})}
                />
             </div>
          </div>

          <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
             <Button variant="ghost" className="rounded-2xl font-bold text-slate-500" onClick={() => setIsLiftingModalOpen(false)}>CANCEL</Button>
             <Button className="rounded-2xl h-12 px-8 bg-slate-900 hover:bg-black text-white font-black tracking-widest text-xs shadow-xl active:scale-95 transition-all" onClick={handleUpdateLifting}>
                SAVE STRATEGY
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerFlocks;
