import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Activity, 
  ClipboardList, 
  MapPin, 
  Phone, 
  ArrowUpRight, 
  ShoppingCart, 
  ShoppingBag,
  Eye, 
  Package, 
  Calendar,
  Bird,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  IndianRupee,
  Thermometer,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { updateDoc, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

const ManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [myFarmers, setMyFarmers] = useState<any[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [feedStocks, setFeedStocks] = useState<any[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<any[]>([]);
  const [commissionConfig, setCommissionConfig] = useState<any>({});
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [selectedCart, setSelectedCart] = useState<any>(null);
  const [isAbandonedCartModalOpen, setIsAbandonedCartModalOpen] = useState(false);
  const [selectedFarmerForBatches, setSelectedFarmerForBatches] = useState<any>(null);
  const [selectedFarmerForStock, setSelectedFarmerForStock] = useState<any>(null);
  const [selectedFarmerForMortality, setSelectedFarmerForMortality] = useState<any>(null);
  const [stockType, setStockType] = useState<'feed' | 'medicine' | null>(null);
  const [farmerBatches, setFarmerBatches] = useState<any[]>([]);
  const [isFlockModalOpen, setIsFlockModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isBirdsModalOpen, setIsBirdsModalOpen] = useState(false);
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState(false);
  const [isFeedStockModalOpen, setIsFeedStockModalOpen] = useState(false);
  const [isMedicineStockModalOpen, setIsMedicineStockModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isMortalityApprovalOpen, setIsMortalityApprovalOpen] = useState(false);
  const [isAssignedFarmersModalOpen, setIsAssignedFarmersModalOpen] = useState(false);
  const [isEggCollectionModalOpen, setIsEggCollectionModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  const [mortalityTimeRange, setMortalityTimeRange] = useState<'1d' | '7d' | '30d'>('1d');
  const [logsTimeRange, setLogsTimeRange] = useState<'1d' | '7d' | '30d'>('1d');
  const [eggTimeRange, setEggTimeRange] = useState<'Today' | 'Yesterday' | '7d' | '30d'>('Today');

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch assigned farmers
    const q = query(collection(db, 'users'), where('managerId', '==', profile.uid));
    const unsubscribeFarmers = onSnapshot(q, (snapshot) => {
      const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyFarmers(farmers);
      
      const farmerIds = farmers.map(f => f.id);
      if (farmerIds.length > 0) {
        // Fetch carts
        const cartQ = query(collection(db, 'carts'));
        onSnapshot(cartQ, (cartSnap) => {
          const allCarts = cartSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAbandonedCarts(allCarts.filter((c: any) => farmerIds.includes(c.userId)));
        });

        // Fetch flocks
        const flockQ = query(collection(db, 'flocks'), where('status', '==', 'Active'));
        onSnapshot(flockQ, (flockSnap) => {
          const allFlocks = flockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFlocks(allFlocks.filter((f: any) => farmerIds.includes(f.userId)));
        });

        // Fetch logs
        const logQ = query(collection(db, 'dailyLogs'), orderBy('timestamp', 'desc'), limit(500));
        onSnapshot(logQ, (logSnap) => {
          const allLogs = logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setLogs(allLogs.filter((l: any) => farmerIds.includes(l.userId)));
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

        // Fetch Egg Logs
        const eggLogQ = query(collection(db, 'eggLogs'), orderBy('date', 'desc'), limit(500));
        onSnapshot(eggLogQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEggLogs(all.filter((item: any) => farmerIds.includes(item.userId)));
        });

        // Fetch Egg Sales
        const eggSaleQ = query(collection(db, 'eggSales'), orderBy('createdAt', 'desc'), limit(500));
        onSnapshot(eggSaleQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEggSales(all.filter((item: any) => farmerIds.includes(item.userId)));
        });

        // Fetch License Keys
        const licenseQ = query(collection(db, 'licenseKeys'));
        onSnapshot(licenseQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setLicenseKeys(all.filter((item: any) => farmerIds.includes(item.userId)));
        });
      }
    });

    // Fetch all users for license reporting
    getDocs(collection(db, 'users')).then(snap => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch products
    getDocs(collection(db, 'shopItems')).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Commission Config
    getDoc(doc(db, 'managerCommissions', profile.uid)).then(snap => {
      if (snap.exists()) setCommissionConfig(snap.data().productCommissions || {});
    });

    return () => unsubscribeFarmers();
  }, [profile?.uid]);

  const stats = {
    totalFarmers: myFarmers.length,
    activeFlocks: flocks.length,
    totalBirds: flocks.reduce((sum, f) => sum + (f.currentCount || 0), 0),
    avgMortality: flocks.length > 0 ? (flocks.reduce((sum, f) => sum + ((Number(f.initialCount) || 0) - (Number(f.currentCount) || 0)), 0) / (flocks.reduce((sum, f) => sum + (Number(f.initialCount) || 0), 0) || 1) * 100) : 0,
    missingLogs: myFarmers.filter(f => {
      const todayFlocks = flocks.filter(fl => fl.userId === f.id);
      if (todayFlocks.length === 0) return false;
      const today = format(new Date(), 'yyyy-MM-dd');
      return todayFlocks.some(fl => !logs.some(l => l.flockId === fl.id && l.date === today));
    }).length,
    criticalAlerts: logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).length,
    pendingMortalityApproval: logs.filter(l => l.health?.mortality > 0 && l.approved === false).length,
    abandonedCarts: abandonedCarts.length,
    abandonedCartFarmers: new Set(abandonedCarts.map(c => c.userId)).size,
    totalFeedStock: feedStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
    totalMedicineStock: medicineStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
    expiringLicensesCount: licenseKeys.filter(lk => {
      if (!lk.expiryDate || lk.status !== 'Used') return false;
      const expiry = new Date(lk.expiryDate);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      return diff > 0 && diff <= 5 * 24 * 60 * 60 * 1000;
    }).length,
    todayEggCollection: eggLogs.filter(l => l.date === format(new Date(), 'yyyy-MM-dd')).reduce((sum, l) => sum + (Number(l.totalEggs) || 0), 0),
    todayEggSales: eggSales.filter(s => s.saleDate === format(new Date(), 'yyyy-MM-dd')).reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0)
  };

  const calculateCartCommission = (items: any[]) => {
    return items.reduce((sum, item) => {
      const comm = commissionConfig[item.id];
      const product = products.find(p => p.id === item.id);
      if (!comm || !product) return sum;
      
      const qty = Number(item.quantity) || 0;
      const price = Number(product.price) || 0;
      
      if (typeof comm === 'number') return sum + (comm * qty);
      if (comm.type === 'percentage') return sum + (price * qty * comm.value / 100);
      return sum + (comm.value * qty);
    }, 0);
  };

  const calculateCartTotal = (items: any[]) => {
    return items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.id);
      return sum + (Number(product?.price || 0) * (Number(item.quantity) || 0));
    }, 0);
  };

  const viewFarmerBatches = async (farmer: any) => {
    setSelectedFarmerForBatches(farmer);
    const q = query(collection(db, 'flocks'), where('userId', '==', farmer.id), where('status', '==', 'Active'));
    const snap = await getDocs(q);
    setFarmerBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleApproveMortality = async (logId: string) => {
    try {
      await updateDoc(doc(db, 'dailyLogs', logId), { approved: true });
      toast.success('Mortality entry approved');
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleSendResetLink = async (farmer: any) => {
    if (!farmer.email) {
      toast.error('Email not found for this farmer');
      return;
    }
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, farmer.email);
      toast.success(`Reset link sent to ${farmer.name}'s email`);
    } catch (error: any) {
      toast.error('Failed to send reset link: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manager Dashboard</h1>
          <p className="text-slate-500 font-medium">Field operations and team performance overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* My Assigned Farmers Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between group hover:border-indigo-200 transition-all hover:bg-indigo-50/10 cursor-pointer"
          onClick={() => setIsAssignedFarmersModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
              <Users size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalFarmers}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Farmers</p>
          </div>
        </div>

        {/* Mortality Trends Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-emerald-200 transition-all hover:bg-emerald-50/10 group"
          onClick={() => setIsMortalityModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Activity size={22} />
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {(['1d', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setMortalityTimeRange(range)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded-lg transition-all ${mortalityTimeRange === range ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900 text-emerald-600">
              {(() => {
                const now = new Date();
                let filteredLogs = logs;
                if (mortalityTimeRange === '1d') {
                  const today = format(now, 'yyyy-MM-dd');
                  filteredLogs = logs.filter(l => l.date === today);
                } else if (mortalityTimeRange === '7d') {
                  const lastWeekly = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  filteredLogs = logs.filter(l => new Date(l.date) >= lastWeekly);
                } else {
                  const lastMonthly = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  filteredLogs = logs.filter(l => new Date(l.date) >= lastMonthly);
                }
                
                const mortCount = filteredLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
                // For period mortality, we compare to current active bird count
                const totalActiveBirds = flocks.reduce((sum, f) => sum + (Number(f.currentCount) || 0), 0) || 1;
                return ((mortCount / totalActiveBirds) * 100).toFixed(2);
              })()}%
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality Rate ({mortalityTimeRange})</p>
          </div>
        </div>

        {/* Egg Collection Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-amber-200 transition-all hover:bg-amber-50/10 group"
          onClick={() => setIsEggCollectionModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
              <ShoppingBag size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <h4 className="text-2xl font-bold text-slate-900">{stats.todayEggCollection.toLocaleString()}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's Eggs</p>
            </div>
            {stats.todayEggSales > 0 && (
              <div className="text-right">
                <p className="text-[14px] font-black text-emerald-600">₹{stats.todayEggSales.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Sales</p>
              </div>
            )}
          </div>
        </div>

        {/* License Key Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-red-200 transition-all hover:bg-red-50/10 group"
          onClick={() => setIsLicenseModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-red-50 p-3 rounded-2xl text-red-600 group-hover:scale-110 transition-transform">
              <ShieldCheck size={22} />
            </div>
            {stats.expiringLicensesCount > 0 && (
              <Badge className="bg-red-500 text-white text-[8px] animate-pulse">EXPIRING SOON</Badge>
            )}
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.expiringLicensesCount}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiring Licenses</p>
          </div>
        </div>

        {/* Active Flock Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all hover:bg-indigo-50/10 group"
          onClick={() => setIsFlockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
              <Package size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.activeFlocks}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Flocks</p>
          </div>
        </div>

        {/* Total Birds Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-emerald-200 transition-all hover:bg-emerald-50/10 group"
          onClick={() => setIsBirdsModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Bird size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalBirds.toLocaleString()}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Birds</p>
          </div>
        </div>

        {/* Accountability / Logs Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-amber-200 transition-all hover:bg-amber-50/10 group"
          onClick={() => setIsLogsModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
              <ClipboardList size={22} />
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {(['1d', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setLogsTimeRange(range)}
                  className={`text-[9px] font-black px-2 py-0.5 rounded-lg transition-all ${logsTimeRange === range ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">
              {(() => {
                if (logsTimeRange === '1d') return stats.missingLogs;
                
                const now = new Date();
                const days = logsTimeRange === '7d' ? 7 : 30;
                let missingCount = 0;
                
                for (let i = 0; i < days; i++) {
                  const checkDate = format(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                  missingCount += myFarmers.filter(f => !logs.some(l => l.userId === f.id && l.date === checkDate)).length;
                }
                return missingCount;
              })()}
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Missing Logs ({logsTimeRange})</p>
          </div>
        </div>

        {/* Critical Alerts Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-red-200 transition-all hover:bg-red-50/10 group"
          onClick={() => setIsAlertModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-red-50 p-3 rounded-2xl text-red-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-red-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.criticalAlerts}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Critical Alerts</p>
          </div>
        </div>

        {/* Mortality Approval Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-rose-200 transition-all hover:bg-rose-50/10 group"
          onClick={() => setIsMortalityApprovalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 p-3 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
              <ShieldCheck size={22} />
            </div>
            {stats.pendingMortalityApproval > 0 && (
              <Badge className="bg-rose-500 text-white text-[8px] animate-pulse">ACTION REQUIRED</Badge>
            )}
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.pendingMortalityApproval}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality Approvals</p>
          </div>
        </div>

        {/* Mortality Trends Details Card - Actually just a link to the modal now since Top card does it but let's keep one in grid if space allows or replace with Stock */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-orange-200 transition-all hover:bg-orange-50/10 group"
          onClick={() => setIsFeedStockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-orange-50 p-3 rounded-2xl text-orange-600 group-hover:scale-110 transition-transform">
              <Package size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-orange-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalFeedStock.toLocaleString()} KG</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feed Stock</p>
          </div>
        </div>

        {/* Medicine Stock Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-purple-200 transition-all hover:bg-purple-50/10 group"
          onClick={() => setIsMedicineStockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-purple-50 p-3 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
              <Thermometer size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-purple-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalMedicineStock.toLocaleString()} Items</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medicine Stock</p>
          </div>
        </div>

        {/* Abandoned Carts Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-amber-200 transition-all hover:bg-amber-50/10 group"
          onClick={() => setIsAbandonedCartModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
              <ShoppingCart size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abandoned Carts ({stats.abandonedCartFarmers})</p>
              <h4 className="text-2xl font-bold text-slate-900">₹{abandonedCarts.reduce((sum, c) => sum + calculateCartTotal(c.items || []), 0).toLocaleString()}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-white rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg">Assigned Farmers</CardTitle>
            <CardDescription>Farmers under your direct supervision</CardDescription>
          </CardHeader>
          <CardContent>
            {myFarmers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic font-medium">
                No farmers assigned yet.
              </div>
            ) : (
              <div className="space-y-4">
                {myFarmers.map(farmer => (
                  <div key={farmer.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-lg font-bold text-slate-400 border border-slate-100 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                        {farmer.name?.[0]}
                      </div>
                      <div>
                        <p 
                          className="font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => viewFarmerBatches(farmer)}
                        >
                          {farmer.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <MapPin size={12} className="text-slate-400" />
                          <span>{farmer.district || 'Location not set'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-indigo-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => window.location.href = `tel:${farmer.phone}`}>
                        <Phone size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-emerald-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => window.location.href = `/manager/farmers?uid=${farmer.id}`}
                        title="Farmer Task"
                      >
                        <ClipboardList size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-amber-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => handleSendResetLink(farmer)}
                        title="Send Password Reset Link"
                      >
                        <Mail size={18} />
                      </Button>
                      <Button 
                        nativeButton={false}
                        render={<Link to={`/manager/farmers?uid=${farmer.id}`}><ArrowUpRight size={18} /></Link>} 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-white hover:shadow-sm" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Abandoned Carts List View */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="text-amber-600" />
              Abandoned Cart List
            </CardTitle>
            <CardDescription>Review items and potential commissions</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                {abandonedCarts.map(cart => {
                   const f = myFarmers.find(x => x.id === cart.userId);
                   const total = calculateCartTotal(cart.items || []);
                   return (
                     <div key={cart.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <p className="font-bold text-slate-900">{f?.name || 'User'}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">₹{total.toLocaleString()} • {cart.items?.length || 0} items</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs rounded-xl" onClick={() => setSelectedCart(cart)}>
                           View Cart
                        </Button>
                     </div>
                   );
                })}
                {abandonedCarts.length === 0 && (
                   <div className="text-center py-10 italic text-slate-400">No abandoned carts found.</div>
                )}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* --- ALL POPUP MODALS --- */}

      {/* My Assigned Farmers Modal */}
      <Dialog open={isAssignedFarmersModalOpen} onOpenChange={setIsAssignedFarmersModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-6xl max-h-[85vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-indigo-900">Your Assigned Farmers</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">Detailed overview of team members and their farm capacity</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-slate-100 h-14">
                    <TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Farmer Name</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Contact</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Active Flocks</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Placed Birds</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Capacity</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-right px-8">Location (City/Dist/State)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myFarmers.map(farmer => {
                    const farmerFlocks = flocks.filter(f => f.userId === farmer.id);
                    const birdsCount = farmerFlocks.reduce((sum, f) => sum + (f.currentCount || 0), 0);
                    return (
                      <TableRow key={farmer.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors h-16 group">
                        <TableCell className="px-8 flex items-center gap-3 py-4">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-400">
                             {farmer.name?.[0]}
                           </div>
                           <p className="text-sm font-black text-slate-900 uppercase">{farmer.name}</p>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-600 text-xs">
                           <p>{farmer.phone}</p>
                           <p className="text-[10px] text-slate-400">{farmer.email}</p>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge className="bg-slate-100 text-slate-600 border-none font-black">{farmerFlocks.length}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-black text-indigo-600">
                           {birdsCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-400">
                           {farmer.capacity || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right px-8">
                           <p className="text-[11px] font-black text-slate-900">{farmer.city || 'N/A'}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                             {farmer.district || 'N/A'} • {farmer.state || 'N/A'}
                           </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {myFarmers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-20 text-center text-slate-300 italic font-medium">
                        No farmers assigned yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isAbandonedCartModalOpen} onOpenChange={setIsAbandonedCartModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[600px] bg-white overflow-hidden p-0">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <DialogHeader className="p-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <ShoppingBag className="text-amber-600" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 leading-none">Abandoned Carts</DialogTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Pending Checkouts</p>
                </div>
              </div>
            </DialogHeader>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Commission</p>
              <p className="text-xl font-black text-indigo-600">
                ₹{abandonedCarts.reduce((sum, cart) => sum + calculateCartCommission(cart.items || []), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
            {myFarmers.map(farmer => {
              const farmerCarts = abandonedCarts.filter(c => c.userId === farmer.id);
              if (farmerCarts.length === 0) return null;
              const totalValue = farmerCarts.reduce((sum, c) => sum + calculateCartTotal(c.items || []), 0);
              
              return (
                <div key={farmer.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:border-amber-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:text-amber-600 transition-colors">
                      {farmer.name?.[0]}
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 leading-none">{farmer.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{farmer.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">₹{totalValue.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{farmerCarts.length} Cart(s)</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedCart(farmerCarts[0]);
                        setIsAbandonedCartModalOpen(false);
                      }}
                      className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-6"
                    >
                      VIEW CART
                    </Button>
                  </div>
                </div>
              );
            })}
            {stats.abandonedCartFarmers === 0 && (
              <div className="py-20 text-center text-slate-300 italic">No abandoned carts found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Carts Modal (Detailed Info) */}
      <Dialog open={!!selectedCart} onOpenChange={(open) => { if(!open) setSelectedCart(null); }}>
        <DialogContent className="rounded-[2rem] max-w-lg border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
               <ShoppingCart className="text-amber-500" size={24} />
               Cart Details - {myFarmers.find(f => f.id === selectedCart?.userId)?.name || 'Summary'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
              {selectedCart?.items?.map((item: any) => {
                const product = products.find(p => p.id === item.id);
                return (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <Package size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{product?.name || 'Product'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.quantity} {product?.unit} × ₹{product?.price}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-slate-900">₹{(Number(product?.price || 0) * Number(item.quantity)).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center px-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Cart Value</p>
                <p className="text-2xl font-black text-emerald-600">
                  ₹{selectedCart?.items ? (selectedCart.items as any[]).reduce((sum, item) => {
                    const product = products.find(p => p.id === item.id);
                    return sum + (Number(product?.price || 0) * Number(item.quantity));
                  }, 0).toLocaleString() : '0'}
                </p>
              </div>
              <div className="bg-indigo-50 p-6 rounded-[2rem] flex justify-between items-center group overflow-hidden relative border border-indigo-100">
                <div className="relative z-10">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Potential Commission</p>
                   <p className="text-4xl font-black text-indigo-600 italic">
                     ₹{selectedCart?.items ? calculateCartCommission(selectedCart.items).toLocaleString() : '0'}
                   </p>
                </div>
                <IndianRupee size={80} className="absolute -right-4 -bottom-4 text-indigo-100 opacity-50 group-hover:scale-110 transition-transform -rotate-12" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Farmer Batches Modal */}
      <Dialog open={!!selectedFarmerForBatches} onOpenChange={() => setSelectedFarmerForBatches(null)}>
        <DialogContent className="rounded-[3rem] max-w-lg backdrop-blur-xl bg-white/90">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Running Batches: {selectedFarmerForBatches?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {farmerBatches.length === 0 ? (
              <div className="py-20 text-center text-slate-400 italic">No active batches found.</div>
            ) : (
              farmerBatches.map(batch => (
                <div key={batch.id} className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl group transition-all hover:border-indigo-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h4 className="font-bold text-slate-900 text-lg">{batch.name}</h4>
                        <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-bold uppercase py-1">{batch.breed}</Badge>
                     </div>
                     <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">{batch.currentCount?.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Birds</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                     <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-300"/> {batch.placementDate}</span>
                     <span className="flex items-center gap-1.5"><Bird size={14} className="text-slate-300"/> Age: {Math.floor((new Date().getTime() - new Date(batch.placementDate).getTime()) / (1000 * 60 * 60 * 24))} Days</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Critical Alerts Modal */}
      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
               <AlertTriangle className="text-red-500" size={28} />
               Critical Field Alerts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
            {logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).map(log => {
              const f = myFarmers.find(x => x.id === log.userId);
              const alerts = [];
              if (log.alerts?.feedDrop) alerts.push('Feed Drop');
              if (log.alerts?.mortalityIncrease) alerts.push('Mortality Spike');
              if (log.alerts?.eggDrop) alerts.push('Egg Drop');
              
              return (
                <div key={log.id} className="p-5 bg-red-50/50 border border-red-100 rounded-3xl hover:bg-red-50 transition-colors flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-500 shadow-sm">
                        <AlertTriangle size={20} />
                     </div>
                     <div>
                       <p className="text-sm font-black text-slate-900 underline decoration-red-200 underline-offset-4">{f?.name}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{log.farmName} • {log.date}</p>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {alerts.map(a => <Badge key={a} variant="destructive" className="text-[8px] font-black uppercase tracking-tighter rounded-lg h-5">{a}</Badge>)}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-lg hover:bg-red-100 ml-2" onClick={() => window.location.href = `tel:${f?.phone}`}>
                       <Phone size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
            {logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).length === 0 && (
               <div className="py-20 text-center text-slate-300 italic flex flex-col items-center">
                  <ShieldCheck size={60} className="mb-4 opacity-20" />
                  <p className="text-lg font-bold">Safe Zone</p>
                  <p className="text-sm font-medium">No critical alerts detected in your assigned farms.</p>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Logs Modal */}
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-amber-600 flex items-center gap-2">
               <ClipboardList />
               Missing Reports ({logsTimeRange.toUpperCase()})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {myFarmers.map(farmer => {
               const now = new Date();
               const days = logsTimeRange === '1d' ? 1 : (logsTimeRange === '7d' ? 7 : 30);
               const missingDates: string[] = [];
               
               const farmerFlocks = flocks.filter(f => f.userId === farmer.id);
               if (farmerFlocks.length === 0) return null;

               for (let i = 0; i < days; i++) {
                 const checkDate = format(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                 farmerFlocks.forEach(flock => {
                   if (!logs.some(l => l.userId === farmer.id && l.flockId === flock.id && l.date === checkDate)) {
                     missingDates.push(`${checkDate} (${flock.name})`);
                   }
                 });
               }

               if (missingDates.length === 0) return null;

               return (
                 <div key={farmer.id} className="p-6 bg-amber-50/30 rounded-[2rem] border border-amber-100 flex flex-col gap-4">
                   <div className="flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-amber-600 border border-amber-100 shadow-sm">
                           {farmer.name?.[0]}
                        </div>
                        <div>
                           <p className="text-base font-black text-slate-900 leading-none">{farmer.name}</p>
                           <p className="text-[10px] text-amber-600 font-bold uppercase mt-1 tracking-tighter">{farmer.district || 'Location N/A'}</p>
                        </div>
                     </div>
                     <Button 
                        size="sm" 
                        variant="outline" 
                        className="rounded-xl h-10 px-4 border-amber-200 text-amber-600 font-black text-[10px]" 
                        onClick={() => window.location.href = `tel:${farmer.phone}`}
                     >
                        CALL FARMER
                     </Button>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-amber-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Unsubmitted Batches</p>
                      <div className="flex flex-wrap gap-2">
                        {missingDates.slice(0, 10).map((d, idx) => (
                           <Badge key={idx} variant="secondary" className="bg-amber-50 text-amber-700 text-[10px] font-bold border-none">
                             {d}
                           </Badge>
                        ))}
                        {missingDates.length > 10 && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold border-none">
                            +{missingDates.length - 10} more
                          </Badge>
                        )}
                      </div>
                   </div>
                 </div>
               );
            })}
            {(() => {
               const now = new Date();
               const days = logsTimeRange === '1d' ? 1 : (logsTimeRange === '7d' ? 7 : 30);
               let anyMissing = false;
               for (let i = 0; i < days; i++) {
                 const checkDate = format(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                 if (myFarmers.some(f => flocks.some(flock => flock.userId === f.id && !logs.some(l => l.userId === f.id && l.flockId === flock.id && l.date === checkDate)))) {
                   anyMissing = true;
                   break;
                 }
               }
               return !anyMissing;
            })() && (
               <div className="py-20 text-center text-emerald-600 flex flex-col items-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                     <CheckCircle2 size={40} />
                  </div>
                  <p className="text-xl font-black">All Clear</p>
                  <p className="text-sm font-medium">All assigned farmers have submitted their logs for the period.</p>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Flock Directory Modal */}
      <Dialog open={isFlockModalOpen} onOpenChange={setIsFlockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-5xl bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-indigo-900">Active Flock Directory</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">Comprehensive list of all running batches across assigned farms</DialogDescription>
          </DialogHeader>
          <div className="py-6 max-h-[75vh] overflow-y-auto pr-4 no-scrollbar">
             <div className="space-y-4">
               {flocks.length === 0 ? (
                 <div className="py-20 text-center text-slate-400 italic">No active flocks currently tracked.</div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow className="border-none hover:bg-transparent">
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14">Flock Name & Breed</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14">Farmer / Owner</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-center">Age (Days)</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-right">Population</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-right pr-6">Placement Date</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {flocks.map(flock => {
                        const owner = myFarmers.find(f => f.id === flock.userId);
                        const days = Math.ceil((new Date().getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <TableRow key={flock.id} className="bg-white border-b-[6px] border-slate-50 rounded-2xl overflow-hidden hover:bg-indigo-50/30 transition-colors">
                            <TableCell className="py-5 font-black text-slate-900">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                                  <Bird size={18} />
                                </div>
                                <div>
                                  <p>{flock.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{flock.breed}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-slate-700">{owner?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{owner?.district || 'Location N/A'}</p>
                            </TableCell>
                            <TableCell className="py-5 text-center">
                              <Badge className="bg-indigo-600 text-white rounded-lg font-black h-8 px-4">
                                Day {days}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 text-right">
                              <div className="font-black text-slate-900 text-lg">{flock.currentCount?.toLocaleString()}</div>
                              <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Initial: {flock.initialCount?.toLocaleString()}</div>
                            </TableCell>
                            <TableCell className="py-5 text-right pr-6 font-bold text-slate-500 font-mono text-xs">
                              {flock.placementDate}
                            </TableCell>
                          </TableRow>
                        );
                     })}
                   </TableBody>
                 </Table>
               )}
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Birds Location Summary */}
      <Dialog open={isBirdsModalOpen} onOpenChange={setIsBirdsModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl max-h-[85vh] overflow-y-auto">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black">Bird Inventory by Location</DialogTitle>
           </DialogHeader>
           <div className="py-6">
              <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 border-slate-100 h-14">
                       <TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Farmer / District</TableHead>
                       <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Active Batches</TableHead>
                       <TableHead className="font-black text-[11px] uppercase tracking-widest text-right px-8">Available Birds</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {myFarmers.map(farmer => {
                        const farmerFlocks = flocks.filter(f => f.userId === farmer.id);
                        const birdsCount = farmerFlocks.reduce((sum, f) => sum + (f.currentCount || 0), 0);
                        if (birdsCount === 0) return null;
                        return (
                           <TableRow key={farmer.id} className="border-slate-50 hover:bg-slate-50 transition-colors h-16 group">
                              <TableCell className="px-8 font-medium">
                                 <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{farmer.name}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{farmer.district || 'Remote'}</p>
                              </TableCell>
                              <TableCell className="text-center font-black text-slate-400 text-lg group-hover:text-slate-900">{farmerFlocks.length}</TableCell>
                              <TableCell className="text-right px-8">
                                 <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-lg">
                                  {birdsCount.toLocaleString()}
                                 </span>
                              </TableCell>
                           </TableRow>
                        );
                     })}
                  </TableBody>
                </Table>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Feed Stock drill-down Modal */}
      <Dialog open={isFeedStockModalOpen} onOpenChange={setIsFeedStockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-3xl">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-2xl font-black text-orange-600">
                <Package size={28} />
                Managed Feed Inventory
             </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
             {myFarmers.map(farmer => {
                const farmerStocks = feedStocks.filter(s => s.userId === farmer.id);
                const total = farmerStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                if (total === 0) return null;

                return (
                  <div key={farmer.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center group hover:bg-orange-50 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-300 group-hover:text-orange-500">
                           {farmer.name?.[0]}
                        </div>
                        <div>
                           <p className="text-base font-black text-slate-900">{farmer.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer.district || 'Allotted District'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <p className="text-xl font-black text-slate-900">{total.toLocaleString()} KG</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{farmerStocks.length} Items</p>
                        </div>
                        <Button 
                           variant="outline" 
                           onClick={() => {
                             setSelectedFarmerForStock(farmer);
                             setStockType('feed');
                           }}
                           className="rounded-xl border-orange-200 text-orange-600 font-black text-[10px] px-4"
                        >
                           DETAILS
                        </Button>
                     </div>
                  </div>
                );
             })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Medicine Stock drill-down Modal */}
      <Dialog open={isMedicineStockModalOpen} onOpenChange={setIsMedicineStockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-3xl">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-2xl font-black text-purple-600">
                <Thermometer size={28} />
                Managed Medicine Inventory
             </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
             {myFarmers.map(farmer => {
                const farmerStocks = medicineStocks.filter(s => s.userId === farmer.id);
                const total = farmerStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                if (total === 0) return null;

                return (
                  <div key={farmer.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center group hover:bg-purple-50 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-300 group-hover:text-purple-500">
                           {farmer.name?.[0]}
                        </div>
                        <div>
                           <p className="text-base font-black text-slate-900">{farmer.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer.district || 'Allotted District'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <p className="text-xl font-black text-slate-900">{total.toLocaleString()} Items</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{farmerStocks.length} Categories</p>
                        </div>
                        <Button 
                           variant="outline" 
                           onClick={() => {
                             setSelectedFarmerForStock(farmer);
                             setStockType('medicine');
                           }}
                           className="rounded-xl border-purple-200 text-purple-600 font-black text-[10px] px-4"
                        >
                           DETAILS
                        </Button>
                     </div>
                  </div>
                );
             })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deep Stock Detail Modal */}
      <Dialog open={!!selectedFarmerForStock} onOpenChange={() => setSelectedFarmerForStock(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black">
                 {stockType === 'feed' ? 'Feed Inventory' : 'Medicine Inventory'}: {selectedFarmerForStock?.name}
              </DialogTitle>
           </DialogHeader>
           <div className="py-4">
              <Table>
                 <TableHeader>
                    <TableRow className="border-slate-100">
                       <TableHead className="font-black text-[10px] uppercase tracking-widest">Item Name</TableHead>
                       {stockType === 'medicine' && <TableHead className="font-black text-[10px] uppercase tracking-widest">Type</TableHead>}
                       <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Quantity</TableHead>
                       <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Last Purchase</TableHead>
                       <TableHead className="font-black text-[10px] uppercase tracking-widest text-right pr-6">Cost Value</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {(stockType === 'feed' ? feedStocks : medicineStocks)
                      .filter(s => s.userId === selectedFarmerForStock?.id)
                      .map(item => {
                        const daysSincePurchase = item.timestamp ? Math.floor((new Date().getTime() - new Date(item.timestamp).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A';
                        const currentVal = Number(item.purchaseCost || 0);
                        
                        return (
                          <TableRow key={item.id} className="border-slate-50">
                             <TableCell className="font-bold text-slate-900 py-4">{item.name}</TableCell>
                             {stockType === 'medicine' && (
                               <TableCell>
                                 <Badge variant="secondary" className="bg-slate-100 text-[9px] font-bold uppercase">{item.type}</Badge>
                               </TableCell>
                             )}
                             <TableCell className="text-right font-black">
                               {item.quantity?.toLocaleString()} {item.unit || (stockType === 'feed' ? 'KG' : 'units')}
                             </TableCell>
                             <TableCell className="text-right text-xs font-bold text-slate-400">
                               {daysSincePurchase === 0 ? 'Today' : (daysSincePurchase === 'N/A' ? 'N/A' : `${daysSincePurchase} days ago`)}
                             </TableCell>
                             <TableCell className="text-right pr-6 font-bold text-emerald-600">
                               ₹{currentVal.toLocaleString()}
                             </TableCell>
                          </TableRow>
                        );
                      })
                    }
                 </TableBody>
              </Table>
           </div>
        </DialogContent>
      </Dialog>

      {/* Mortality Insights Detail Modal */}
      <Dialog open={isMortalityModalOpen} onOpenChange={(open) => { setIsMortalityModalOpen(open); if(!open) setSelectedFarmerForMortality(null); }}>
        <DialogContent className="rounded-[3rem] max-w-5xl bg-white max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <DialogHeader className="p-0 text-left">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-rose-50 rounded-[1.5rem] flex items-center justify-center text-rose-600 shadow-inner">
                   <Activity size={28} />
                </div>
                <div>
                   <DialogTitle className="text-2xl font-black text-rose-950 uppercase tracking-tight leading-none">Mortality Analytics</DialogTitle>
                   <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-1.5">Historical Batch Performance</p>
                </div>
              </div>
            </DialogHeader>
            <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
              {(['1d', '7d', '30d'] as const).map((range) => (
                <Button
                  key={range}
                  variant={mortalityTimeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMortalityTimeRange(range)}
                  className={`rounded-xl text-[10px] font-black h-9 px-5 ${mortalityTimeRange === range ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                >
                   {range.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="p-8">
             <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-sm bg-white">
               <Table>
                 <TableHeader>
                   <TableRow className="bg-slate-50/50 border-slate-100">
                     <TableHead className="font-black text-[10px] uppercase tracking-widest px-6">Farmer & Batch</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Age</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Mortality % ({mortalityTimeRange})</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Till Now %</TableHead>
                     <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Birds (I/C)</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {(() => {
                     const now = new Date();
                     let rangeLogs = logs;
                     if (mortalityTimeRange === '1d') {
                       rangeLogs = logs.filter(l => l.date === format(now, 'yyyy-MM-dd'));
                     } else if (mortalityTimeRange === '7d') {
                       rangeLogs = logs.filter(l => new Date(l.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
                     } else {
                       rangeLogs = logs.filter(l => new Date(l.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
                     }

                     const mortalityRecords: any[] = [];
                     flocks.forEach(flock => {
                        const farmer = myFarmers.find(f => f.id === flock.userId);
                        const flockRangeLogs = rangeLogs.filter(l => l.flockId === flock.id);
                        const rangeMortality = flockRangeLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
                        
                        const totalMortality = (Number(flock.initialCount) || 0) - (Number(flock.currentCount) || 0);
                        
                        const rangeRate = Number(flock.initialCount) > 0 ? (rangeMortality / Number(flock.initialCount)) * 100 : 0;
                        const totalRate = Number(flock.initialCount) > 0 ? (totalMortality / Number(flock.initialCount)) * 100 : 0;
                        const age = Math.floor((new Date().getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24));

                        mortalityRecords.push({
                           farmerName: farmer?.name || 'N/A',
                           batchName: flock.name,
                           age,
                           rangeRate: rangeRate.toFixed(2),
                           totalRate: totalRate.toFixed(2),
                           initial: flock.initialCount,
                           current: flock.currentCount
                        });
                     });

                     return mortalityRecords.sort((a, b) => Number(b.rangeRate) - Number(a.rangeRate)).map((rec, i) => (
                        <TableRow key={i} className="border-slate-50 hover:bg-rose-50/30 transition-colors">
                          <TableCell className="px-6 py-4">
                             <p className="text-xs font-black text-slate-900">{rec.farmerName}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{rec.batchName}</p>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-600 text-xs">
                             {rec.age} Days
                          </TableCell>
                          <TableCell className="text-center">
                             <span className={`px-3 py-1 rounded-lg font-black text-xs ${Number(rec.rangeRate) > 1 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                               {rec.rangeRate}%
                             </span>
                          </TableCell>
                          <TableCell className="text-center">
                             <span className={`px-3 py-1 rounded-lg font-black text-xs ${Number(rec.totalRate) > 5 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                               {rec.totalRate}%
                             </span>
                          </TableCell>
                          <TableCell className="text-right py-4">
                             <p className="text-xs font-black text-slate-900">{rec.current.toLocaleString()}</p>
                             <p className="text-[9px] text-slate-400 font-bold uppercase">Start: {rec.initial.toLocaleString()}</p>
                          </TableCell>
                        </TableRow>
                     ));
                   })()}
                 </TableBody>
               </Table>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mortality Approval Action Modal */}
      <Dialog open={isMortalityApprovalOpen} onOpenChange={setIsMortalityApprovalOpen}>
        <DialogContent className="rounded-[3rem] max-w-2xl bg-slate-50">
           <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black text-emerald-700">
                 <ShieldCheck size={32} />
                 Mortality Verification Queue
              </DialogTitle>
              <DialogDescription className="font-bold text-slate-400">Review pending mortality updates before they are finalized in the system</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {logs.filter(l => (Number(l.health?.mortality) || 0) > 0 && l.approved === false).map(log => {
                 const owner = myFarmers.find(f => f.id === log.userId);
                 return (
                    <div key={log.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/20 flex flex-col gap-6 scale-up">
                       <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                             <div className="w-16 h-16 rounded-[2rem] bg-rose-50 flex items-center justify-center text-rose-600 shrink-0 border border-rose-100 shadow-inner">
                                <AlertTriangle size={32} />
                             </div>
                             <div>
                                <p className="text-lg font-black text-slate-900 leading-tight">{owner?.name || 'Farmer'}</p>
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">MORTALITY: {log.health?.mortality} BIRDS</p>
                             </div>
                          </div>
                          <Badge className="bg-slate-100 text-slate-400 border-none font-bold text-[9px] px-3 h-6 rounded-lg uppercase">{log.date}</Badge>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Farmer Observation</p>
                          <p className="text-sm text-slate-600 font-bold italic line-clamp-3">
                             {log.health?.symptoms ? `"${log.health.symptoms}"` : 'No symptoms reported by the farmer for this event.'}
                          </p>
                       </div>
                       <div className="flex gap-3 pt-2">
                          <Button className="flex-[2] rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-14 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1 active:translate-y-0" onClick={() => handleApproveMortality(log.id)}>
                             APPROVE LOG
                          </Button>
                          <Button variant="outline" className="flex-1 rounded-[1.5rem] border-slate-200 text-slate-400 font-black text-xs h-14 bg-slate-50 hover:bg-white hover:text-slate-600" onClick={() => window.location.href = `tel:${owner?.phone}`}>
                             CALL
                          </Button>
                       </div>
                    </div>
                 );
              })}
              {logs.filter(l => (Number(l.health?.mortality) || 0) > 0 && l.approved === false).length === 0 && (
                 <div className="py-20 text-center flex flex-col items-center">
                    <div className="w-24 h-24 bg-white rounded-[2.5rem] border border-slate-100 shadow-inner flex items-center justify-center mb-6">
                       <ShieldCheck size={48} className="text-emerald-300 opacity-50" />
                    </div>
                    <p className="text-xl font-black text-slate-900">Verification Queue Clear</p>
                    <p className="text-sm font-bold text-slate-400 mt-1 max-w-[250px] mx-auto">All mortality entries have been reviewed and verified for your team.</p>
                 </div>
              )}
           </div>
        </DialogContent>
      </Dialog>

      {/* Egg Collection Modal */}
      <Dialog open={isEggCollectionModalOpen} onOpenChange={setIsEggCollectionModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-6xl max-h-[85vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-amber-600 flex items-center gap-2">
              <ShoppingBag size={32} />
              Egg Collection Data
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400">Detailed production and costing overview for egg collection</DialogDescription>
            <div className="flex gap-2 mt-4">
              {(['Today', 'Yesterday', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setEggTimeRange(range)}
                  className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${eggTimeRange === range ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </DialogHeader>
          <div className="py-6">
            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-slate-100 h-14">
                    <TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Farmer & Batch</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Eggs (Good/Bad)</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Laying Ratio</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Cost/Egg</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Unsold Eggs</TableHead>
                    <TableHead className="font-black text-[11px] uppercase tracking-widest text-right px-8">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const now = new Date();
                    let filteredLogs = eggLogs;
                    if (eggTimeRange === 'Today') {
                      const today = format(now, 'yyyy-MM-dd');
                      filteredLogs = eggLogs.filter(l => l.date === today);
                    } else if (eggTimeRange === 'Yesterday') {
                      const yesterday = format(new Date(now.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                      filteredLogs = eggLogs.filter(l => l.date === yesterday);
                    } else if (eggTimeRange === '7d') {
                      const lastWeekly = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      filteredLogs = eggLogs.filter(l => new Date(l.date) >= lastWeekly);
                    } else {
                      const lastMonthly = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      filteredLogs = eggLogs.filter(l => new Date(l.date) >= lastMonthly);
                    }

                    return filteredLogs.map((log, idx) => {
                      const farmer = myFarmers.find(f => f.id === log.userId);
                      const totalEggs = (Number(log.goodEggs) || 0) + (Number(log.badEggs) || 0) || Number(log.totalEggs) || 0;
                      const goodEggs = Number(log.goodEggs) || totalEggs;
                      const badEggs = Number(log.badEggs) || (totalEggs - goodEggs);
                      const feedCost = Number(log.feedCost) || 0;
                      const medCost = Number(log.medicineCost) || 0;
                      const labourCost = Number(log.labourCost) || 0;
                      const totalCost = feedCost + medCost + labourCost;
                      const costPerEgg = goodEggs > 0 ? totalCost / goodEggs : 0;
                      const birdCount = Number(log.birdCount) || 1;
                      const layingRatio = (totalEggs / birdCount) * 100;
                      
                      return (
                        <TableRow key={idx} className="border-slate-50 hover:bg-slate-50/50 transition-colors h-20 group">
                          <TableCell className="px-8 py-4">
                            <p className="text-sm font-black text-slate-900 uppercase">{farmer?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.batchName || 'No Batch'}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-black text-slate-900 text-base">{totalEggs}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase flex justify-center gap-2">
                               <span className="text-emerald-600">G: {goodEggs}</span>
                               <span className="text-rose-600">B: {badEggs}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-amber-50 text-amber-600 border-none font-black text-xs h-7 px-3">{layingRatio.toFixed(1)}%</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                             <div className="font-black text-emerald-600">₹{costPerEgg.toFixed(2)}</div>
                             <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">PER EGG</div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-300 italic text-[10px]">
                            DATA UNAVAILABLE
                          </TableCell>
                          <TableCell className="text-right px-8">
                             <p className="text-xs font-black text-slate-700">{format(new Date(log.date), 'dd MMM')}</p>
                             <p className="text-[9px] text-slate-400 font-bold uppercase">{format(new Date(log.date), 'yyyy')}</p>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                  {eggLogs.filter(l => {
                      const now = new Date();
                      if (eggTimeRange === 'Today') return l.date === format(now, 'yyyy-MM-dd');
                      if (eggTimeRange === 'Yesterday') return l.date === format(new Date(now.getTime() - 24*60*60*1000), 'yyyy-MM-dd');
                      if (eggTimeRange === '7d') return new Date(l.date) >= new Date(now.getTime() - 7*24*60*60*1000);
                      return new Date(l.date) >= new Date(now.getTime() - 30*24*60*60*1000);
                  }).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-24 text-center">
                        <div className="flex flex-col items-center opacity-30">
                           <ShoppingBag size={48} className="mb-4" />
                           <p className="text-sm font-black uppercase tracking-widest text-slate-400">No Collection Records</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* License Key Modal Detail */}
      <Dialog open={isLicenseModalOpen} onOpenChange={setIsLicenseModalOpen}>
        <DialogContent className="rounded-[3.5rem] max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-50 p-0 border-none shadow-2xl">
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white">
            <DialogHeader className="p-0 text-left">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-[2.2rem] flex items-center justify-center text-red-600 shadow-inner">
                   <ShieldCheck size={32} />
                </div>
                <div>
                   <DialogTitle className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tight">License System</DialogTitle>
                   <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mt-1">Expiring within 5 days</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="p-10 space-y-4">
             {licenseKeys.filter(lk => {
                if (!lk.expiryDate || lk.status !== 'Used') return false;
                const expiry = new Date(lk.expiryDate);
                const now = new Date();
                const diff = expiry.getTime() - now.getTime();
                return diff > 0 && diff <= 5 * 24 * 60 * 60 * 1000;
             }).map((lk, idx) => {
                const farmer = allUsers.find(u => u.id === lk.userId);
                const expiryDate = new Date(lk.expiryDate);
                const now = new Date();
                const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={idx} className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-red-200 transition-all hover:shadow-xl hover:shadow-red-500/5">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-[1.8rem] bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 uppercase text-xl group-hover:bg-red-50 group-hover:text-red-400 group-hover:border-red-100 transition-all">
                        {farmer?.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900 leading-none uppercase">{farmer?.name || 'Unknown Farmer'}</p>
                        <div className="flex items-center gap-3 mt-3">
                           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                             <Phone size={12} className="text-slate-400" />
                             <p className="text-[11px] text-slate-600 font-black">{farmer?.phone || 'No phone'}</p>
                           </div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">KEY: {lk.key}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                      <div>
                        <Badge className="bg-red-600 text-white border-none font-black h-10 px-6 rounded-2xl text-xs uppercase tracking-tight shadow-lg shadow-red-200">
                           EXPIRING IN {daysRemaining} DAYS
                        </Badge>
                        <p className="text-[10px] text-slate-400 font-black mt-2 uppercase italic tracking-widest">VALID UNTIL {format(expiryDate, 'dd MMM yyyy')}</p>
                      </div>
                      <Button size="icon" onClick={() => window.location.href = `tel:${farmer?.phone}`} className="w-12 h-12 rounded-2xl bg-slate-900 hover:bg-red-600 transition-colors shadow-lg">
                         <Phone size={20} />
                      </Button>
                    </div>
                  </div>
                );
             })}
             {licenseKeys.filter(lk => {
                if (!lk.expiryDate || lk.status !== 'Used') return false;
                const expiry = new Date(lk.expiryDate);
                const now = new Date();
                const diff = expiry.getTime() - now.getTime();
                return diff > 0 && diff <= 5 * 24 * 60 * 60 * 1000;
             }).length === 0 && (
               <div className="py-24 text-center">
                  <div className="w-24 h-24 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-center mx-auto mb-6 opacity-30 shadow-inner">
                     <ShieldCheck size={48} className="text-slate-400" />
                  </div>
                  <p className="text-xl font-black text-slate-300 uppercase tracking-widest">No Near Expiries</p>
                  <p className="text-sm font-bold text-slate-300 mt-2">All managed licenses are within safe validity periods.</p>
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
