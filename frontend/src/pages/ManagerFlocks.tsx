import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Bird, Search, Activity, Users, ShieldAlert, BadgeInfo, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ManagerFlocks: React.FC = () => {
  const { user } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Assigned Farmers first
    const qFarmers = query(collection(db, 'users'), where('managerId', '==', user.uid));
    const unsubFarmers = onSnapshot(qFarmers, (snap) => {
      const farmersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setFarmers(farmersList);

      if (farmersList.length === 0) {
        setLoading(false);
        return;
      }

      const farmerIds = farmersList.map(f => f.id);

      // 2. Fetch all flocks and filter dynamically by assigned farmers
      const unsubFlocks = onSnapshot(collection(db, 'flocks'), (flockSnap) => {
        const allFlocks = flockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
        const assignedFlocks = allFlocks.filter(fl => farmerIds.includes(fl.userId));
        setFlocks(assignedFlocks);
        setLoading(false);
      });

      return () => unsubFlocks();
    }, () => {
      setLoading(false);
    });

    return () => unsubFarmers();
  }, [user]);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'Team Breeder';
  };

  const filteredFlocks = flocks.filter(f => {
    const fn = getFarmerName(f.userId).toLowerCase();
    const fln = (f.name || '').toLowerCase();
    const type = (f.breedType || '').toLowerCase();
    const mSearch = fn.includes(searchTerm.toLowerCase()) || fln.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());
    return mSearch;
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
          <Bird size={32} className="text-[#0B2516]" />
          SUPERVISED FLOCK BATCHES
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Monitor placement age, mortality levels, and biological growth targets inside your hub
        </p>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight font-sans">Active Batch Monitoring</CardTitle>
            <CardDescription className="text-xs">Direct field tracking list comparing flock capacities and mortality percentages</CardDescription>
          </div>
          <div className="relative w-full sm:w-64 font-sans">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search flock name, type, farmer..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Flock Identifier</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Breeder / Owner</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Breed Class</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Placement size</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Age in days</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Batch Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No active supervised flock batches located in your sector zone
                  </TableCell>
                </TableRow>
              ) : (
                filteredFlocks.map((f) => (
                  <TableRow key={f.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-4">
                      <p className="font-extrabold text-xs text-slate-800">{f.name || 'Alpha Batch'}</p>
                      <p className="text-[9px] text-slate-400 font-semibold font-mono">ID: #{f.id.slice(0, 8)}</p>
                    </TableCell>
                    
                    <TableCell className="text-xs font-black text-slate-700">
                      {getFarmerName(f.userId)}
                    </TableCell>

                    <TableCell>
                      <Badge className="bg-slate-150 text-slate-800 font-extrabold border border-slate-200 uppercase text-[9px] rounded-full">
                        {f.breedType || 'Broiler'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right text-xs font-black text-slate-800">
                      {(f.birdCapacity || f.initialCount || 1500).toLocaleString()} Chicks
                    </TableCell>

                    <TableCell className="text-right text-xs font-bold text-indigo-700 font-mono">
                      {f.ageInDays || f.age || 1} Days
                    </TableCell>

                    <TableCell className="text-center font-mono text-[9px]">
                      <Badge className={`uppercase text-[9px] font-black rounded-full px-2.5 ${
                        f.status === 'Active' 
                          ? 'bg-emerald-50 border border-emerald-250 text-emerald-800' 
                          : 'bg-slate-50 border border-slate-250 text-slate-500'
                      }`}>
                        {f.status || 'Active'}
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

export default ManagerFlocks;
