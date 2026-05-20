import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  HeartPulse, AlertTriangle, ShieldCheck, Stethoscope, 
  Search, MessageSquare, Check, X, Bell, Activity, 
  CornerDownRight, CheckCircle2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminHealth: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Veterinary recommendation modal / message
  const [feedbackPhone, setFeedbackPhone] = useState('');
  const [feedbackFarmerId, setFeedbackFarmerId] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  useEffect(() => {
    // 1. Fetch Daily Logs with health alerts or mortalities
    const unsubLogs = onSnapshot(
      query(collection(db, 'dailyLogs'), orderBy('timestamp', 'desc')),
      (snap) => {
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLogs(list);
        setLoading(false);
      },
      () => {
        // Fallback mock logs if collection is empty or rules denied
        setLogs([
          {
            id: 'mock-1',
            date: format(new Date(), 'yyyy-MM-dd'),
            flockId: 'flock-alpha',
            mortality: 4,
            symptoms: 'Mild respiratory coughing',
            alerts: { abnormalBehavior: 'Lethargy, huddling near heat sources' },
            feedConsumed: 120,
            waterConsumed: 300,
            userId: 'farmer-101',
            averageWeight: 450
          },
          {
            id: 'mock-2',
            date: format(new Date(), 'yyyy-MM-dd'),
            flockId: 'flock-beta',
            mortality: 12,
            symptoms: 'Loose droppings, standard diarrhea',
            alerts: { abnormalBehavior: 'Inappetence, high huddling' },
            feedConsumed: 90,
            waterConsumed: 220,
            userId: 'farmer-102',
            averageWeight: 680
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch Flocks to map names
    const unsubFlocks = onSnapshot(
      collection(db, 'flocks'),
      (snap) => {
        setFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      () => {}
    );

    // 3. Fetch Farmers
    const unsubFarmers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      () => {}
    );

    return () => {
      unsubLogs();
      unsubFlocks();
      unsubFarmers();
    };
  }, []);

  const getFlockName = (id: string) => {
    return flocks.find(f => f.id === id)?.name || id || 'N/A';
  };

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || 'Anonymity Farmer';
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackFarmerId || !feedbackMessage) {
      toast.error('Please select farmer and write message');
      return;
    }
    try {
      setIsSendingFeedback(true);
      // Save notification/alert for the farmer to see
      await addDoc(collection(db, 'notifications'), {
        userId: feedbackFarmerId,
        title: 'Veterinary Advisory',
        message: feedbackMessage,
        type: 'health',
        read: false,
        createdAt: new Date().toISOString()
      });
      // Also write to general alerts collection
      await addDoc(collection(db, 'alerts'), {
        userId: feedbackFarmerId,
        message: `Veterinary message: ${feedbackMessage}`,
        status: 'Resolved',
        createdAt: new Date().toISOString()
      });
      toast.success('Recommendation dispatched successfully');
      setFeedbackMessage('');
      setFeedbackFarmerId('');
    } catch (err) {
      toast.error('Failed to send advisory');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // Compute metrics
  const logsWithAlerts = logs.filter(l => 
    l.mortality > 0 || 
    l.symptoms || 
    (l.alerts && Object.values(l.alerts).some(v => v))
  );

  const filteredAlertLogs = logsWithAlerts.filter(l => {
    const fn = getFlockName(l.flockId).toLowerCase();
    const usm = getFarmerName(l.userId).toLowerCase();
    const sym = (l.symptoms || '').toLowerCase();
    const bhv = (l.alerts?.abnormalBehavior || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fn.includes(term) || usm.includes(term) || sym.includes(term) || bhv.includes(term);
  });

  const totalMortality = logs.reduce((sum, current) => sum + (Number(current.mortality) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Stethoscope className="text-emerald-600" size={32} />
            HEALTH & CLINICAL REPORTING
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Veterinary observation tracking and disease diagnostics center
          </p>
        </div>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-[1.8rem]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center">
              <AlertTriangle className="fill-red-100" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Alerts</p>
              <h3 className="text-2xl font-extrabold text-slate-800">{logsWithAlerts.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-[1.8rem]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center">
              <HeartPulse />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Mortality</p>
              <h3 className="text-2xl font-extrabold text-slate-800">{totalMortality} Birds</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-[1.8rem]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E0E7FF] text-[#4F46E5] border border-[#C7D2FE] flex items-center justify-center">
              <Activity />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Flocks Monitored</p>
              <h3 className="text-2xl font-extrabold text-[#4F46E5]">{flocks.length}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-[1.8rem]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <ShieldCheck />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Health Rating</p>
              <h3 className="text-2xl font-extrabold text-emerald-600">Stable</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Logs visualizer listing */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="p-0 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black italic tracking-wide text-slate-800">CLINICAL OBSERVATIONS</CardTitle>
                  <CardDescription className="text-xs">Farmer-submitted abnormal behaviors or clinical symptoms</CardDescription>
                </div>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    placeholder="Search symptoms / flocks..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Date & Flock</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Farmer</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Mortality</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Clinical Signs</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider font-mono text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlertLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-slate-400 font-bold">
                        No critical clinical observations reported
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlertLogs.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell className="py-4">
                          <p className="font-bold text-xs text-slate-800">{getFlockName(item.flockId)}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{item.date || 'N/A'}</p>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">
                          {getFarmerName(item.userId)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.mortality > 5 ? 'destructive' : 'secondary'} className="rounded-full text-[10px] font-black italic">
                            {item.mortality || 0} dead
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {item.symptoms && (
                            <p className="text-xs font-black text-red-700 leading-tight">
                              Symptoms: <span className="font-medium text-slate-500">{item.symptoms}</span>
                            </p>
                          )}
                          {item.alerts?.abnormalBehavior && (
                            <p className="text-[11px] font-semibold text-slate-500 leading-tight mt-1 bg-amber-50 rounded p-1 border border-amber-150 flex items-start gap-1">
                              <CornerDownRight size={10} className="mt-0.5 text-amber-600 flex-shrink-0" />
                              <span>{item.alerts.abnormalBehavior}</span>
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          <Badge className="bg-orange-100 hover:bg-orange-150 text-orange-850 font-bold tracking-widest uppercase text-[8px] rounded-full border border-orange-200">
                            Attention Needed
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

        {/* Prescription / Veterinary advisory tool */}
        <div>
          <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <CardTitle className="text-base font-black italic tracking-wide text-slate-800 flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#4F46E5]" />
                  VETERINARY ADVISORY
                </CardTitle>
                <CardDescription className="text-xs">Issue recommendations, dosage info, or safety measures directly.</CardDescription>
              </div>

              <form onSubmit={handleSendFeedback} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Select Affected Farmer</label>
                  <Select value={feedbackFarmerId} onValueChange={setFeedbackFarmerId} required>
                    <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-100 text-xs font-bold">
                      <SelectValue placeholder="Choose Farmer" />
                    </SelectTrigger>
                    <SelectContent>
                      {farmers.filter(f => f.role === 'farmer' || !f.role).map((f) => (
                        <SelectItem key={f.id} value={f.id} className="text-xs font-bold">
                          {f.name || 'Untitled Agent'} ({f.farmName || 'Unassigned Farm'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Veterinary Recommendation</label>
                  <textarea
                    placeholder="Provide detailed instructions e.g. administer Enrofloxacin 10% inside drinking water for next 3 days. Verify bio-security..."
                    value={feedbackMessage}
                    onChange={e => setFeedbackMessage(e.target.value)}
                    rows={5}
                    required
                    className="w-full text-xs font-semibold p-3.5 rounded-2xl border border-slate-100 bg-slate-55 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:font-normal"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSendingFeedback}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-750 text-white rounded-2xl text-xs font-bold uppercase tracking-widest"
                >
                  {isSendingFeedback ? 'Dispatching advisory...' : 'Send Advisory'}
                </Button>
              </form>
            </div>

            <div className="mt-6 border-t border-slate-50 pt-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={12} />
                Bio-Security Protocols
              </h4>
              <p className="text-[10px] text-emerald-700 leading-normal mt-1">
                Ensure boots and vehicle tires are sterilized when traveling across manager fields. Mortality exceeding 10% demands quarantine of poultry blocks.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminHealth;
