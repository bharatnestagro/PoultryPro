import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Package, Search, Scale, ShieldAlert, BadgeInfo, Users, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ManagerInventory: React.FC = () => {
  const { user } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [feedStocks, setFeedStocks] = useState<any[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Assigned Farmers
    const qFarmers = query(collection(db, 'users'), where('managerId', '==', user.uid));
    const unsubFarmers = onSnapshot(qFarmers, (snap) => {
      const farmersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setFarmers(farmersList);

      if (farmersList.length === 0) {
        setLoading(false);
        return;
      }

      const farmerIds = farmersList.map(f => f.id);

      // 2. Fetch all feedStock
      const unsubFeed = onSnapshot(collection(db, 'feedStock'), (feedSnap) => {
        const allFeed = feedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
        const assignedFeed = allFeed.filter(fs => farmerIds.includes(fs.userId));
        setFeedStocks(assignedFeed);
      });

      // 3. Fetch all medicineStock
      const unsubMed = onSnapshot(collection(db, 'medicineStock'), (medSnap) => {
        const allMed = medSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
        const assignedMed = allMed.filter(ms => farmerIds.includes(ms.userId));
        setMedicineStocks(assignedMed);
        setLoading(false);
      });

      return () => {
        unsubFeed();
        unsubMed();
      };
    }, () => {
      setLoading(false);
    });

    return () => unsubFarmers();
  }, [user]);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'Team Farmer';
  };

  const filteredFeed = feedStocks.filter(fs => {
    const fn = getFarmerName(fs.userId).toLowerCase();
    const type = (fs.type || '').toLowerCase();
    return fn.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());
  });

  const filteredMed = medicineStocks.filter(ms => {
    const fn = getFarmerName(ms.userId).toLowerCase();
    const name = (ms.name || '').toLowerCase();
    return fn.includes(searchTerm.toLowerCase()) || name.includes(searchTerm.toLowerCase());
  });

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
          <Package size={32} className="text-[#4E46E5]" />
          FIELD TEAMS INVENTORY TRACKS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Monitor aggregate feed bags and sanitizer assets across your assigned breeder teams
        </p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100">
              <Package size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Aggregate Feed Bags</p>
              <h3 className="text-2xl font-black text-slate-800 mt-2">
                {feedStocks.reduce((sum, curr) => sum + (Number(curr.quantity) || 0), 0)} Bags
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-605 rounded-full flex items-center justify-center border border-blue-105">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Monitored Farmers</p>
              <h3 className="text-2xl font-black text-slate-800 mt-2">
                {farmers.length} Active leads
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Security Status</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-2">Stable Stocks</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables layouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Feed stocks ledger */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-black italic text-slate-800 uppercase">FEED STOCK BALANCES</CardTitle>
            <CardDescription className="text-xs">Aggregate poultry feed stock bags available on managed farms</CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider">Farmer</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider font-mono">Feed Category</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider text-right">Remaining bags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-xs font-bold text-slate-400">
                      No feed stock entries recorded in this region
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFeed.map((f) => (
                    <TableRow key={f.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-3">
                        <p className="font-extrabold text-xs text-slate-800">{getFarmerName(f.userId)}</p>
                      </TableCell>
                      <TableCell className="text-xs font-black text-indigo-700 font-mono">
                        {f.type || 'Poultry Starter'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-black text-slate-800">
                        {f.quantity || 0} Bags
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Medicine stocks ledger */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-black italic text-slate-800 uppercase">MEDICINE & VACCINE TRACKS</CardTitle>
            <CardDescription className="text-xs">Observe critical sanitizers or vaccine units stored in breeder medicine boxes</CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider">Farmer</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider">Asset Item</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-wider text-right">Units owned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-xs font-bold text-slate-400">
                      No medicine stock entries recorded in this region
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMed.map((m) => (
                    <TableRow key={m.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-3">
                        <p className="font-extrabold text-xs text-slate-800">{getFarmerName(m.userId)}</p>
                      </TableCell>
                      <TableCell className="text-xs font-black text-slate-700">
                        {m.name || 'Gumboro Vaccine'}
                      </TableCell>
                      <TableCell className="text-right text-xs font-black text-slate-805">
                        {m.quantity || 0} Units
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

export default ManagerInventory;
