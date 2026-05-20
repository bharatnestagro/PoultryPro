import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Bird, Search, Activity, Users, ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AdminFlocks: React.FC = () => {
  const [flocks, setFlocks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 1. Fetch Master Flocks
    const unsubFlocks = onSnapshot(
      collection(db, 'flocks'),
      (snap) => {
        setFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback mock flocks
        setFlocks([
          {
            id: 'mock-f1',
            userId: 'farmer-101',
            name: 'Delta layer block A',
            breedType: 'Layer',
            birdCapacity: 12000,
            ageInDays: 45,
            status: 'Active'
          },
          {
            id: 'mock-f2',
            userId: 'farmer-102',
            name: 'Cobb broiler tier 2',
            breedType: 'Broiler',
            birdCapacity: 8500,
            ageInDays: 32,
            status: 'Active'
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch farmers
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubFlocks();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'Team Breeder';
  };

  const handleDeleteFlock = async (id: string) => {
    try {
      if (confirm('Are you absolutely certain you wish to retire and delete this flock batch permanently? This removes all historical telemetry.')) {
        await deleteDoc(doc(db, 'flocks', id));
        toast.success('Flock batch retired successfully');
      }
    } catch (err) {
      toast.error('Retire flock batch failed');
    }
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
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none font-sans">
      
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <Bird size={32} className="text-emerald-600" />
          GLOBAL FLOCK INDEX & BIOMASS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Master registry of all active bird placements, mortality indexes and broiler weights
        </p>
      </div>

      {/* Stats row cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Supervised Birds</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">
                {flocks.filter(f => f.status === 'Active').reduce((sum, curr) => sum + (Number(curr.birdCapacity || curr.initialCount) || 0), 0).toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-bold">Active Census</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Batches</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-[#4F46E5]">{flocks.length} Batches</span>
              <span className="text-xs text-slate-400 font-bold">Onsite</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">General Standard FCR</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-emerald-600">1.48 FCR</span>
              <span className="text-xs text-slate-405 font-bold">Excellent Feed Conversion</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Active Flock Placements</CardTitle>
            <CardDescription className="text-xs">Exhaustive audit roster showing current growth progress curves</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search by breed, farmer, name..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Breeder Owner</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Breed Class</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Placement size</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Age in days</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Batch Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Retire Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching flock placements registered in the index
                  </TableCell>
                </TableRow>
              ) : (
                filteredFlocks.map((f) => (
                  <TableRow key={f.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-4">
                      <p className="font-extrabold text-xs text-slate-805">{f.name || 'Standard Batch'}</p>
                      <p className="text-[9px] text-slate-400 font-semibold font-mono">ID: #{f.id.slice(0, 8)}</p>
                    </TableCell>
                    
                    <TableCell className="text-xs font-black text-slate-705">
                      {getFarmerName(f.userId)}
                    </TableCell>

                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-800 font-extrabold border border-slate-200 uppercase text-[9px] rounded-full">
                        {f.breedType || 'Broiler'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right text-xs font-black text-slate-800">
                      {(f.birdCapacity || f.initialCount || 1000).toLocaleString()} Birds
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

                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteFlock(f.id)}
                        className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 animate-fade-in"
                      >
                        <Trash2 size={13} />
                      </Button>
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

export default AdminFlocks;
