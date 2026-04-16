import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDocs, where, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Edit2,
  Activity,
  Package,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  User,
  Phone,
  MapPin,
  Mail,
  ExternalLink
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

const AdminFlocks: React.FC = () => {
  const [flocks, setFlocks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlock, setSelectedFlock] = useState<any>(null);
  const [latestLog, setLatestLog] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFarmerDetails, setSelectedFarmerDetails] = useState<any>(null);
  const [showFarmerProfile, setShowFarmerProfile] = useState(false);
  const [flockLogsCount, setFlockLogsCount] = useState(0);
  const [totalEggsInventory, setTotalEggsInventory] = useState(0);
  const [flockEggsInventory, setFlockEggsInventory] = useState(0);
  const [missingLogsFlocks, setMissingLogsFlocks] = useState<any[]>([]);
  const [showMissingLogsModal, setShowMissingLogsModal] = useState(false);
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [showMissingDatesModal, setShowMissingDatesModal] = useState(false);
  const [flockFeedUsage, setFlockFeedUsage] = useState<{ total: number, breakdown: Record<string, number> }>({ total: 0, breakdown: {} });
  const [flockMedicineUsage, setFlockMedicineUsage] = useState<{ total: number, breakdown: Record<string, { qty: number, unit: string }> }>({ total: 0, breakdown: {} });
  const [showFeedDetails, setShowFeedDetails] = useState(false);
  const [showMedicineDetails, setShowMedicineDetails] = useState(false);
  const [realtimeMetrics, setRealtimeMetrics] = useState({ perBirdCost: 0, fcr: 0 });

  useEffect(() => {
    // Fetch farmers for mapping
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const mapping: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        mapping[doc.id] = doc.data().name;
      });
      setFarmers(mapping);
    });

    const q = query(collection(db, 'flocks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFlocks(list);
      
      // Calculate missing logs for today
      const today = format(new Date(), 'yyyy-MM-dd');
      const activeFlocks = list.filter((f: any) => f.status === 'Active');
      
      const logsQuery = query(collection(db, 'dailyLogs'), where('date', '==', today));
      getDocs(logsQuery).then(logsSnap => {
        const loggedFlockIds = new Set(logsSnap.docs.map(d => d.data().flockId));
        const missing = activeFlocks.filter(f => !loggedFlockIds.has(f.id));
        setMissingLogsFlocks(missing);
      });

      setLoading(false);
    });

    return () => {
      unsubFarmers();
      unsubscribe();
    };
  }, []);

  const handleDeleteFlock = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this flock?')) return;
    try {
      await deleteDoc(doc(db, 'flocks', id));
      toast.success('Flock deleted');
    } catch (error) {
      toast.error('Failed to delete flock');
    }
  };

  const filteredFlocks = flocks.filter(f => 
    (f.name?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '') || 
    (farmers[f.userId]?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '') ||
    (f.breed?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '')
  );

  const handleFlockClick = async (flock: any) => {
    setSelectedFlock(flock);
    setIsModalOpen(true);
    setShowFarmerProfile(false);
    
    // Fetch farmer details
    try {
      const farmerDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', flock.userId)));
      if (!farmerDoc.empty) {
        setSelectedFarmerDetails({ id: farmerDoc.docs[0].id, ...farmerDoc.docs[0].data() });
      }
    } catch (error) {
      console.error("Error fetching farmer details:", error);
    }

    // Fetch logs count for compliance %
    try {
      const logsSnap = await getDocs(query(collection(db, 'dailyLogs'), where('flockId', '==', flock.id)));
      setFlockLogsCount(logsSnap.size);
      
      // Calculate missing dates
      if (flock.placementDate) {
        const startDate = new Date(flock.placementDate);
        const today = new Date();
        const totalDays = differenceInDays(today, startDate) + 1;
        const submittedDates = new Set(logsSnap.docs.map(d => d.data().date));
        
        const missing: string[] = [];
        for (let i = 0; i < totalDays; i++) {
          const date = format(new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          if (!submittedDates.has(date)) {
            missing.push(date);
          }
        }
        setMissingDates(missing);
      } else {
        setMissingDates([]);
      }
    } catch (error) {
      console.error("Error fetching logs count:", error);
    }

    // Fetch Egg Inventory
    try {
      // Total Eggs (all flocks)
      const allLogsSnap = await getDocs(collection(db, 'dailyLogs'));
      const total = allLogsSnap.docs.reduce((sum, doc) => sum + (doc.data().production?.eggsCollected || 0), 0);
      setTotalEggsInventory(total);

      // Flock Specific Eggs
      const flockLogsSnap = await getDocs(query(collection(db, 'dailyLogs'), where('flockId', '==', flock.id)));
      const flockTotal = flockLogsSnap.docs.reduce((sum, doc) => sum + (doc.data().production?.eggsCollected || 0), 0);
      setFlockEggsInventory(flockTotal);

      // Aggregate Feed and Medicine Usage
      const feedBreakdown: Record<string, number> = {};
      const medBreakdown: Record<string, { qty: number, unit: string }> = {};
      let totalFeed = 0;
      let totalMed = 0;

      flockLogsSnap.docs.forEach(doc => {
        const data = doc.data();
        // Feed
        const feedIntake = Number(data.consumption?.feedIntake) || 0;
        const feedType = data.consumption?.feedType || 'Unknown';
        if (feedIntake > 0) {
          totalFeed += feedIntake;
          feedBreakdown[feedType] = (feedBreakdown[feedType] || 0) + feedIntake;
        }

        // Medicine
        const medDoses = Number(data.health?.medicineDoses) || 0;
        const medName = data.health?.medicines;
        if (medDoses > 0 && medName && medName !== 'none') {
          totalMed += medDoses;
          medBreakdown[medName] = {
            qty: (medBreakdown[medName]?.qty || 0) + medDoses,
            unit: data.health?.medicineUnit || 'Doses'
          };
        }
      });

      setFlockFeedUsage({ total: totalFeed, breakdown: feedBreakdown });
      setFlockMedicineUsage({ total: totalMed, breakdown: medBreakdown });

      // Fetch farmer stock for cost calculation
      const feedStockSnap = await getDocs(query(collection(db, 'feedStock'), where('userId', '==', flock.userId)));
      const medStockSnap = await getDocs(query(collection(db, 'medicineStock'), where('userId', '==', flock.userId)));
      const farmerFeedStock = feedStockSnap.docs.map(d => d.data());
      const farmerMedStock = medStockSnap.docs.map(d => d.data());

      // Calculate Realtime Cost
      const chicksCostTotal = Number(flock.chicksCost) || 0;
      let totalFeedCost = 0;
      let totalMedCost = 0;

      flockLogsSnap.docs.forEach(doc => {
        const data = doc.data();
        // Feed Cost
        const intake = Number(data.consumption?.feedIntake) || 0;
        const feedType = data.consumption?.feedType;
        if (intake > 0 && feedType) {
          const stockItem = farmerFeedStock.find(s => s.type === feedType);
          if (stockItem && stockItem.purchaseCost && stockItem.quantity) {
            totalFeedCost += intake * (stockItem.purchaseCost / stockItem.quantity);
          }
        }
        // Med Cost
        const medDoses = Number(data.health?.medicineDoses) || 0;
        const medName = data.health?.medicines;
        if (medDoses > 0 && medName && medName !== 'none') {
          const medItem = farmerMedStock.find(m => m.name === medName);
          if (medItem && medItem.purchaseCost && medItem.quantity) {
            totalMedCost += medDoses * (medItem.purchaseCost / medItem.quantity);
          }
        }
      });

      const currentCount = flock.currentCount || flock.initialCount || 1;
      const realtimePerBirdCost = (chicksCostTotal + totalFeedCost + totalMedCost) / currentCount;

      // Calculate Realtime FCR
      // Get latest weight from logs or flock
      const sortedLogs = [...flockLogsSnap.docs].sort((a, b) => (b.data().date || '').localeCompare(a.data().date || ''));
      const latestLogData = sortedLogs[0]?.data();
      const currentWeight = latestLogData?.production?.avgWeight ?? flock.currentWeight ?? flock.initialAvgWeight ?? 0;
      const totalBiomass = (currentCount * currentWeight) / 1000; // in kg
      const realtimeFCR = totalBiomass > 0 ? totalFeed / totalBiomass : 0;

      setRealtimeMetrics({ 
        perBirdCost: Number(realtimePerBirdCost.toFixed(2)), 
        fcr: Number(realtimeFCR.toFixed(2)) 
      });
    } catch (error) {
      console.error("Error fetching egg inventory:", error);
    }
    
    // Fetch latest log for this flock
    try {
      const q = query(
        collection(db, 'dailyLogs'), 
        where('flockId', '==', flock.id),
        orderBy('date', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setLatestLog(snapshot.docs[0].data());
      } else {
        setLatestLog(null);
      }
    } catch (error) {
      console.error("Error fetching latest log:", error);
      setLatestLog(null);
    }
  };

  const stats = {
    totalBirds: flocks.reduce((sum, f) => sum + (f.currentCount || f.initialCount || 0), 0),
    activeFlocks: flocks.filter(f => f.status === 'Active').length,
    avgMortality: 0.42, // Placeholder
    avgAge: 14.2 // Placeholder
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Flock Management</h1>
          <p className="text-slate-500 font-medium">Oversee system-wide poultry populations and breed records across all farms.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
            <Filter size={18} />
            <span>Filter</span>
          </Button>
          <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
            <Download size={18} />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Birds</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBirds.toLocaleString()}</h3>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center">
              <TrendingUp size={10} className="mr-1" />
              12% increase
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Flocks</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.activeFlocks}</h3>
            <span className="text-[10px] font-bold text-slate-400">Steady since June</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Mortality</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.avgMortality}%</h3>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center">
              <TrendingDown size={10} className="mr-1" />
              0.05% improvement
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Logs Compliance</p>
          <div className="flex items-baseline justify-between w-full">
            <div>
              <h3 className="text-3xl font-bold text-slate-900">{missingLogsFlocks.length}</h3>
              <p className="text-[10px] font-bold text-red-500 uppercase">Missing Today</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 h-7 px-2 rounded-lg"
              onClick={() => setShowMissingLogsModal(true)}
            >
              View Details
            </Button>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Bird Age</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-slate-900">{stats.avgAge} wks</h3>
            <span className="text-[10px] font-bold text-slate-400">Standard cycle</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <Input 
          placeholder="Search flocks, breeds, or farmers..." 
          className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-xl font-bold text-slate-900">Active Flock Inventory</h3>
            <p className="text-xs text-slate-400 font-medium">Manage bird populations and breed records across all farms.</p>
          </div>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">FLOCK NAME</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OWNER / FARMER</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BREED</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BIRD COUNT</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AGE</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MORTALITY</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</TableHead>
                <TableHead className="text-right px-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center text-slate-400">Loading flocks...</TableCell>
                </TableRow>
              ) : filteredFlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center text-slate-400">No flocks found</TableCell>
                </TableRow>
              ) : (
                filteredFlocks.map((flock) => (
                  <TableRow 
                    key={flock.id} 
                    className={`group border-slate-50 cursor-pointer hover:bg-slate-50/80 transition-colors ${flock.status === 'Duplicate' ? 'bg-red-50/30' : ''}`}
                    onClick={() => handleFlockClick(flock)}
                  >
                    <TableCell className="px-8 py-6">
                      <div>
                        <p className="font-bold text-slate-900">{flock.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {flock.id.substring(0, 8)}</p>
                        {flock.status === 'Duplicate' && <p className="text-[8px] font-bold text-red-500 uppercase mt-1">DUPLICATE ENTRY</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                          {farmers[flock.userId]?.split(' ').map((n: any) => n[0]).join('') || '??'}
                        </div>
                        <p className="text-xs font-bold text-slate-700">{farmers[flock.userId] || 'Unknown'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none rounded-lg text-[10px] font-bold px-2 py-1">
                        {flock.breed}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-900">{(flock.currentCount || flock.initialCount || 0).toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-600">
                        {flock.placementDate ? `${differenceInDays(new Date(), new Date(flock.placementDate))} Days` : 'N/A'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-emerald-600">0.12%</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-none rounded-lg text-[10px] font-bold px-2 py-1 ${
                        flock.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 
                        flock.status === 'Closed' ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-600'
                      }`}>
                        {flock.status}
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
                            Edit Flock
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            onClick={() => handleDeleteFlock(flock.id)}
                          >
                            <Trash2 size={16} />
                            Delete Entry
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          <div className="p-8 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400">Showing 1-5 of {flocks.length} flocks</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100"><ChevronLeft size={18} /></Button>
              <Button className="bg-[#122B21] text-white rounded-xl w-10 h-10 font-bold">1</Button>
              <Button variant="ghost" className="rounded-xl w-10 h-10 font-bold text-slate-400">2</Button>
              <Button variant="ghost" className="rounded-xl w-10 h-10 font-bold text-slate-400">3</Button>
              <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100"><ChevronRight size={18} /></Button>
            </div>
          </div>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-8">
          {/* Climate Alert */}
          <div className="bg-[#F9F4F4] p-8 rounded-[2rem] border-l-8 border-red-500 shadow-sm">
            <div className="flex gap-4">
              <div className="bg-red-100 p-3 rounded-2xl text-red-600 h-fit">
                <AlertCircle size={24} />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-900">Climate Alert: Elevated Humidity</h4>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  High humidity levels detected in Highland-Broilers (Barn 2). Ventilation override recommended to maintain low mortality rates.
                </p>
                <button className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mt-4 flex items-center gap-2 hover:underline">
                  Adjust System Settings <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Inventory Summary */}
          <Card className="border-none shadow-sm bg-[#122B21] rounded-[2rem] p-8 text-white">
            <h3 className="text-xl font-bold mb-8">Inventory Summary</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-400">Layers</span>
                  <span className="font-bold">12,400</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-400">Broilers</span>
                  <span className="font-bold">11,000</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '55%' }}></div>
                </div>
              </div>
              <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEED CAPACITY</p>
                <p className="text-2xl font-bold">88%</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Button className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-[#122B21] hover:bg-[#1a3d2e] shadow-2xl flex items-center justify-center p-0">
        <Plus size={24} className="text-white" />
      </Button>

      {/* Flock Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
          {selectedFlock && (
            <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="bg-[#122B21] p-8 text-white shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none mb-2 rounded-lg px-3 py-1 font-bold text-[10px] uppercase tracking-widest">
                      {selectedFlock.status} Flock
                    </Badge>
                    <h2 className="text-3xl font-bold tracking-tight">{selectedFlock.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-slate-400 font-medium">Managed by {farmers[selectedFlock.userId] || 'Unknown Farmer'}</p>
                      <button 
                        onClick={() => setShowFarmerProfile(!showFarmerProfile)}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded"
                      >
                        {showFarmerProfile ? 'Hide Profile' : 'View Farmer Details'}
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Age</p>
                    <div className="flex flex-col items-end">
                      <p className="text-2xl font-bold">
                        {selectedFlock.placementDate ? differenceInDays(new Date(), new Date(selectedFlock.placementDate)) : '0'} Days
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-400" 
                            style={{ width: `${Math.min(100, (flockLogsCount / Math.max(1, differenceInDays(new Date(), new Date(selectedFlock.placementDate)) + 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                          {((flockLogsCount / Math.max(1, differenceInDays(new Date(), new Date(selectedFlock.placementDate)) + 1)) * 100).toFixed(0)}% Log Rate
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {showFarmerProfile && selectedFarmerDetails && (
                  <div className="mt-6 p-6 bg-white/5 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farmer Name</p>
                          <p className="text-sm font-bold">{selectedFarmerDetails.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Phone size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</p>
                          <p className="text-sm font-bold">{selectedFarmerDetails.phone || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Mail size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                          <p className="text-sm font-bold truncate max-w-[150px]">{selectedFarmerDetails.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 md:col-span-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farm Address</p>
                          <p className="text-sm font-bold">{selectedFarmerDetails.address || 'No address provided'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Small Card Format Metrics */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Breed</p>
                    <p className="text-sm font-bold text-slate-900">{selectedFlock.breed || 'N/A'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Placement Date</p>
                    <p className="text-sm font-bold text-slate-900">
                      {selectedFlock.placementDate ? format(new Date(selectedFlock.placementDate), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Days Done</p>
                    <p className="text-sm font-bold text-slate-900">
                      {selectedFlock.placementDate ? differenceInDays(new Date(), new Date(selectedFlock.placementDate)) : '0'} Days
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bird Count</p>
                    <p className="text-sm font-bold text-slate-900">{(selectedFlock.initialCount || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bird Alive</p>
                    <p className="text-sm font-bold text-emerald-600">{(selectedFlock.currentCount || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Per Bird Cost</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-slate-900">₹{realtimeMetrics.perBirdCost.toLocaleString()}</p>
                      <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] px-1 py-0">LIVE</Badge>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">FCR</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-indigo-600">{realtimeMetrics.fcr.toFixed(2)}</p>
                      <Badge className="bg-indigo-50 text-indigo-600 border-none text-[8px] px-1 py-0">LIVE</Badge>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Weight</p>
                    <p className="text-sm font-bold text-slate-900">
                      {latestLog?.production?.avgWeight ?? latestLog?.avgWeight ?? selectedFlock.avgWeight ?? 0}g
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Egg Collected Today</p>
                    <p className="text-sm font-bold text-amber-600">
                      {latestLog?.production?.eggsCollected ?? latestLog?.eggsCollected ?? 0} Units
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Eggs % (Alive)</p>
                    <p className="text-sm font-bold text-emerald-600">
                      {selectedFlock.currentCount > 0 
                        ? (((latestLog?.production?.eggsCollected ?? latestLog?.eggsCollected ?? 0) / selectedFlock.currentCount) * 100).toFixed(1)
                        : '0.0'}%
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Eggs Inventory</p>
                    <p className="text-sm font-bold text-slate-900">{totalEggsInventory.toLocaleString()} Units</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Flock Eggs Inventory</p>
                    <p className="text-sm font-bold text-amber-600">{flockEggsInventory.toLocaleString()} Units</p>
                  </div>
                  <div 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => setShowFeedDetails(true)}
                  >
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Feed Used</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-amber-600">{flockFeedUsage.total.toLocaleString()} kg</p>
                      <ExternalLink size={12} className="text-amber-400" />
                    </div>
                  </div>
                  <div 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors"
                    onClick={() => setShowMedicineDetails(true)}
                  >
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Medicine Used</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-rose-600">{flockMedicineUsage.total.toLocaleString()} Doses</p>
                      <ExternalLink size={12} className="text-rose-400" />
                    </div>
                  </div>
                  <div 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-red-100 cursor-pointer hover:bg-red-50 transition-colors"
                    onClick={() => setShowMissingDatesModal(true)}
                  >
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Missing Logs</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-red-600">{missingDates.length} Days</p>
                      <ExternalLink size={12} className="text-red-400" />
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 col-span-1 md:col-span-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Daily Eggs Collection</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400" 
                          style={{ width: `${Math.min(100, (latestLog?.production?.eggsCollected || 0) / 10)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{latestLog?.production?.eggsCollected || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <Button variant="outline" className="rounded-xl px-6" onClick={() => setIsModalOpen(false)}>
                    Close
                  </Button>
                  <Button className="bg-[#122B21] text-white rounded-xl px-6">
                    View Full History
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Missing Dates Modal */}
      <Dialog open={showMissingDatesModal} onOpenChange={setShowMissingDatesModal}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">Missing Log Dates</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Daily entries missed for {selectedFlock?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {missingDates.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-emerald-50 rounded-2xl text-emerald-600 font-bold">
                No logs missed! Perfect compliance.
              </div>
            ) : (
              missingDates.map(date => (
                <div key={date} className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                  <p className="text-xs font-bold text-red-600">{format(new Date(date), 'MMM dd, yyyy')}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-8">
            <Button className="w-full bg-[#122B21] text-white rounded-xl h-12 font-bold" onClick={() => setShowMissingDatesModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Logs Modal */}
      <Dialog open={showMissingLogsModal} onOpenChange={setShowMissingLogsModal}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">Missing Logs Today</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              The following batches have not submitted their daily data for {format(new Date(), 'MMMM dd, yyyy')}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {missingLogsFlocks.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 rounded-2xl text-emerald-600 font-bold">
                All batches have submitted logs today! 🎉
              </div>
            ) : (
              missingLogsFlocks.map(flock => (
                <div key={flock.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{flock.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Farmer: {farmers[flock.userId] || 'Unknown'}
                    </p>
                  </div>
                  <Badge className="bg-red-100 text-red-600 border-none text-[10px] font-bold">PENDING</Badge>
                </div>
              ))
            )}
          </div>
          <div className="mt-8">
            <Button className="w-full bg-[#122B21] text-white rounded-xl h-12 font-bold" onClick={() => setShowMissingLogsModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feed Usage Details Modal */}
      <Dialog open={showFeedDetails} onOpenChange={setShowFeedDetails}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">Feed Usage Breakdown</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Detailed feed consumption for {selectedFlock?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.keys(flockFeedUsage.breakdown).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-medium">
                No feed usage recorded yet.
              </div>
            ) : (
              Object.entries(flockFeedUsage.breakdown).map(([type, qty]: [string, number]) => (
                <div key={type} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div>
                    <p className="text-sm font-bold text-amber-900">{type}</p>
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Feed Type</p>
                  </div>
                  <p className="text-lg font-bold text-amber-900">{qty.toLocaleString()} <span className="text-xs">kg</span></p>
                </div>
              ))
            )}
          </div>
          <div className="mt-8">
            <Button className="w-full bg-[#122B21] text-white rounded-xl h-12 font-bold" onClick={() => setShowFeedDetails(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medicine Usage Details Modal */}
      <Dialog open={showMedicineDetails} onOpenChange={setShowMedicineDetails}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900">Medicine Usage Breakdown</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Detailed medicinal support for {selectedFlock?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.keys(flockMedicineUsage.breakdown).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-medium">
                No medicine usage recorded yet.
              </div>
            ) : (
              Object.entries(flockMedicineUsage.breakdown).map(([name, data]: [string, any]) => (
                <div key={name} className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <div>
                    <p className="text-sm font-bold text-rose-900">{name}</p>
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">Medicine Name</p>
                  </div>
                  <p className="text-lg font-bold text-rose-900">{data.qty.toLocaleString()} <span className="text-xs">{data.unit}</span></p>
                </div>
              ))
            )}
          </div>
          <div className="mt-8">
            <Button className="w-full bg-[#122B21] text-white rounded-xl h-12 font-bold" onClick={() => setShowMedicineDetails(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFlocks;
