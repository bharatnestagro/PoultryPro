import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Users, Search, Activity, ShoppingBag, ClipboardList, CheckCircle2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const AdminManagerAnalytics: React.FC = () => {
  const [managers, setManagers] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Users (both managers and farmers)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      const managerList = allUsers.filter(u => u.role === 'manager');
      const farmerList = allUsers.filter(u => u.role === 'farmer' || !u.role);
      
      setManagers(managerList);
      setFarmers(farmerList);
      setLoading(false);
    });

    // 2. Fetch Flocks
    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snap) => {
      setFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any));
    });

    return () => {
      unsubUsers();
      unsubFlocks();
    };
  }, []);

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
          <Activity size={32} className="text-[#4E46E5]" />
          REGIONAL MANAGER PERFORMANCE COMPARISONS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Measure managed team sizes, active birds census, and supply referrals metrics
        </p>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div>
          <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Manager Lead Efficiency Leaderboard</CardTitle>
          <CardDescription className="text-xs">Dynamic comparison statistics across registered field supervisors</CardDescription>
        </div>

        <div className="overflow-x-auto mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Manager Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Unique Code</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Hub Region</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Assigned Team Size</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Active Flocks supervised</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Ledger Security</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No Regional Managers currently registered inside the system
                  </TableCell>
                </TableRow>
              ) : (
                managers.map((m) => {
                  const assignedFarmers = farmers.filter(f => f.managerId === m.id);
                  const managedFlocks = flocks.filter(fl => assignedFarmers.map(fa => fa.id).includes(fl.userId));
                  return (
                    <TableRow key={m.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-4">
                        <p className="font-extrabold text-xs text-slate-800">{m.name || 'Untitled Manager'}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">{m.email}</p>
                      </TableCell>
                      <TableCell className="text-xs font-black text-slate-500 font-mono">
                        {m.managerCode || 'ST-MGR-DEFAULT'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">
                        {m.address || 'Central Hub Sector'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-indigo-55 hover:bg-slate-50 text-indigo-805 font-extrabold border border-indigo-100 text-[9px] rounded-full px-2">
                          {assignedFarmers.length} Farmers
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-slate-800 font-mono">
                        {managedFlocks.length} Active batches
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <Badge className="bg-emerald-50 text-emerald-800 font-black uppercase text-[8px] rounded-full border border-emerald-150 tracking-wider">
                          Verified Official
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AdminManagerAnalytics;
