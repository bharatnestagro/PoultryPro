import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { useAuth } from '@/src/lib/AuthContext';
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
  UserPlus, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Power,
  Trash2,
  Edit2,
  Users,
  Activity,
  Package,
  CreditCard
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminFarmers: React.FC = () => {
  const { user } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All Types');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [selectedFarmerFlocks, setSelectedFarmerFlocks] = useState<any[]>([]);
  const [selectedFarmerLogs, setSelectedFarmerLogs] = useState<any[]>([]);
  const [selectedFarmerStock, setSelectedFarmerStock] = useState<{ feed: any[], medicine: any[] }>({ feed: [], medicine: [] });
  const [selectedFarmerTransactions, setSelectedFarmerTransactions] = useState<any[]>([]);
  const [expandedFlockId, setExpandedFlockId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((u: any) => u.email !== user?.email); // Show all users except current admin
      
      // Sort manually to avoid index requirements
      const sortedList = [...list].sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      setFarmers(sortedList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedFarmerId) {
      setSelectedFarmerFlocks([]);
      setSelectedFarmerLogs([]);
      return;
    }

    // Fetch flocks for selected farmer
    const qFlocks = query(collection(db, 'flocks'));
    const unsubFlocks = onSnapshot(qFlocks, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((f: any) => f.userId === selectedFarmerId)
        .sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      setSelectedFarmerFlocks(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'flocks'));

    // Fetch logs for selected farmer
    const qLogs = query(collection(db, 'dailyLogs'));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((l: any) => l.userId === selectedFarmerId)
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setSelectedFarmerLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    // Fetch stock for selected farmer
    const unsubFeed = onSnapshot(collection(db, 'feedStock'), (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === selectedFarmerId);
      setSelectedFarmerStock(prev => ({ ...prev, feed: list }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const unsubMed = onSnapshot(collection(db, 'medicineStock'), (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === selectedFarmerId);
      setSelectedFarmerStock(prev => ({ ...prev, medicine: list }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    // Fetch transactions for selected farmer
    const qTxs = query(collection(db, 'transactions'));
    const unsubTxs = onSnapshot(qTxs, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((t: any) => t.userId === selectedFarmerId)
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setSelectedFarmerTransactions(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    return () => {
      unsubFlocks();
      unsubLogs();
      unsubFeed();
      unsubMed();
      unsubTxs();
    };
  }, [selectedFarmerId]);

  const handleToggleStatus = async (farmer: any) => {
    try {
      const newStatus = farmer.status === 'Inactive' ? 'Active' : 'Inactive';
      await updateDoc(doc(db, 'users', farmer.id), { status: newStatus });
      toast.success(`Farmer ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteFarmer = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this farmer account? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Farmer account removed');
    } catch (error) {
      toast.error('Failed to delete farmer');
    }
  };

  const filteredFarmers = farmers.filter(f => {
    const matchesSearch = (f.name?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '') || 
                         (f.farmName?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '');
    const matchesFilter = filterType === 'All Types' || f.farmType === filterType;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: farmers.length,
    totalBirds: farmers.reduce((sum, f) => sum + (Number(f.birdCapacity) || 0), 0),
    activeEngagement: Math.round((farmers.filter(f => f.status !== 'Inactive').length / (farmers.length || 1)) * 100)
  };

  const selectedFarmer = farmers.find(f => f.id === selectedFarmerId);
  const activeFlocks = selectedFarmerFlocks.filter(f => f.status === 'Active');
  const chicksPlaced = activeFlocks.reduce((sum, f) => sum + (Number(f.initialCount) || 0), 0);
  const birdsAlive = activeFlocks.reduce((sum, f) => sum + (Number(f.currentCount) || 0), 0);
  
  const getDaysCount = (flock?: any) => {
    const targetFlocks = flock ? [flock] : activeFlocks;
    if (targetFlocks.length === 0) return 0;
    const dates = targetFlocks
      .map(f => f.placementDate ? new Date(f.placementDate).getTime() : null)
      .filter((t): t is number => t !== null && !isNaN(t));
    if (dates.length === 0) return 0;
    const oldestDate = Math.min(...dates);
    const diffTime = Math.abs(new Date().getTime() - oldestDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getLogPercentage = () => {
    if (activeFlocks.length === 0) return 0;
    
    // Get the date range: last 7 days or since oldest flock placement
    const oldestPlacement = getDaysCount();
    const daysToTrack = Math.min(oldestPlacement || 1, 7);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let loggedDays = 0;
    for (let i = 0; i < daysToTrack; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasLog = selectedFarmerLogs.some(log => log.date === dateStr);
      if (hasLog) loggedDays++;
    }

    return Math.round((loggedDays / daysToTrack) * 100);
  };

  const handleDownloadLogs = () => {
    const logsToExport = filteredLogs.map(log => ({
      Date: log.date,
      Age: log.age,
      Mortality: log.health?.mortality || 0,
      Feed_Intake: log.consumption?.feedIntake || 0,
      Feed_Type: log.consumption?.feedType || 'N/A',
      Water_Intake: log.consumption?.waterIntake || 0,
      Weight: log.production?.avgWeight || 0,
      Medicines: log.health?.medicines || 'None',
      Vaccines: log.health?.vaccines || 'None',
      Notes: log.notes || ''
    }));

    const csv = [
      Object.keys(logsToExport[0] || {}).join(','),
      ...logsToExport.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmer_logs_${selectedFarmer?.name}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs exported successfully');
  };

  const filteredLogs = selectedFarmerLogs.filter(log => {
    // If a flock is expanded, prioritize showing logs for that specific flock
    if (expandedFlockId && log.flockId !== expandedFlockId) return false;

    if (!logFilter) return true;
    if (logFilter === 'feed') return !!log.consumption?.feedIntake || !!log.consumption?.waterIntake;
    if (logFilter === 'medicine') return log.health?.medicines && log.health?.medicines !== 'none';
    if (logFilter === 'vaccine') return log.health?.vaccines && log.health?.vaccines !== 'none';
    if (logFilter === 'eggs') return !!log.production?.eggsCollected;
    if (logFilter === 'transaction') return false; // Transactions are handled separately
    return true;
  });

  const displayLogs = logFilter === 'transaction' ? selectedFarmerTransactions : filteredLogs;

  const calculateFlockCost = (flock: any) => {
    const flockLogs = selectedFarmerLogs.filter(log => log.flockId === flock.id);
    
    // 1. Chicks Cost per bird
    const chicksCostPerBird = flock.initialCount > 0 ? (Number(flock.chicksCost) || 0) / flock.initialCount : 0;
    
    // 2. Feed Cost (Estimated from logs and stock prices)
    let totalFeedCost = 0;
    flockLogs.forEach(log => {
      const intake = Number(log.consumption?.feedIntake) || 0;
      const feedType = log.consumption?.feedType;
      if (intake > 0 && feedType) {
        const stockItem = selectedFarmerStock.feed.find(s => s.type === feedType);
        if (stockItem && stockItem.purchaseCost && stockItem.quantity) {
          totalFeedCost += intake * (stockItem.purchaseCost / stockItem.quantity);
        }
      }
    });
    const feedCostPerBird = flock.currentCount > 0 ? totalFeedCost / flock.currentCount : 0;
    
    // 3. Medicine Cost
    let totalMedCost = 0;
    flockLogs.forEach(log => {
      const medDoses = Number(log.health?.medicineDoses) || 0;
      const medName = log.health?.medicines;
      if (medDoses > 0 && medName && medName !== 'none') {
        const medItem = selectedFarmerStock.medicine.find(m => m.name === medName);
        if (medItem && medItem.purchaseCost && medItem.quantity) {
          totalMedCost += medDoses * (medItem.purchaseCost / medItem.quantity);
        }
      }
    });
    const medCostPerBird = flock.currentCount > 0 ? totalMedCost / flock.currentCount : 0;
    
    return chicksCostPerBird + feedCostPerBird + medCostPerBird;
  };

  const totalFeedUsed = selectedFarmerLogs.reduce((sum, log) => sum + (Number(log.consumption?.feedIntake) || 0), 0);
  const totalMedicineUsed = selectedFarmerLogs.reduce((sum, log) => sum + (Number(log.health?.medicineDoses) || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Farmer Directory</h1>
          <p className="text-slate-500 font-medium">Manage and monitor your decentralized poultry network. Direct access to registration, flock health, and operational capacity.</p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
          <Download size={18} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL FARMERS REGISTERED</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{(stats.totalBirds / 1000).toFixed(1)}k</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL BIRDS CAPACITY</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.activeEngagement}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE FARM ENGAGEMENT</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Search by Farmer Name, Phone, or Farm..." 
            className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 gap-3 border border-slate-100">
            <Filter size={18} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase">FARM TYPE</span>
            <select 
              className="bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option>All Types</option>
              <option>Gavthi</option>
              <option>Broiler</option>
              <option>Layer</option>
              <option>Sonali</option>
            </select>
          </div>
          <div className="bg-white rounded-2xl shadow-sm flex items-center px-4 gap-3 border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase">SORT BY</span>
            <select className="bg-transparent border-none text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer">
              <option>Newest</option>
              <option>Oldest</option>
              <option>Capacity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">FARMER & FARM NAME</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ADDRESS</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TYPE</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CAPACITY</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REGISTERED</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">Loading farmers...</TableCell>
              </TableRow>
            ) : filteredFarmers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">No farmers found</TableCell>
              </TableRow>
            ) : (
              filteredFarmers.map((farmer) => (
                <TableRow 
                  key={farmer.id} 
                  className={`group border-slate-50 cursor-pointer transition-colors ${selectedFarmerId === farmer.id ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}
                  onClick={() => setSelectedFarmerId(selectedFarmerId === farmer.id ? null : farmer.id)}
                >
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                        {farmer.name.split(' ').map((n: any) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{farmer.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{farmer.farmName || 'No Farm Name'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-[200px]">
                      {farmer.address || 'Not provided'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none rounded-lg text-[10px] font-bold px-2 py-1 uppercase tracking-tighter">
                      {farmer.farmType || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900">{farmer.birdCapacity?.toLocaleString() || 0} Birds</p>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-500 font-medium">
                      {farmer.createdAt ? format(new Date(farmer.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${farmer.status === 'Inactive' ? 'bg-slate-300' : 'bg-emerald-500'}`}></div>
                      <span className={`text-xs font-bold ${farmer.status === 'Inactive' ? 'text-slate-400' : 'text-emerald-600'}`}>
                        {farmer.status || 'Active'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" />}>
                        <MoreHorizontal size={18} className="text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer">
                          <Edit2 size={16} />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium cursor-pointer"
                          onClick={() => handleToggleStatus(farmer)}
                        >
                          <Power size={16} />
                          {farmer.status === 'Inactive' ? 'Activate Account' : 'Deactivate Account'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-50" />
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDeleteFarmer(farmer.id)}
                        >
                          <Trash2 size={16} />
                          Remove Farmer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        <div className="p-8 border-t border-slate-50 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400">Showing 1 to {filteredFarmers.length} of {farmers.length} Farmers</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100"><ChevronLeft size={18} /></Button>
            <Button className="bg-[#122B21] text-white rounded-xl w-10 h-10 font-bold">1</Button>
            <Button variant="ghost" className="rounded-xl w-10 h-10 font-bold text-slate-400">2</Button>
            <Button variant="ghost" className="rounded-xl w-10 h-10 font-bold text-slate-400">3</Button>
            <Button variant="ghost" size="icon" className="rounded-xl border border-slate-100"><ChevronRight size={18} /></Button>
          </div>
        </div>
      </Card>

      {/* Farmer Details Section */}
      {selectedFarmer && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Farmer Insights: {selectedFarmer.name}</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Comprehensive Performance & Inventory Analysis</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFarmerId(null)} className="text-slate-400 hover:text-slate-900 rounded-xl">
              Close Details
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar: Profile & Quick Stats */}
            <div className="lg:col-span-1 space-y-8">
              <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-3xl mb-4 border-4 border-white shadow-sm">
                    {selectedFarmer.name.split(' ').map((n: any) => n[0]).join('')}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedFarmer.name}</h3>
                  <p className="text-sm text-slate-500 font-medium">{selectedFarmer.farmName}</p>
                  <Badge className="mt-4 bg-emerald-100 text-emerald-600 border-none px-4 py-1 rounded-full text-xs font-bold">
                    {selectedFarmer.status || 'Active'}
                  </Badge>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Details</p>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Users size={16} />
                        </div>
                        <span className="font-medium">{selectedFarmer.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Activity size={16} />
                        </div>
                        <span className="truncate font-medium">{selectedFarmer.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                          <Package size={16} />
                        </div>
                        <span className="leading-relaxed font-medium">{selectedFarmer.address || 'No address provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Farm Specs</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Type</p>
                        <p className="text-sm font-bold text-slate-900">{selectedFarmer.farmType || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Capacity</p>
                        <p className="text-sm font-bold text-slate-900">{selectedFarmer.birdCapacity || 0}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Chicks Placed</p>
                        <p className="text-sm font-bold text-slate-900">{chicksPlaced.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Open Flocks</p>
                        <p className="text-sm font-bold text-slate-900">{activeFlocks.length}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl col-span-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Days Count</p>
                        <p className="text-sm font-bold text-slate-900">{getDaysCount()} Days from placement</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Inventory Summary */}
              <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Inventory Overview</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Feed Stock</p>
                      <p className="text-lg font-bold text-emerald-900">
                        {selectedFarmerStock.feed.reduce((sum, s) => sum + (s.quantity || 0), 0).toLocaleString()} <span className="text-xs">kg</span>
                      </p>
                    </div>
                    <Package className="text-emerald-500" size={20} />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase">Medicine</p>
                      <p className="text-lg font-bold text-indigo-900">
                        {selectedFarmerStock.medicine.length} <span className="text-xs">Items</span>
                      </p>
                    </div>
                    <Activity className="text-indigo-500" size={20} />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-amber-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Total Feed Used Until Now</p>
                      <p className="text-lg font-bold text-amber-900">
                        {totalFeedUsed.toLocaleString()} <span className="text-xs">kg</span>
                      </p>
                    </div>
                    <Package className="text-amber-500" size={20} />
                  </div>
                  <div className="flex justify-between items-center p-4 bg-rose-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Total Medicine Used Until Now</p>
                      <p className="text-lg font-bold text-rose-900">
                        {totalMedicineUsed.toLocaleString()} <span className="text-xs">Doses</span>
                      </p>
                    </div>
                    <Activity className="text-rose-500" size={20} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Main Content: Performance & History */}
            <div className="lg:col-span-3 space-y-8">
              {/* Performance Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Flocks</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {activeFlocks.length}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Birds Placed</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {selectedFarmerFlocks.reduce((sum, f) => sum + (Number(f.initialCount) || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">{birdsAlive.toLocaleString()} ALIVE</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Farmer Log %</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {getLogPercentage()}%
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">LAST 7 DAYS</p>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Mortality</p>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedFarmerFlocks.length > 0 
                        ? (selectedFarmerFlocks.reduce((sum, f) => sum + (Number(f.totalMortality) || 0), 0) / (selectedFarmerFlocks.reduce((sum, f) => sum + (Number(f.initialCount) || 1), 0)) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>

              {/* Flocks & Logs Tabs (Simplified) */}
              <div className="flex flex-col gap-8">
                {/* Flocks List */}
                <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <h4 className="font-bold text-slate-900">Flock History</h4>
                    <Badge className="bg-white text-slate-500 border-slate-100 shadow-sm">{selectedFarmerFlocks.length} Total</Badge>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-white sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent border-slate-50">
                          <TableHead className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flock Name</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Breed</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Count</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FCR</TableHead>
                          <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFarmerFlocks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic text-sm">No flocks recorded</TableCell>
                          </TableRow>
                        ) : (
                          selectedFarmerFlocks.map((flock) => (
                            <React.Fragment key={flock.id}>
                              <TableRow 
                                className="border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                                onClick={() => setExpandedFlockId(expandedFlockId === flock.id ? null : flock.id)}
                              >
                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-2">
                                    {expandedFlockId === flock.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    <div>
                                      <p className="font-bold text-slate-900 text-sm">{flock.name}</p>
                                      <p className="text-[10px] text-slate-400">{flock.createdAt ? format(new Date(flock.createdAt), 'MMM dd, yyyy') : 'N/A'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-xs text-slate-600 font-medium">{flock.breed}</td>
                                <td className="text-xs font-bold text-slate-900">{flock.initialCount}</td>
                                <td className="text-xs font-bold text-blue-600">{flock.currentFCR || 'N/A'}</td>
                                <td>
                                  <Badge className={flock.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-none rounded-lg text-[10px]' : 'bg-slate-50 text-slate-400 border-none rounded-lg text-[10px]'}>
                                    {flock.status}
                                  </Badge>
                                </td>
                              </TableRow>
                              {expandedFlockId === flock.id && (
                                <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-none">
                                  <TableCell colSpan={5} className="p-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-300 mb-6">
                                      {/* Row 1: Breed, Placement Date, Days Done, Bird Count */}
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Breed</p>
                                        <p className="text-sm font-bold text-slate-900">{flock.breed}</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Placement Date</p>
                                        <p className="text-sm font-bold text-slate-900">{flock.placementDate ? format(new Date(flock.placementDate), 'MMM dd, yyyy') : 'N/A'}</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Days Done</p>
                                        <p className="text-sm font-bold text-indigo-600">{getDaysCount(flock)} Days</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bird Count</p>
                                        <p className="text-sm font-bold text-slate-900">{flock.initialCount}</p>
                                      </div>

                                      {/* Row 2: Bird Alive, Per Bird Cost, FCR, avg Weight */}
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bird Alive</p>
                                        <p className="text-sm font-bold text-emerald-600">{flock.currentCount}</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Per Bird Cost</p>
                                        <p className="text-sm font-bold text-amber-600">₹{calculateFlockCost(flock).toFixed(2)}</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">FCR</p>
                                        <p className="text-sm font-bold text-blue-600">{flock.currentFCR || 'N/A'}</p>
                                      </div>
                                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Weight</p>
                                        <p className="text-sm font-bold text-emerald-600">{flock.currentWeight || flock.initialAvgWeight || 0}g</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                      <button 
                                        onClick={() => setLogFilter(logFilter === 'feed' ? null : 'feed')}
                                        className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${logFilter === 'feed' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-emerald-200'}`}
                                      >
                                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${logFilter === 'feed' ? 'text-emerald-100' : 'text-slate-400'}`}>Feed & Water Log</p>
                                        <p className="text-xs font-bold">View Details</p>
                                      </button>
                                      <button 
                                        onClick={() => setLogFilter(logFilter === 'medicine' ? null : 'medicine')}
                                        className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${logFilter === 'medicine' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-indigo-200'}`}
                                      >
                                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${logFilter === 'medicine' ? 'text-indigo-100' : 'text-slate-400'}`}>Medicine Log</p>
                                        <p className="text-xs font-bold">View Details</p>
                                      </button>
                                      <button 
                                        onClick={() => setLogFilter(logFilter === 'vaccine' ? null : 'vaccine')}
                                        className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${logFilter === 'vaccine' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-amber-200'}`}
                                      >
                                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${logFilter === 'vaccine' ? 'text-amber-100' : 'text-slate-400'}`}>Vaccination Log</p>
                                        <p className="text-xs font-bold">View Details</p>
                                      </button>
                                      <button 
                                        onClick={() => setLogFilter(logFilter === 'eggs' ? null : 'eggs')}
                                        className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${logFilter === 'eggs' ? 'bg-yellow-600 border-yellow-600 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-yellow-200'}`}
                                      >
                                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${logFilter === 'eggs' ? 'text-yellow-100' : 'text-slate-400'}`}>Eggs Log</p>
                                        <p className="text-xs font-bold">View Details</p>
                                      </button>
                                      <button 
                                        onClick={() => setLogFilter(logFilter === 'transaction' ? null : 'transaction')}
                                        className={`p-4 rounded-2xl shadow-sm border transition-all text-left ${logFilter === 'transaction' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900 hover:border-slate-300'}`}
                                      >
                                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${logFilter === 'transaction' ? 'text-slate-300' : 'text-slate-400'}`}>Transaction Log</p>
                                        <p className="text-xs font-bold">View Details</p>
                                      </button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* Activity Logs */}
                <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {logFilter === 'transaction' ? 'Transaction History' : 'Activity Logs'}
                      </h4>
                      {logFilter && (
                        <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">
                          Filtered by: {logFilter}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {logFilter && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="rounded-xl text-[10px] font-bold h-8 text-slate-400 hover:text-slate-900"
                          onClick={() => setLogFilter(null)}
                        >
                          Clear Filter
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl text-[10px] font-bold h-8"
                        onClick={handleDownloadLogs}
                      >
                        <Download size={14} className="mr-1" />
                        Excel
                      </Button>
                      <Badge variant="outline" className="text-[10px] border-slate-100">
                        {displayLogs.length} Total
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {displayLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl">
                        No logs found for this filter
                      </div>
                    ) : (
                      displayLogs.map((log) => (
                        <div key={log.id} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-colors">
                          <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${logFilter === 'transaction' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {logFilter === 'transaction' ? <CreditCard size={18} /> : <Activity size={18} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {logFilter === 'transaction' ? log.description : 'Daily Log Update'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                  {log.date ? format(new Date(log.date), 'MMM dd, yyyy') : 'N/A'}
                                </p>
                              </div>
                              {logFilter !== 'transaction' && (
                                <Badge className="bg-white text-slate-600 border-slate-100 text-[9px]">Day {log.age || '?'}</Badge>
                              )}
                              {logFilter === 'transaction' && (
                                <p className={`font-bold ${log.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {log.type === 'Income' ? '+' : '-'} ₹{log.amount?.toLocaleString()}
                                </p>
                              )}
                            </div>
                            {logFilter !== 'transaction' && (
                              <div className="mt-3 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="bg-white p-2 rounded-lg text-center border border-slate-50">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Mortality</p>
                                    <p className="text-xs font-bold text-red-600">{log.health?.mortality || 0}</p>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg text-center border border-slate-50">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Feed (kg)</p>
                                    <p className="text-xs font-bold text-emerald-600">{log.consumption?.feedIntake || 0}</p>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg text-center border border-slate-50">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Weight (g)</p>
                                    <p className="text-xs font-bold text-indigo-600">{log.production?.avgWeight || 0}</p>
                                  </div>
                                </div>

                                {/* Detailed Info based on filter */}
                                {(logFilter === 'feed' || !logFilter) && (log.consumption?.feedIntake || log.consumption?.waterIntake) && (
                                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-[11px] space-y-1">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Feed & Water Details</p>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Feed Type:</span>
                                      <span className="font-bold text-emerald-700">{log.consumption?.feedType || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Feed Quantity:</span>
                                      <span className="font-bold text-emerald-700">{log.consumption?.feedIntake || 0} kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Water Intake:</span>
                                      <span className="font-bold text-emerald-700">{log.consumption?.waterIntake || 0} Liters</span>
                                    </div>
                                  </div>
                                )}

                                {(logFilter === 'medicine' || !logFilter) && log.health?.medicines && log.health?.medicines !== 'none' && (
                                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-[11px] space-y-1">
                                    <p className="text-[9px] font-bold text-indigo-600 uppercase mb-1">Medicine Details</p>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Medicine:</span>
                                      <span className="font-bold text-indigo-700">{log.health?.medicines || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Doses:</span>
                                      <span className="font-bold text-indigo-700">{log.health?.medicineDoses || 0} units</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1">
                                      <span className="text-slate-500 font-medium">Reason/Notes:</span>
                                      <span className="text-slate-700 italic">"{log.notes || 'No notes provided'}"</span>
                                    </div>
                                  </div>
                                )}

                                {(logFilter === 'vaccine' || !logFilter) && log.health?.vaccines && log.health?.vaccines !== 'none' && (
                                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-[11px] space-y-1">
                                    <p className="text-[9px] font-bold text-amber-600 uppercase mb-1">Vaccination Details</p>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Vaccination:</span>
                                      <span className="font-bold text-amber-700">{log.health?.vaccines || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1">
                                      <span className="text-slate-500 font-medium">Notes:</span>
                                      <span className="text-slate-700 italic">"{log.notes || 'No notes provided'}"</span>
                                    </div>
                                  </div>
                                )}
                                {logFilter === 'eggs' && (
                                  <div className="bg-yellow-50/50 p-3 rounded-xl border border-yellow-100 text-[11px] space-y-1">
                                    <p className="text-[9px] font-bold text-yellow-600 uppercase mb-1">Egg Collection Details</p>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Eggs Collected:</span>
                                      <span className="font-bold text-yellow-700">{log.production?.eggsCollected || 0} Units</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Damaged Eggs:</span>
                                      <span className="font-bold text-red-700">{log.production?.damagedEggs || 0} Units</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1">
                                      <span className="text-slate-500 font-medium">Notes:</span>
                                      <span className="text-slate-700 italic">"{log.notes || 'No notes provided'}"</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <Button className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-[#122B21] hover:bg-[#1a3d2e] shadow-2xl flex items-center justify-center p-0">
        <UserPlus size={24} className="text-white" />
      </Button>
    </div>
  );
};

export default AdminFarmers;
