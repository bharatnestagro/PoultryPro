import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Clipboard, Search, HeartPulse, Scale, GlassWater, Eye, Ban, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 1. Fetch Master Logs
    const unsub = onSnapshot(
      query(collection(db, 'dailyLogs'), orderBy('timestamp', 'desc')),
      (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        setLogs([
          {
            id: 'mock-log-1',
            date: format(new Date(), 'yyyy-MM-dd'),
            flockId: 'flock-alpha',
            userId: 'farmer-101',
            feedConsumed: 120,
            waterConsumed: 310,
            averageWeight: 450,
            mortality: 2,
            symptoms: 'Aggregating huddling'
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch flocks to map name
    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snap) => {
      setFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch farmers
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsub();
      unsubFlocks();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'System Farm';
  };

  const getFlockName = (id: string) => {
    return flocks.find(f => f.id === id)?.name || id || 'Unmapped flock';
  };

  const filteredLogs = logs.filter(l => {
    const fn = getFarmerName(l.userId).toLowerCase();
    const fln = getFlockName(l.flockId).toLowerCase();
    const sym = (l.symptoms || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fn.includes(term) || fln.includes(term) || sym.includes(term);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Header block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Clipboard size={32} className="text-indigo-600" />
            CENTRAL REGISTRY DAILY LOGS
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Raw feed consumption, mortality tables, and weight gains analytics database
          </p>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Daily Flock Entries Feed</CardTitle>
            <CardDescription className="text-xs">Direct review of breeder submission forms to evaluate field integrity</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search by farmer, flock, sym..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Date & Entry ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider font-mono">Flock Batch</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Farmer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right font-sans">Feed Consumed</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Water Intake</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Avg Weight</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Mortality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching daily log records registered inside the dashboard
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-4 font-mono text-xs font-semibold text-slate-500">
                      <p className="text-slate-700 font-bold">{item.date || 'N/A'}</p>
                      <p className="text-[9px] text-slate-400 leading-none">#{item.id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell className="text-xs font-extrabold text-slate-800 font-mono">
                      {getFlockName(item.flockId)}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-600">
                      {getFarmerName(item.userId)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-extrabold text-slate-800">
                      <span className="flex items-center justify-end gap-1"><Scale size={11} className="text-slate-400" /> {item.feedConsumed || 0} Kg</span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-slate-650">
                      <span className="flex items-center justify-end gap-1"><GlassWater size={11} className="text-indigo-400" /> {item.waterConsumed || 0} Ltr</span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-black text-slate-850">
                      {item.averageWeight || 0} g
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.mortality > 4 ? 'destructive' : 'secondary'} className="rounded-full text-[9px] font-black">
                        {item.mortality || 0} birds
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
  );
};

export default AdminLogs;
