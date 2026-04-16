import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  Calendar,
  Droplets,
  Scale,
  Zap,
  Users,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format, subDays, isSameDay, parseISO } from 'date-fns';

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'dailyLogs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(list);
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list.filter((u: any) => u.role !== 'admin'));
    });

    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlocks(list);
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubFlocks();
    };
  }, []);

  const getStats = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    const totalFarmers = users.length;
    
    // Today's logs
    const logsToday = logs.filter(l => l.date === today);
    const farmersWithLogsToday = new Set(logsToday.map(l => l.userId)).size;
    const farmersNoLogsToday = Math.max(0, totalFarmers - farmersWithLogsToday);
    const percentNoLogsToday = totalFarmers > 0 ? (farmersNoLogsToday / totalFarmers) * 100 : 0;
    const percentLogsToday = totalFarmers > 0 ? (farmersWithLogsToday / totalFarmers) * 100 : 0;

    // Yesterday's logs
    const logsYesterday = logs.filter(l => l.date === yesterday);
    const farmersWithLogsYesterday = new Set(logsYesterday.map(l => l.userId)).size;
    const farmersNoLogsYesterday = Math.max(0, totalFarmers - farmersWithLogsYesterday);
    const percentNoLogsYesterday = totalFarmers > 0 ? (farmersNoLogsYesterday / totalFarmers) * 100 : 0;

    // Mortality %
    const totalBirds = flocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
    const totalMortality = logs.reduce((sum, l) => {
      const m = l.health?.mortality ?? l.mortality ?? 0;
      return sum + Number(m);
    }, 0);
    const mortalityPercent = totalBirds > 0 ? (totalMortality / totalBirds) * 100 : 0;

    return {
      farmersNoLogsToday,
      percentNoLogsToday,
      farmersNoLogsYesterday,
      percentNoLogsYesterday,
      percentLogsToday,
      mortalityPercent
    };
  };

  const stats = getStats();

  const usersMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {} as any);
  const flocksMap = flocks.reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as any);

  const getFarmerCompliance = () => {
    return users.map(user => {
      const userLogs = logs.filter(l => l.userId === user.id);
      
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
      const uniqueDaysLast7 = new Set(
        userLogs
          .filter(l => last7Days.includes(l.date))
          .map(l => l.date)
      ).size;
      
      const compliance7Days = (uniqueDaysLast7 / 7) * 100;
      const lastLog = userLogs.length > 0 ? userLogs[0] : null;

      return {
        id: user.id,
        name: user.name || user.farmName || user.email,
        compliance7Days,
        lastLogDate: lastLog ? format(new Date(lastLog.date), 'MMM dd') : 'Never'
      };
    }).sort((a, b) => a.compliance7Days - b.compliance7Days);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;
    try {
      await deleteDoc(doc(db, 'dailyLogs', id));
      toast.success('Log deleted');
    } catch (error) {
      toast.error('Failed to delete log');
    }
  };

  const filteredLogs = logs.filter(l => {
    const user = usersMap[l.userId];
    const flock = flocksMap[l.flockId];
    const farmName = user?.farmName || user?.name || l.farmName || '';
    const flockName = flock?.name || l.flockName || '';
    
    return farmName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           flockName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Daily Farm Data</h1>
          <p className="text-slate-500 font-medium">Monitor daily operational logs, resource consumption, and bird performance metrics.</p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
          <Download size={18} />
          <span>Export Logs</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-red-50 p-3 rounded-2xl text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.farmersNoLogsToday}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NO LOG TODAY ({stats.percentNoLogsToday.toFixed(1)}%)</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.farmersNoLogsYesterday}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NO LOG YESTERDAY ({stats.percentNoLogsYesterday.toFixed(1)}%)</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.percentLogsToday.toFixed(1)}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DAILY LOG COMPLIANCE</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stats.mortalityPercent.toFixed(2)}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MORTALITY RATE</p>
          </div>
        </div>
      </div>
      
      {/* Farmer Compliance Overview */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Farmer Compliance</h3>
            <p className="text-sm text-slate-400 font-medium">Log submission rate over the last 7 days</p>
          </div>
          <Badge className="bg-slate-100 text-slate-600 border-none rounded-lg font-bold">LIVE DATA</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getFarmerCompliance().map(farmer => (
            <div key={farmer.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors cursor-default">
              <div>
                <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{farmer.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">Last: {farmer.lastLogDate}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${farmer.compliance7Days > 80 ? 'text-emerald-600' : farmer.compliance7Days > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {farmer.compliance7Days.toFixed(0)}%
                </p>
                <div className="w-12 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full ${farmer.compliance7Days > 80 ? 'bg-emerald-500' : farmer.compliance7Days > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${farmer.compliance7Days}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Search by farm or flock name..." 
            className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="rounded-2xl h-14 px-6 border-slate-200 bg-white flex items-center gap-2">
          <Filter size={18} />
          <span>Filters</span>
        </Button>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">DATE</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FARM & FLOCK</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MORTALITY</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEED (KG)</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WATER (L)</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AVG WEIGHT</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-slate-400">Loading logs...</TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-slate-400">No logs found</TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => {
                const user = usersMap[log.userId];
                const flock = flocksMap[log.flockId];
                const farmName = user?.farmName || user?.name || log.farmName || 'Unknown Farm';
                const flockName = flock?.name || log.flockName || 'Unknown Flock';
                
                const mortality = log.health?.mortality ?? log.mortality ?? 0;
                const feed = log.consumption?.feedIntake ?? log.feedConsumed ?? 0;
                const water = log.consumption?.waterIntake ?? log.waterConsumed ?? 0;
                const weight = log.production?.avgWeight ?? log.avgWeight ?? 0;

                return (
                  <TableRow key={log.id} className="group border-slate-50">
                    <TableCell className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-900">{format(new Date(log.date), 'MMM dd, yyyy')}</p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{farmName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{flockName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className={`text-xs font-bold ${mortality > 5 ? 'text-red-600' : 'text-slate-900'}`}>
                        {mortality}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-900">{feed}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-900">{water}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-900">{weight}g</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-none rounded-lg text-[10px] font-bold px-2 py-1 ${
                        mortality > 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {mortality > 5 ? 'CRITICAL' : 'NORMAL'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" />}>
                        <MoreHorizontal size={18} className="text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer">
                          <Edit2 size={16} />
                          Edit Log
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDelete(log.id)}
                        >
                          <Trash2 size={16} />
                          Delete Log
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminLogs;
