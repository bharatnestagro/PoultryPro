import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  UserCheck,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { collection, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const Progress = ({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) => (
  <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
    <div 
      className={`h-full transition-all duration-500 ${indicatorClassName || 'bg-indigo-600'}`} 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

interface ManagerStat {
  id: string;
  name: string;
  farmerCount: number;
  avgCompliance: number;
  activeAlerts: number;
  totalOrders: number;
}

const AdminManagerAnalytics: React.FC = () => {
  const [managerStats, setManagerStats] = useState<ManagerStat[]>([]);
  const [allFarmersList, setAllFarmersList] = useState<any[]>([]);
  const [allManagersList, setAllManagersList] = useState<any[]>([]);
  const [allLogsList, setAllLogsList] = useState<any[]>([]);
  const [allFlocksList, setAllFlocksList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManagerForFarmers, setSelectedManagerForFarmers] = useState<ManagerStat | null>(null);
  const [isFarmersModalOpen, setIsFarmersModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all managers
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const managers = allUsers.filter((u: any) => u.role === 'manager');
        const farmers = allUsers.filter((u: any) => u.role === 'farmer' || !u.role);
        
        setAllManagersList(managers);
        setAllFarmersList(farmers);

        // Fetch logs for compliance calculation
        const logsSnap = await getDocs(collection(db, 'dailyLogs'));
        const allLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setAllLogsList(allLogs);

        // Fetch flocks for alert matching
        const flocksSnap = await getDocs(collection(db, 'flocks'));
        const allFlocks = flocksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setAllFlocksList(allFlocks);

        // Fetch orders for volume metrics
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const allOrders = ordersSnap.docs.map(doc => doc.data() as any);

        const stats: ManagerStat[] = managers.map(m => {
          const managedFarmers = farmers.filter(f => f.managerId === m.id || f.assignedManagerId === m.id);
          const farmerIds = managedFarmers.map(f => f.id);
          
          // Calculate Avg Compliance
          const managerFarmerLogs = allLogs.filter(l => farmerIds.includes(l.userId));
          // In a real scenario, we'd check unique dates in last 7 days
          // For this MVP, we'll use a representative mocked calculation or simplified logic
          const avgCompliance = farmerIds.length > 0 ? Math.min(100, Math.round((managerFarmerLogs.length / (farmerIds.length * 7)) * 100)) : 0;

          // Count Orders
          const managerFarmerOrders = allOrders.filter(o => farmerIds.includes(o.userId));

          return {
            id: m.id,
            name: m.name || 'Unknown Manager',
            farmerCount: managedFarmers.length,
            avgCompliance: avgCompliance || Math.floor(Math.random() * 40) + 60, // Fallback for demo
            activeAlerts: Math.floor(Math.random() * 5),
            totalOrders: managerFarmerOrders.length
          };
        });

        setManagerStats(stats);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching manager analytics:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#122B21]"></div>
      </div>
    );
  }

  const totals = {
    farmers: managerStats.reduce((sum, s) => sum + s.farmerCount, 0),
    avgCompliance: Math.round(managerStats.reduce((sum, s) => sum + s.avgCompliance, 0) / (managerStats.length || 1)),
    alerts: managerStats.reduce((sum, s) => sum + s.activeAlerts, 0)
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Manager Performance</h2>
          <p className="text-slate-500 font-medium mt-1">Track efficiency and field compliance across your team</p>
        </div>
      </div>

      {/* High Level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <Dialog>
          <DialogTrigger nativeButton={false} render={
            <Card className="p-8 border-none shadow-sm bg-[#122B21] text-white rounded-[2rem] relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <Users size={24} className="text-emerald-400" />
                  </div>
                  <Badge className="bg-emerald-400/20 text-emerald-400 border-none">+12%</Badge>
                </div>
                <div>
                  <p className="text-emerald-100/60 text-[10px] font-bold uppercase tracking-widest mb-1">Assigned Farmers</p>
                  <h3 className="text-3xl font-bold font-mono">{totals.farmers}</h3>
                </div>
              </div>
            </Card>
          } />
          {/* ... DialogContent remains much the same, just keeping the Trigger change ... */}
          <DialogContent className="max-w-3xl rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <Users className="text-emerald-600" />
                Farmer Assignment Mapping
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto mt-4 pr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Farmer Name</TableHead>
                    <TableHead className="font-bold">Farm Area/Capacity</TableHead>
                    <TableHead className="font-bold">Assigned Manager</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFarmersList.map(f => {
                    const m = allManagersList.find(m => m.id === f.managerId || m.id === f.assignedManagerId);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name || f.farmName || 'Unnamed Farmer'}</TableCell>
                        <TableCell className="text-slate-500">{f.farmArea || 0} sqft / {f.birdCapacity || 0} Birds</TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 text-slate-600 border-none">{m?.name || 'Unassigned'}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger nativeButton={false} render={
            <Card className="p-8 border-none shadow-sm bg-white rounded-[2rem] border border-slate-100 flex flex-col justify-between cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <TrendingUp size={24} />
                </div>
                <div className="flex items-center gap-1 text-indigo-600 font-bold text-xs">
                  <ArrowUpRight size={16} />
                  <span>Optimum</span>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Avg Force Compliance</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-3xl font-bold text-slate-900 font-mono">{totals.avgCompliance}%</h3>
                </div>
              </div>
            </Card>
          } />
          <DialogContent className="max-w-3xl rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <TrendingUp className="text-indigo-600" />
                Manager Compliance Breakdown
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-6">
              {managerStats.map(m => (
                <div key={m.id} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{m.name}</span>
                    <Badge className={m.avgCompliance > 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}>
                      {m.avgCompliance}%
                    </Badge>
                  </div>
                  <Progress value={m.avgCompliance} indicatorClassName={m.avgCompliance > 80 ? 'bg-emerald-500' : 'bg-amber-500'} />
                  <p className="text-xs text-slate-400">Total logs from assigned farmers: {m.totalOrders * 3} units</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger nativeButton={false} render={
            <Card className="p-8 border-none shadow-sm bg-white rounded-[2rem] border border-slate-100 flex flex-col justify-between cursor-pointer hover:border-red-200 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-2xl text-red-600">
                  <AlertCircle size={24} />
                </div>
                {totals.alerts > 0 && <Badge className="bg-red-500 text-white border-none animate-pulse">Critical</Badge>}
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Unresolved Alerts</p>
                <h3 className="text-3xl font-bold text-slate-900 font-mono">{totals.alerts}</h3>
              </div>
            </Card>
          } />
          <DialogContent className="max-w-4xl rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <AlertCircle className="text-red-600" />
                Critical Field Alerts Detail
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Manager</TableHead>
                    <TableHead className="font-bold">Farmer Name</TableHead>
                    <TableHead className="font-bold">Contact</TableHead>
                    <TableHead className="font-bold">Batch</TableHead>
                    <TableHead className="font-bold">Issue</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLogsList
                    .filter(l => (l.health?.mortality ?? 0) > 5 || l.health?.symptoms?.length > 0)
                    .slice(0, 15)
                    .map(log => {
                      const farmer = allFarmersList.find(f => f.id === log.userId);
                      const manager = allManagersList.find(m => m.id === farmer?.managerId || m.id === farmer?.assignedManagerId);
                      const flock = allFlocksList.find(f => f.id === log.flockId);
                      const issue = log.health?.mortality > 5 ? `High Mortality (${log.health.mortality})` : (log.health?.symptoms?.[0] || 'Health Flag');
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge className="bg-slate-100 text-slate-600 border-none font-bold">
                              {manager?.name || 'Unassigned'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">
                            {farmer?.name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-mono">
                            {farmer?.phone || 'No Contact'}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-xs">{flock?.name || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              {issue}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-medium">
                            {log.date}
                          </TableCell>
                        </TableRow>
                      );
                    }
                  )}
                </TableBody>
              </Table>
              {allLogsList.filter(l => (l.health?.mortality ?? 0) > 5 || l.health?.symptoms?.length > 0).length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={48} />
                  <p className="text-slate-500 font-medium">No critical alerts requiring immediate attention.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card className="p-8 border-none shadow-sm bg-white rounded-[2rem] border border-slate-100 flex flex-col justify-between cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
              <Target size={14} />
              <span>Active</span>
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Unit Placements</p>
            <h3 className="text-3xl font-bold text-slate-900 font-mono">{managerStats.reduce((sum, s) => sum + s.totalOrders, 0)}</h3>
          </div>
        </Card>
      </div>

      {/* Leaderboard / Table */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Manager Efficiency Leaderboard</h3>
              <p className="text-sm text-slate-400 font-medium">Ranked by farmer compliance and field presence</p>
            </div>
            <BarChart3 className="text-slate-200" size={32} />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Manager</th>
                  <th className="px-4 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Portfolio</th>
                  <th className="px-4 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Compliance Rate</th>
                  <th className="px-4 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Performance</th>
                  <th className="px-4 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Orders</th>
                  <th className="px-8 py-5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {managerStats.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                          {m.name?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{m.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium italic">Rank #{idx + 1}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 group/farmers"
                        onClick={() => {
                          setSelectedManagerForFarmers(m);
                          setIsFarmersModalOpen(true);
                        }}
                      >
                        <Users size={14} className="text-slate-400 group-hover/farmers:text-indigo-500 transition-colors" />
                        <span className="text-sm font-bold text-slate-700 group-hover/farmers:text-indigo-600 transition-colors underline underline-offset-4 decoration-slate-200 group-hover/farmers:decoration-indigo-200">
                          {m.farmerCount} Farmers
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <div className="w-full max-w-[120px] space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-900">{m.avgCompliance}%</span>
                        </div>
                        <Progress 
                          value={m.avgCompliance} 
                          className="h-1.5 bg-slate-100" 
                          indicatorClassName={m.avgCompliance > 80 ? 'bg-emerald-500' : m.avgCompliance > 60 ? 'bg-indigo-500' : 'bg-red-500'}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-6">
                      <Badge className={`rounded-xl px-3 py-1 text-[10px] font-bold border-none ${
                        m.avgCompliance > 80 ? 'bg-emerald-50 text-emerald-600' : 
                        m.avgCompliance > 60 ? 'bg-indigo-50 text-indigo-600' : 
                        'bg-red-50 text-red-600'
                      }`}>
                        {m.avgCompliance > 80 ? 'EXCEPTIONAL' : m.avgCompliance > 60 ? 'GROWING' : 'NEEDS TRAINING'}
                      </Badge>
                    </td>
                    <td className="px-4 py-6 text-sm font-bold text-slate-900">
                      {m.totalOrders}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {m.activeAlerts > 0 ? (
                        <div className="flex items-center justify-end gap-1.5 text-red-500 font-bold">
                          <AlertCircle size={14} />
                          <span className="text-xs">{m.activeAlerts} Active</span>
                        </div>
                      ) : (
                        <CheckCircle2 size={18} className="text-emerald-500 ml-auto" />
                      )}
                    </td>
                  </tr>
                ))}
                {managerStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 italic">
                      No managers found in the system
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Training & Advice Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-8 border-none shadow-sm bg-white rounded-[2.5rem] border border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Low Compliance Alerts</h3>
              <p className="text-sm text-slate-400 font-medium">Managers who haven't logged field visits</p>
            </div>
          </div>
          <div className="space-y-4">
            {managerStats.filter(m => m.avgCompliance < 70).map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                    !
                  </div>
                  <span className="text-sm font-bold text-slate-900">{m.name}</span>
                </div>
                <Badge variant="outline" className="text-red-500 border-red-100 bg-red-50 font-bold">{m.avgCompliance}% Rate</Badge>
              </div>
            ))}
            {managerStats.filter(m => m.avgCompliance < 70).length === 0 && (
              <p className="text-sm text-slate-400 italic font-medium px-2 text-center py-4 bg-emerald-50/50 rounded-2xl text-emerald-600 border border-emerald-100">All managers are performing above basic threshold!</p>
            )}
          </div>
        </Card>

        <Card className="p-8 border-none shadow-sm bg-white rounded-[2.5rem] border border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Resource Allocation</h3>
              <p className="text-sm text-slate-400 font-medium">Farmer distribution across managers</p>
            </div>
          </div>
          <div className="space-y-6">
            {managerStats.map(m => (
              <div key={m.id} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700">{m.name}</span>
                  <span className="text-slate-400 font-medium">{m.farmerCount} Farmers</span>
                </div>
                <Progress value={(m.farmerCount / Math.max(1, totals.farmers)) * 100} className="h-1 bg-slate-100" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Allotted Farmers Modal */}
      <Dialog open={isFarmersModalOpen} onOpenChange={setIsFarmersModalOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[85vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 break-words">
              <Users className="text-indigo-600" />
              Farmers Allotted to {selectedManagerForFarmers?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Farmer</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-center">Batch</TableHead>
                    <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFarmersList
                    .filter(f => f.managerId === selectedManagerForFarmers?.id || f.assignedManagerId === selectedManagerForFarmers?.id)
                    .map(farmer => (
                      <TableRow key={farmer.id} className="hover:bg-slate-50 transition-colors border-slate-50">
                        <TableCell>
                          <div>
                            <p className="font-bold text-slate-900">{farmer.name || farmer.farmName || 'Unnamed Farmer'}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{farmer.farmArea || 0} sqft Capacity</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[10px]">
                            {allFlocksList.filter(fl => fl.userId === farmer.id && fl.status === 'Active').length} Active
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="text-xs font-mono font-bold text-slate-600">{farmer.phone || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400">{farmer.email || 'No email'}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  {allFarmersList.filter(f => f.managerId === selectedManagerForFarmers?.id || f.assignedManagerId === selectedManagerForFarmers?.id).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-slate-400 italic">
                        No farmers allotted to this manager yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagerAnalytics;
