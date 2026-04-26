import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Thermometer, 
  Bird, 
  Users,
  Search,
  ChevronRight,
  MapPin,
  Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ManagerInventory: React.FC = () => {
  const { profile } = useAuth();
  const [myFarmers, setMyFarmers] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [feedStocks, setFeedStocks] = useState<any[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFarmerForDetails, setSelectedFarmerForDetails] = useState<any>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch assigned farmers
    const q = query(collection(db, 'users'), where('managerId', '==', profile.uid));
    const unsubscribeFarmers = onSnapshot(q, (snapshot) => {
      const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyFarmers(farmers);
      
      const farmerIds = farmers.map(f => f.id);
      if (farmerIds.length > 0) {
        // Fetch flocks
        const flockQ = query(collection(db, 'flocks'), where('status', '==', 'Active'));
        onSnapshot(flockQ, (flockSnap) => {
          const allFlocks = flockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFlocks(allFlocks.filter((f: any) => farmerIds.includes(f.userId)));
        });

        // Fetch Feed Stock
        const feedQ = query(collection(db, 'feedStock'));
        onSnapshot(feedQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFeedStocks(all.filter((item: any) => farmerIds.includes(item.userId)));
        });

        // Fetch Medicine Stock
        const medQ = query(collection(db, 'medicineStock'));
        onSnapshot(medQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMedicineStocks(all.filter((item: any) => farmerIds.includes(item.userId)));
        });
      }
      setLoading(false);
    });

    return () => unsubscribeFarmers();
  }, [profile?.uid]);

  const filteredFarmers = myFarmers.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.district?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Farmer Inventory</h1>
          <p className="text-slate-500 font-medium">Real-time stock monitoring across your assigned network</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search farmers or districts..." 
            className="pl-10 rounded-2xl border-slate-200 bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden relative group">
          <CardContent className="p-6">
             <div className="flex justify-between items-start">
                <div className="bg-orange-50 p-4 rounded-2xl text-orange-600 transition-transform group-hover:scale-110">
                   <Package size={24} />
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-slate-900 tracking-tighter">
                      {feedStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0).toLocaleString()} <span className="text-sm">KG</span>
                   </p>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Feed Managed</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden relative group">
          <CardContent className="p-6">
             <div className="flex justify-between items-start">
                <div className="bg-purple-50 p-4 rounded-2xl text-purple-600 transition-transform group-hover:scale-110">
                   <Thermometer size={24} />
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-slate-900 tracking-tighter">
                      {medicineStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0).toLocaleString()} <span className="text-sm">Units</span>
                   </p>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Medicine Items</p>
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden relative group">
          <CardContent className="p-6">
             <div className="flex justify-between items-start">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 transition-transform group-hover:scale-110">
                   <Bird size={24} />
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-slate-900 tracking-tighter">
                      {flocks.reduce((sum, f) => sum + (f.currentCount || 0), 0).toLocaleString()}
                   </p>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Birds Managed</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-slate-100 h-16">
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 px-8">Farmer Details</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Feed Stock</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Medicine</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Active Flocks</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-center">Ready Birds</TableHead>
                <TableHead className="font-black text-[11px] uppercase tracking-widest text-slate-400 text-right px-8">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFarmers.map(farmer => {
                const farmerFlocks = flocks.filter(f => f.userId === farmer.id);
                const farmerFeed = feedStocks.filter(s => s.userId === farmer.id);
                const farmerMed = medicineStocks.filter(s => s.userId === farmer.id);
                
                const totalFeed = farmerFeed.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                const totalMed = farmerMed.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                
                // Ready Birds Calculation (e.g., Age > 35 days)
                const readyBirds = farmerFlocks.filter(f => {
                   const age = Math.floor((new Date().getTime() - new Date(f.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                   return age >= 35;
                }).reduce((sum, f) => sum + (f.currentCount || 0), 0);

                const hasLowStock = totalFeed < 500 || farmerFlocks.length === 0;

                return (
                  <TableRow key={farmer.id} className="group border-slate-50 hover:bg-slate-50/80 transition-colors h-20">
                    <TableCell className="px-8">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-600 group-hover:scale-105 transition-all shadow-sm">
                             {farmer.name?.[0]}
                          </div>
                          <div className="cursor-pointer" onClick={() => setSelectedFarmerForDetails(farmer)}>
                             <p className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{farmer.name}</p>
                             <div className="flex items-center gap-1.5 mt-0.5">
                                <MapPin size={10} className="text-slate-300" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer.district || 'Remote'}</p>
                             </div>
                          </div>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-600">
                       <div className="inline-flex flex-col items-center">
                          <span className={`text-sm font-black ${totalFeed < 500 ? 'text-red-600' : 'text-slate-900'}`}>
                             {totalFeed.toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                          </span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-600">
                       <span className="text-sm font-black text-slate-900">
                          {totalMed.toLocaleString()} <span className="text-[10px] text-slate-400">SKUs</span>
                       </span>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="rounded-lg font-black text-[10px] border-indigo-100 bg-indigo-50 text-indigo-600">
                          {farmerFlocks.length} Active
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       {readyBirds > 0 ? (
                         <div className="inline-flex flex-col items-center">
                            <span className="text-sm font-black text-emerald-600">{readyBirds.toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Ready for Sale</span>
                         </div>
                       ) : (
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Growing...</span>
                       )}
                    </TableCell>
                    <TableCell className="text-right px-8">
                       <Badge className={`rounded-xl font-black text-[9px] uppercase tracking-widest px-3 py-1 ${
                          hasLowStock 
                             ? 'bg-amber-50 text-amber-600 border-amber-100' 
                             : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                       }`}>
                          {hasLowStock ? 'ATTENTION REQ' : 'OPERATIONAL'}
                       </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredFarmers.length === 0 && !loading && (
                 <TableRow>
                    <TableCell colSpan={6} className="h-60 text-center">
                       <div className="flex flex-col items-center justify-center opacity-30">
                          <Users size={60} className="mb-4" />
                          <p className="text-lg font-black">No Farmers Found</p>
                          <p className="text-sm font-bold">Try adjusting your search filters</p>
                       </div>
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!selectedFarmerForDetails} onOpenChange={(open) => !open && setSelectedFarmerForDetails(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl bg-white border-none shadow-2xl">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black text-slate-900">Inventory Breakdown: {selectedFarmerForDetails?.name}</DialogTitle>
           </DialogHeader>
           <div className="py-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* Feed Stocks section */}
              <section className="space-y-4">
                 <div className="flex items-center gap-2 text-orange-600">
                    <Package size={20} />
                    <h3 className="font-black text-xs uppercase tracking-widest">Feed Inventory</h3>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {(() => {
                       const farmerFeed = feedStocks.filter(s => s.userId === selectedFarmerForDetails?.id);
                       const types = ['Pre-Starter', 'Starter', 'Finisher', 'Layer', 'Other'];
                       return types.map(type => {
                          const stock = farmerFeed.find(s => s.itemType?.toLowerCase() === type.toLowerCase() || s.name?.toLowerCase().includes(type.toLowerCase()));
                          const qty = Number(stock?.quantity || 0);
                          return (
                             <div key={type} className={`p-4 rounded-2xl border ${qty > 0 ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{type}</p>
                                <p className={`text-lg font-black ${qty > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{qty.toLocaleString()} <span className="text-[10px]">KG</span></p>
                             </div>
                          );
                       });
                    })()}
                 </div>
              </section>

              {/* Medicine Stocks section */}
              <section className="space-y-4">
                 <div className="flex items-center gap-2 text-purple-600">
                    <Thermometer size={20} />
                    <h3 className="font-black text-xs uppercase tracking-widest">Medicine & Supplements</h3>
                 </div>
                 <div className="space-y-2">
                    {(() => {
                       const farmerMed = medicineStocks.filter(s => s.userId === selectedFarmerForDetails?.id);
                       if (farmerMed.length === 0) return <p className="text-center py-10 bg-slate-50 rounded-2xl italic text-slate-400 text-sm">No medicine stock found.</p>;
                       return farmerMed.map(med => (
                          <div key={med.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-purple-50 transition-all hover:border-purple-200">
                             <div>
                                <p className="font-black text-slate-900 group-hover:text-purple-600 transition-colors uppercase text-sm tracking-tight">{med.name}</p>
                                {med.expiryDate && (
                                   <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Expires: {med.expiryDate}</p>
                                )}
                             </div>
                             <div className="text-right">
                                <p className="text-lg font-black text-slate-900">{med.quantity} <span className="text-[10px] text-slate-400 uppercase">Units</span></p>
                             </div>
                          </div>
                       ));
                    })()}
                 </div>
              </section>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerInventory;
