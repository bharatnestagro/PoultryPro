import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Search,
  MoreVertical,
  ArrowUpRight,
  Stethoscope,
  ClipboardList,
  User,
  Calendar,
  Truck,
  ChevronRight,
  Bell,
  AlertCircle
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { toast } from 'sonner';

import { useAuth } from '@/src/lib/AuthContext';

interface DailyLog {
  id: string;
  userId: string;
  flockId: string;
  date: string;
  health: {
    mortality: number;
    medicines: string;
    vaccines: string;
  };
  consumption: {
    feedIntake: number;
    waterIntake: number;
  };
  notes: string;
  status?: string;
}

const AdminOperations: React.FC = () => {
  const { user: currentUser, isAdmin, isManager } = useAuth();
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [healthAlerts, setHealthAlerts] = useState<any[]>([]);
  const [nonCompliantFarmers, setNonCompliantFarmers] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DailyLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch Users for mapping
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(u => {
        const data = u.data();
        if (isManager && !isAdmin) {
          if (data.managerId === currentUser?.uid || data.assignedManagerId === currentUser?.uid) {
            map[u.id] = data;
          }
        } else {
          map[u.id] = data;
        }
      });
      setUsersMap(map);
    });

    // Fetch Recent Logs
    const qLogs = query(collection(db, 'dailyLogs'), orderBy('date', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const allLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyLog));
      setRecentLogs(allLogs);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, [currentUser?.uid, isManager]);

  useEffect(() => {
    const filterAndDerive = async () => {
      if (!recentLogs.length) return;

      // Filter logs by users assigned to manager
      const filtered = recentLogs.filter(l => {
        if (isManager && !isAdmin) {
          return !!usersMap[l.userId];
        }
        return true;
      });
      setFilteredLogs(filtered.slice(0, 50));

      // Extract health alerts
      const alerts = filtered.filter(l => 
        l.health?.mortality > 5 || 
        l.notes?.toLowerCase().includes('sick') || 
        l.notes?.toLowerCase().includes('disease')
      );
      setHealthAlerts(alerts);

      // Identify non-compliant farmers (missed > 3 days)
      try {
        const activeFlocksSnap = await getDocs(query(collection(db, 'flocks'), where('status', '==', 'Active')));
        const activeFlocks = activeFlocksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        const today = new Date();
        const nonCompliant = [];

        for (const flock of activeFlocks) {
          if (isManager && !usersMap[flock.userId]) continue;

          // Check if this flock has logs
          const flockLogs = filtered.filter(l => l.flockId === flock.id);
          
          if (flockLogs.length > 0) {
            const latestLog = flockLogs[0];
            const lastLogDate = parseISO(latestLog.date);
            const daysSinceLastLog = differenceInDays(today, lastLogDate);
            
            if (daysSinceLastLog > 3) {
              nonCompliant.push({
                flockId: flock.id,
                flockName: flock.name,
                userId: flock.userId,
                lastLogDate: latestLog.date,
                daysMissed: daysSinceLastLog
              });
            }
          } else if (flock.placementDate) {
            const placementDate = parseISO(flock.placementDate);
            const daysSincePlacement = differenceInDays(today, placementDate);
            if (daysSincePlacement > 3) {
              nonCompliant.push({
                flockId: flock.id,
                flockName: flock.name,
                userId: flock.userId,
                lastLogDate: 'Never',
                daysMissed: daysSincePlacement
              });
            }
          }
        }
        setNonCompliantFarmers(nonCompliant);
      } catch (error) {
        console.error("Error identifying non-compliant farmers:", error);
      }
    };

    filterAndDerive();
  }, [recentLogs, usersMap, isManager]);

  const handleApproveLog = async (logId: string) => {
    try {
      await updateDoc(doc(db, 'dailyLogs', logId), {
        status: 'Reviewed',
        reviewedAt: new Date()
      });
      toast.success('Log marked as reviewed');
    } catch (error) {
      toast.error('Failed to update log status');
    }
  };

  const handleSendReminder = (farmerName: string) => {
    toast.success(`Reminder sent to ${farmerName}`);
    // In a real app, this would trigger a push notification or SMS
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Operations Hub</h2>
          <p className="text-slate-500 font-medium mt-1">Monitor daily farm activities and health status</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl border-slate-200 font-bold text-slate-600 h-12 px-6">
            <ClipboardList size={18} className="mr-2" />
            Audit Logs
          </Button>
          <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl font-bold h-12 px-8 shadow-lg shadow-emerald-900/10">
            Create Task
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileText size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logs Today</p>
              <h3 className="text-2xl font-bold text-slate-900">{filteredLogs.filter(l => l.date === format(new Date(), 'yyyy-MM-dd')).length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <CheckCircle2 size={12} />
            <span>92% COMPLIANCE</span>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
              <Stethoscope size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Alerts</p>
              <h3 className="text-2xl font-bold text-slate-900">{healthAlerts.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 w-fit px-2 py-1 rounded-lg">
            <AlertTriangle size={12} />
            <span>URGENT ATTENTION</span>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <ClipboardList size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Reviews</p>
              <h3 className="text-2xl font-bold text-slate-900">{filteredLogs.filter(l => !l.status).length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
            <Clock size={12} />
            <span>NEEDS APPROVAL</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Logs Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Daily Activity Stream</h3>
                <p className="text-xs text-slate-400 font-medium">Real-time farm submission monitoring</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-9 bg-white border-slate-100 rounded-xl h-10 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farmer</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feed/Water</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLogs.filter(log => {
                    const farmer = usersMap[log.userId];
                    const searchStr = (farmer?.name || '' + log.notes || '').toLowerCase();
                    return searchStr.includes(searchTerm.toLowerCase());
                  }).map((log) => {
                    const farmer = usersMap[log.userId];
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                              <User size={14} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{farmer?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{log.date}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className={`rounded-lg text-[10px] border-none px-2 py-0.5 ${
                            log.health?.mortality > 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {log.health?.mortality || 0} Birds
                          </Badge>
                        </td>
                        <td className="px-4 py-5">
                          <p className="text-[10px] font-bold text-slate-700">{log.consumption?.feedIntake || 0}kg / {log.consumption?.waterIntake || 0}L</p>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className={`rounded-lg text-[10px] border-none px-2 py-0.5 ${
                            log.status === 'Reviewed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {log.status || 'Pending'}
                          </Badge>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-xl text-[10px] font-bold text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleApproveLog(log.id)}
                            disabled={log.status === 'Reviewed'}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Health Alerts Sidebar */}
        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-900">Critical Health Alerts</h3>
              <p className="text-xs text-slate-400 font-medium">Immediate intervention required</p>
            </div>
            <div className="p-6 space-y-4">
              {healthAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  No critical health alerts
                </div>
              ) : (
                healthAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 rounded-2xl bg-red-50/50 border border-red-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">{usersMap[alert.userId]?.name}</p>
                        <h4 className="text-sm font-bold text-slate-900">Mortality Spike: {alert.health?.mortality} Birds</h4>
                      </div>
                      <AlertTriangle size={18} className="text-red-500" />
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed italic">"{alert.notes || 'No specific notes provided'}"</p>
                    <div className="flex gap-2">
                      <Button className="flex-1 h-9 rounded-xl text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white border-none">
                        Dispatch Vet
                      </Button>
                      <Button variant="outline" className="h-9 rounded-xl text-[11px] font-bold border-slate-200 text-slate-600">
                        Call
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-900">Log Compliance Alerts</h3>
              <p className="text-xs text-slate-400 font-medium">Missed &gt; 3 consecutive days</p>
            </div>
            <div className="p-6 space-y-4">
              {nonCompliantFarmers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-sm">
                  All farmers are compliant!
                </div>
              ) : (
                nonCompliantFarmers.map((alert) => (
                  <div key={alert.flockId} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">{usersMap[alert.userId]?.name}</p>
                        <h4 className="text-sm font-bold text-slate-900">{alert.flockName}</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          Last Log: <span className="font-bold">{alert.lastLogDate}</span>
                        </p>
                      </div>
                      <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                        <Clock size={16} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-bold px-2 py-0.5">
                        {alert.daysMissed} DAYS MISSED
                      </Badge>
                      <Button 
                        size="sm" 
                        className="h-8 rounded-xl text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white border-none px-4"
                        onClick={() => handleSendReminder(usersMap[alert.userId]?.name || 'Farmer')}
                      >
                        <Bell size={12} className="mr-1" />
                        Remind
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-900">Upcoming Tasks</h3>
              <p className="text-xs text-slate-400 font-medium">Scheduled farm operations</p>
            </div>
            <div className="p-6 space-y-4">
              {[
                { id: 1, task: 'Vaccination: Gumboro', farm: 'Green Valley', date: 'Tomorrow', type: 'Health' },
                { id: 2, task: 'Feed Delivery: Starter', farm: 'Sunshine Poultry', date: 'Apr 16', type: 'Logistics' },
                { id: 3, task: 'Batch Harvest', farm: 'Hillside Farm', date: 'Apr 18', type: 'Operations' },
              ].map((task) => (
                <div key={task.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    task.type === 'Health' ? 'bg-red-50 text-red-600' :
                    task.type === 'Logistics' ? 'bg-blue-50 text-blue-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {task.type === 'Health' ? <Stethoscope size={20} /> :
                     task.type === 'Logistics' ? <Truck size={20} /> :
                     <ClipboardList size={20} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{task.task}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">{task.farm} • {task.date}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminOperations;
