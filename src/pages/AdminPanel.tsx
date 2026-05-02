import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis,
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList,
  CartesianGrid
} from 'recharts';
import { 
  Users, 
  Package, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { format, subDays, startOfWeek, startOfMonth, isSameWeek, isSameMonth, parseISO } from 'date-fns';

const AdminPanel: React.FC = () => {
  const [stats, setStats] = useState({
    totalFarmers: 0,
    activeFlocks: 0,
    totalBirds: 0,
    mortalityRate: 0,
    totalBirdsPlaced: 0
  });

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      operationType: operation,
      path: path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          email: p.email
        }))
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [allFlocks, setAllFlocks] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [medItems, setMedItems] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [sectionFilters, setSectionFilters] = useState({
    farmer: 'today',
    stock: 'today',
    shop: 'today',
    revenue: 'today'
  });

  const getFilteredData = (data: any[], filter: string, dateKey: string = 'date') => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

    return data.filter(item => {
      const itemDate = item[dateKey];
      if (!itemDate) return false;
      const dateStr = safeFormat(itemDate, 'yyyy-MM-dd');
      
      if (filter === 'today') return dateStr === todayStr;
      if (filter === 'yesterday') return dateStr === yesterdayStr;
      
      const d = new Date(itemDate);
      if (isNaN(d.getTime())) return false;
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      
      if (filter === '7days') return diffDays <= 7;
      if (filter === '15days') return diffDays <= 15;
      if (filter === '30days') return diffDays <= 30;
      
      return true;
    });
  };

  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7days' | '14days' | '30days' | 'weekly' | 'monthly'>('14days');
  const [selectedDayDetails, setSelectedDayDetails] = useState<any[] | null>(null);

  const safeFormat = (dateInput: any, formatStr: string) => {
    if (!dateInput) return 'N/A';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return 'N/A';
      return format(d, formatStr);
    } catch (e) {
      return 'N/A';
    }
  };

  const safeDateCompare = (dateInput: any, compareTo: string) => {
    if (!dateInput) return false;
    return safeFormat(dateInput, 'yyyy-MM-dd') === compareTo;
  };

  useEffect(() => {
    // 1. Fetch users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(u => map[u.id] = u.data());
      setUsersMap(map);
    });

    // 2. Fetch flocks
    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snap) => {
      setAllFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch logs
    const unsubLogs = onSnapshot(query(collection(db, 'dailyLogs'), orderBy('date', 'desc')), (snap) => {
      setAllLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Fetch feed
    const unsubFeed = onSnapshot(collection(db, 'feedStock'), (snap) => {
      setFeedItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 5. Fetch medicine
    const unsubMed = onSnapshot(collection(db, 'medicineStock'), (snap) => {
      setMedItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 6. Fetch shop data
    const unsubShopItems = onSnapshot(collection(db, 'shopItems'), (snap) => {
      setShopItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCarts = onSnapshot(collection(db, 'carts'), (snap) => {
      setCarts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 7. Fetch Egg data
    const unsubEggLogs = onSnapshot(collection(db, 'eggLogs'), (snap) => {
      setEggLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEggSales = onSnapshot(collection(db, 'eggSales'), (snap) => {
      setEggSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 8. Fetch Transactions
    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 9. Fetch System Alerts
    const unsubAlerts = onSnapshot(collection(db, 'systemAlerts'), (snap) => {
      setSystemAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 10. Fetch Schedules
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);

    return () => {
      unsubUsers(); unsubFlocks(); unsubLogs(); unsubFeed(); unsubMed();
      unsubShopItems(); unsubOrders(); unsubCarts(); unsubEggLogs();
      unsubEggSales(); unsubTransactions(); unsubAlerts(); unsubSchedules();
    };
  }, []);

  // Calculate Metrics
  const today = format(new Date(), 'yyyy-MM-dd');

  // Memoized derived data
  const missingLogsFlocks = React.useMemo(() => {
    const active = allFlocks.filter(f => f.status === 'Active');
    const flocksWithLogs = new Set(allLogs.filter(l => l.date === today).map(l => l.flockId));
    return active.filter(f => !flocksWithLogs.has(f.id));
  }, [allFlocks, allLogs, today]);

  const feedByFarm = React.useMemo(() => {
    const uids = Array.from(new Set(feedItems.map(i => i.userId)));
    return uids.map(uid => {
      const userFeed = feedItems.filter(i => i.userId === uid);
      const types: Record<string, number> = {};
      const companyMap: Record<string, string> = {};
      let lastUpdate = '';
      let lastQty = 0;

      userFeed.forEach(i => {
        const typeKey = i.type?.toLowerCase() || 'other';
        let simpleKey = 'O';
        if (typeKey.includes('pre')) simpleKey = 'P';
        else if (typeKey.includes('star')) simpleKey = 'S';
        else if (typeKey.includes('finis')) simpleKey = 'F';
        else if (typeKey.includes('layer')) simpleKey = 'L';
        
        types[simpleKey] = (types[simpleKey] || 0) + (i.quantity || 0);
        if (i.companyName) companyMap[simpleKey] = i.companyName;
        
        if (!lastUpdate || i.createdAt > lastUpdate) {
          lastUpdate = i.createdAt;
          lastQty = i.quantity;
        }
      });

      return {
        userId: uid,
        total: userFeed.reduce((sum, i) => sum + (i.quantity || 0), 0),
        types,
        companyMap,
        lastUpdate,
        lastQty
      };
    }).sort((a,b) => b.total - a.total);
  }, [feedItems]);

  const lowFeedFarmersCount = React.useMemo(() => {
    return feedByFarm.filter(f => f.total < 100).length;
  }, [feedByFarm]);

  const medByFarm = React.useMemo(() => {
    const uids = Array.from(new Set(medItems.map(i => i.userId)));
    return uids.map(uid => {
      const items = medItems.filter(i => i.userId === uid).map(it => {
        const expiryDate = it.expiryDate ? new Date(it.expiryDate) : null;
        const daysToExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 999;
        return { ...it, daysToExpiry };
      });
      return {
        userId: uid,
        total: items.length,
        items
      };
    }).sort((a,b) => b.total - a.total);
  }, [medItems]);

  const allProcessedAlerts = React.useMemo(() => {
    const manualAlerts = systemAlerts.map(a => ({
      id: a.id,
      type: 'Broadcast',
      farmerName: a.target === 'All' ? 'Global' : a.target,
      message: a.title,
      severity: a.priority === 'High' ? 'critical' : 'warning',
      date: safeFormat(a.createdAt || Date.now(), 'yyyy-MM-dd')
    }));

    const healthAlerts: any[] = [];
    allLogs.slice(0, 50).forEach(log => {
      if (log.health?.mortality > 5) {
        healthAlerts.push({
          id: `${log.id}-mort`,
          type: 'High Mortality',
          farmerName: usersMap[log.userId]?.name || 'Farmer',
          message: `${log.health.mortality} birds reported dead`,
          severity: 'critical',
          date: log.date
        });
      }
    });

    return [...manualAlerts, ...healthAlerts].slice(0, 20);
  }, [systemAlerts, allLogs, usersMap]);

  // Farmer Stats (Filtered)
  const filteredFarmerLogs = getFilteredData(allLogs, sectionFilters.farmer, 'date');
  const activeFlocks = allFlocks.filter(f => f.status === 'Active');
  const farmersCount = Object.values(usersMap).filter(u => u.role === 'farmer').length;
  
  const submissionsCount = new Set(filteredFarmerLogs.map(l => l.flockId)).size;
  const totalExpectedLogs = activeFlocks.length;
  
  const totalBirds = activeFlocks.reduce((sum, f) => sum + (Number(f.currentCount) || 0), 0);
  const filteredMortality = filteredFarmerLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
  const totalBirdsAtStart = activeFlocks.reduce((sum, f) => sum + (Number(f.initialCount) || 0), 0);
  const mortalityRate = totalBirdsAtStart > 0 ? (filteredMortality / totalBirdsAtStart) * 100 : 0;

  // Stock Stats (Filtered)
  const [eggFilterAge, setEggFilterAge] = useState<string>('all');
  const [eggFilterBreed, setEggFilterBreed] = useState<string>('all');

  const filteredEggLogs = React.useMemo(() => {
    let logs = getFilteredData(eggLogs, sectionFilters.stock, 'date');
    if (eggFilterBreed !== 'all') {
      logs = logs.filter(l => {
        const flock = allFlocks.find(f => f.id === l.flockId);
        return flock?.breed === eggFilterBreed;
      });
    }
    if (eggFilterAge !== 'all') {
      const now = new Date();
      now.setHours(0,0,0,0);
      logs = logs.filter(l => {
        const logDate = new Date(l.date);
        const diff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
        if (eggFilterAge === 'today') return diff === 0;
        return diff === parseInt(eggFilterAge);
      });
    }
    return logs;
  }, [eggLogs, sectionFilters.stock, eggFilterAge, eggFilterBreed, allFlocks]);

  const filteredEggSales = getFilteredData(eggSales, sectionFilters.stock, 'date');
  const filteredFeedLogs = getFilteredData(feedItems, sectionFilters.stock, 'createdAt');

  const totalFeed = filteredFeedLogs.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalMedicineTypes = new Set(getFilteredData(medItems, sectionFilters.stock, 'createdAt').map(m => m.name)).size;
  
  // Growth stats are snapshots of active flocks
  const flockPerformance = React.useMemo(() => {
    return activeFlocks.map(f => {
      const flockLogs = allLogs.filter(l => l.flockId === f.id).sort((a,b) => b.date.localeCompare(a.date));
      const latestWeight = flockLogs.length > 0 ? (Number(flockLogs[0].production?.avgWeight || flockLogs[0].production?.averageWeight || flockLogs[0].avgWeight) || 0) : 0;
      const age = f.placementDate ? Math.floor((new Date().getTime() - new Date(f.placementDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      const totalFeedConsumed = flockLogs.reduce((sum, l) => sum + (Number(l.production?.feedConsumed) || 0), 0);
      const totalMortality = flockLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
      const mortalityPercent = f.initialCount > 0 ? (totalMortality / f.initialCount) * 100 : 0;
      
      const aliveBirds = (f.initialCount || 0) - totalMortality;
      const totalBiomass = aliveBirds * latestWeight;
      const fcr = totalBiomass > 0 ? totalFeedConsumed / totalBiomass : 0;
      
      // Rough cost estimations
      const feedCostPerKg = 40; // Assumed
      const chickCost = 35; // Assumed
      const totalCost = (totalFeedConsumed * feedCostPerKg) + ((f.initialCount || 0) * chickCost);
      const costPerKg = totalBiomass > 0 ? totalCost / totalBiomass : 0;
      const costPerBird = aliveBirds > 0 ? totalCost / aliveBirds : 0;

      return {
        ...f,
        latestWeight,
        age,
        totalFeedConsumed,
        totalMortality,
        mortalityPercent,
        fcr,
        costPerKg,
        costPerBird,
        aliveBirds
      };
    });
  }, [activeFlocks, allLogs]);

  const batchesAbove700g = flockPerformance.filter(f => f.latestWeight >= 0.7 && f.latestWeight < 1).length;
  const batchesAbove1kg = flockPerformance.filter(f => f.latestWeight >= 1).length;
  const batches70Days = flockPerformance.filter(f => f.age >= 70).length;

  const currentBirds = activeFlocks.reduce((sum, f) => sum + (f.currentCount || 0), 0);
  const filteredEggCollection = filteredEggLogs.reduce((sum, l) => sum + (l.totalEggs || 0), 0);
  const collectionPercent = filteredEggCollection > 0 && currentBirds > 0 ? (filteredEggCollection / currentBirds) * 100 : 0;
  const filteredAvailableEggs = filteredEggCollection - filteredEggSales.reduce((sum, s) => sum + (s.eggCount || 0), 0);

  // Shop Stats (Filtered)
  const filteredOrders = getFilteredData(orders, sectionFilters.shop, 'date');
  const ordersCount = filteredOrders.length;
  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending').length;
  const deliveredOrders = filteredOrders.filter(o => o.status === 'Delivered').length;
  const abandonedCarts = getFilteredData(carts, sectionFilters.shop, 'updatedAt').filter(c => {
    if (!c.updatedAt) return false;
    const cartDate = new Date(c.updatedAt);
    if (isNaN(cartDate.getTime())) return false;
    const hoursOld = (new Date().getTime() - cartDate.getTime()) / (1000 * 60 * 60);
    return hoursOld > 2;
  }).length;
  const lowStock = shopItems.filter(i => i.stockQuantity > 0 && i.stockQuantity <= 10).length;
  const outOfStock = shopItems.filter(i => (i.stockQuantity || 0) === 0).length;

  // Revenue Stats (Filtered)
  const filteredTransactions = getFilteredData(transactions, sectionFilters.revenue, 'date');
  const revenueTotal = filteredTransactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalRevenueAllTime = transactions
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Schedule Stats
  const upcomingSchedulesCount = schedules.filter(s => {
    if (s.status === 'Completed' || s.completed) return false;
    const d = new Date(s.date);
    const now = new Date();
    const tomorrow = subDays(now, -1);
    const dayAfter = subDays(now, -2);
    return isSameMonth(d, now) && (safeDateCompare(s.date, format(tomorrow, 'yyyy-MM-dd')) || safeDateCompare(s.date, format(dayAfter, 'yyyy-MM-dd')));
  }).length;

  const missedSchedulesCount = schedules.filter(s => {
    if (s.status === 'Completed' || s.completed) return false;
    const d = new Date(s.date);
    const now = new Date();
    now.setHours(0,0,0,0);
    return d < now;
  }).length;

  const [detailModal, setDetailModal] = useState<{ id: string; title: string } | null>(null);

  const StatMiniCard = ({ title, value, unit, icon: Icon, color, subValue, onClick, id }: any) => (
    <Card 
      className={`border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-md transition-all cursor-pointer hover:scale-[1.02]`}
      onClick={() => onClick ? onClick() : setDetailModal({ id: id || title.toLowerCase().replace(/ /g, '_'), title })}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className={`${color} p-1.5 rounded-lg text-white`}>
            <Icon size={14} />
          </div>
          {subValue && <span className="text-[9px] font-black italic text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{subValue}</span>}
        </div>
        <p className="text-[9px] font-black italic text-slate-400 uppercase tracking-wider mb-1 line-clamp-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <h3 className="text-xl font-black italic text-slate-900 leading-none">{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}</h3>
          {unit && <span className="text-[10px] font-bold text-slate-400 italic">{unit}</span>}
        </div>
      </CardContent>
    </Card>
  );

  const DetailModal = () => {
    if (!detailModal) return null;

    const renderDetailContent = () => {
      switch (detailModal.id) {
        case 'farmers':
        case 'total_farmers':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Registered Farmers Details</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Contact</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Join Since</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Manager</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">City</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(usersMap).filter(u => u.role === 'farmer').map((u: any) => (
                    <TableRow key={u.id} className="border-slate-50">
                      <TableCell className="font-bold text-slate-700 text-xs">{u.name}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{u.phone}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{safeFormat(u.createdAt, 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{u.managerName || usersMap[u.managerId]?.name || '-'}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{u.city || '-'}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{u.state || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        case 'active_flocks':
        case 'total_birds':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Active Poultry Batches Detail</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase">Flock Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Farmer</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Contact</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">City</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">State</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Placed</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Alive</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Weight</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Breed</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeFlocks.map(f => {
                    const perf = flockPerformance.find(p => p.id === f.id);
                    const farmer = usersMap[f.userId];
                    const weight = (perf?.latestWeight || 0).toFixed(2);
                    return (
                      <TableRow key={f.id} className="border-slate-50">
                        <TableCell className="font-bold text-slate-700 text-xs">{f.name}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.phone || '-'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.city || '-'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.state || '-'}</TableCell>
                        <TableCell className="font-bold text-slate-700 text-xs text-right">{f.initialCount?.toLocaleString()}</TableCell>
                        <TableCell className="font-black text-emerald-600 text-xs text-right">{f.currentCount?.toLocaleString()}</TableCell>
                        <TableCell className="font-black text-blue-600 text-xs text-right">{weight} kg</TableCell>
                        <TableCell className="text-slate-400 text-xs">{f.breed}</TableCell>
                        <TableCell className="text-slate-400 text-xs">{safeFormat(f.placementDate, 'MMM dd, yyyy')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'alerts':
          return (
            <div className="space-y-4 text-left">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Critical System Alerts</h4>
              <div className="grid grid-cols-1 gap-4">
                {allProcessedAlerts.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 rounded-[2rem] text-slate-400 italic font-bold">
                    No critical alerts detected
                  </div>
                ) : (
                  allProcessedAlerts.map(alert => (
                    <div key={alert.id} className={`p-6 rounded-[2rem] border-l-8 flex gap-4 ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'
                    }`}>
                      <div className={`p-3 rounded-2xl h-fit ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <AlertTriangle size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h5 className="font-black italic text-slate-900 uppercase text-xs">{alert.type}: {alert.farmerName}</h5>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{alert.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 italic font-medium">{alert.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        case 'logs':
          const flocksWithLogs = new Set(allLogs.filter(l => l.date === today).map(l => l.flockId));
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Daily Submission Status (Today)</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase">Batch Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Farmer Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Breed</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center">Status</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Contact</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">City</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeFlocks.sort((a, b) => {
                    const aSubmitted = flocksWithLogs.has(a.id);
                    const bSubmitted = flocksWithLogs.has(b.id);
                    if (aSubmitted === bSubmitted) return 0;
                    return aSubmitted ? 1 : -1; // Pending first
                  }).map(flock => {
                    const farmer = usersMap[flock.userId];
                    const isSubmitted = flocksWithLogs.has(flock.id);
                    return (
                      <TableRow key={flock.id} className="border-slate-50">
                        <TableCell className="font-bold text-slate-700 text-xs">{flock.name}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{flock.breed}</TableCell>
                        <TableCell className="text-center">
                          {isSubmitted ? (
                            <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] font-black italic uppercase">SUBMITTED</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-600 border-none text-[8px] font-black italic uppercase">PENDING</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.phone || '-'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.city || '-'}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{farmer?.state || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'shop_items':
          return (
            <div className="space-y-6">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Shop Inventory Health</h4>
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="text-[10px] font-black uppercase">Item Name</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Category</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Price</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Stock</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {shopItems.sort((a,b) => (a.stockQuantity || 0) - (b.stockQuantity || 0)).map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-black uppercase">{item.name}</TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</TableCell>
                      <TableCell className="text-xs font-bold text-right">₹{item.price}</TableCell>
                      <TableCell className={`text-xs font-black text-right ${item.stockQuantity <= 10 ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.stockQuantity}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[8px] font-bold border-none uppercase ${
                          item.stockQuantity === 0 ? 'bg-red-100 text-red-600' : 
                          item.stockQuantity <= 10 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {item.stockQuantity === 0 ? 'Out of Stock' : item.stockQuantity <= 10 ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        case 'shop_stats':
          return (
            <div className="space-y-6">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Abandoned Carts & Potential Conversion</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {carts.filter(c => c.items?.length > 0).map(cart => (
                  <div key={cart.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[10px] font-black italic text-slate-400 uppercase mb-2">Customer: {usersMap[cart.userId]?.name || 'Guest'}</p>
                    <div className="space-y-2 mb-4">
                      {cart.items.map((it: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-slate-600 italic font-bold">{shopItems.find(si => si.id === it.id)?.name || 'Item'} x{it.quantity}</span>
                          <span className="font-black">₹{it.price * it.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Last Updated</span>
                      <span className="text-xs font-bold">{safeFormat(cart.updatedAt, 'MMM dd, HH:mm')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        case 'mortality':
          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black italic text-slate-400 uppercase">Mortality Analytics ({sectionFilters.farmer})</h4>
                <div className="text-2xl font-black italic text-red-600">{filteredMortality} Birds Total</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Farmer</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Contact</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Flock</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Count</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">%</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">T Count</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">T %</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Placed</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Alive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFarmerLogs.filter(l => l.health?.mortality > 0).sort((a,b) => b.date.localeCompare(a.date)).map(l => {
                    const farmer = usersMap[l.userId];
                    const flock = allFlocks.find(f => f.id === l.flockId);
                    
                    // Historical mortality for this flock up to this date
                    const flockLogs = allLogs.filter(al => al.flockId === l.flockId && al.date <= l.date);
                    const totalMortalitySoFar = flockLogs.reduce((sum, al) => sum + (al.health?.mortality || 0), 0);
                    const initial = flock?.initialCount || 1;
                    const percent = (l.health.mortality / initial) * 100;
                    const totalPercent = (totalMortalitySoFar / initial) * 100;

                    return (
                      <TableRow key={l.id} className="border-slate-50">
                        <TableCell className="text-xs font-bold whitespace-nowrap">{l.date}</TableCell>
                        <TableCell className="text-xs">{farmer?.name || 'Farmer'}</TableCell>
                        <TableCell className="text-xs">{farmer?.phone || '-'}</TableCell>
                        <TableCell className="text-xs italic text-slate-500">{flock?.name}</TableCell>
                        <TableCell className="text-xs font-black text-red-500 text-right">{l.health.mortality}</TableCell>
                        <TableCell className="text-xs font-bold text-red-400 text-right">{percent.toFixed(2)}%</TableCell>
                        <TableCell className="text-xs font-black text-slate-700 text-right">{totalMortalitySoFar}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-500 text-right">{totalPercent.toFixed(2)}%</TableCell>
                        <TableCell className="text-xs text-right">{flock?.initialCount?.toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-bold text-emerald-600 text-right">{flock?.currentCount?.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'schedule':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Vaccination & Maintenance Schedules</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Farmer</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Contact</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Batch name</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Schedule</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.sort((a,b) => b.date.localeCompare(a.date)).map(s => {
                    const farmer = usersMap[s.userId];
                    const flock = allFlocks.find(f => f.id === s.flockId);
                    const isDone = s.status === 'Completed' || s.completed;
                    const d = new Date(s.date);
                    const now = new Date();
                    now.setHours(0,0,0,0);
                    const isMissed = !isDone && d < now;
                    const isUpcoming = !isDone && !isMissed;

                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-bold">{s.date}</TableCell>
                        <TableCell className="text-xs">{farmer?.name}</TableCell>
                        <TableCell className="text-xs">{farmer?.phone}</TableCell>
                        <TableCell className="text-xs italic">{flock?.name}</TableCell>
                        <TableCell className="text-xs font-medium">{s.title || s.task || s.vaccineName}</TableCell>
                        <TableCell>
                           {isDone ? (
                             <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] font-black italic uppercase">DONE</Badge>
                           ) : isMissed ? (
                             <Badge className="bg-red-100 text-red-600 border-none text-[8px] font-black italic uppercase">MISS</Badge>
                           ) : (
                             <Badge className="bg-amber-100 text-amber-600 border-none text-[8px] font-black italic uppercase">UPCOMING</Badge>
                           )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'egg_collection':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Egg Production Details</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase text-left">Date</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-left">Farmer/Contact</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-left">Batch/Location</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center">G/B</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center">Alive</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center">Laying %</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center">Bad %</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Cost/Egg</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Cost/Bird</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEggLogs.sort((a,b) => b.date.localeCompare(a.date)).map(l => {
                    const flock = allFlocks.find(f => f.id === l.flockId);
                    const farmer = usersMap[l.userId];
                    const gb = flock?.currentCount > 0 ? (l.totalEggs / flock.currentCount).toFixed(2) : '-';
                    const layingPercent = flock?.currentCount > 0 ? ((l.totalEggs / flock.currentCount) * 100).toFixed(1) : '-';
                    const badPercent = l.totalEggs > 0 ? ((l.brokenEggs / l.totalEggs) * 100).toFixed(1) : '-';
                    const costPerBird = flock?.currentCount > 0 ? (l.totalExpenses || 0) / flock.currentCount : 0;
                    
                    return (
                      <TableRow key={l.id} className="border-slate-50">
                        <TableCell className="text-xs font-bold whitespace-nowrap">{l.date}</TableCell>
                        <TableCell>
                          <p className="text-xs font-black uppercase leading-none mb-1">{farmer?.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold italic">{farmer?.phone}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-black italic text-slate-900 leading-none mb-1">{flock?.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{farmer?.city}, {farmer?.state}</p>
                        </TableCell>
                        <TableCell className="text-xs text-center font-bold text-amber-600">{gb}</TableCell>
                        <TableCell className="text-xs text-center font-black">{flock?.currentCount}</TableCell>
                        <TableCell className="text-xs text-center font-black text-emerald-600">{layingPercent}%</TableCell>
                        <TableCell className="text-xs text-center text-red-500 font-bold">{badPercent}%</TableCell>
                        <TableCell className="text-xs text-right font-black">₹{l.costPerEgg || '-'}</TableCell>
                        <TableCell className="text-xs text-right font-black">₹{costPerBird.toFixed(1)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'available_eggs':
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Egg Age</p>
                  <select 
                    value={eggFilterAge} 
                    onChange={(e) => setEggFilterAge(e.target.value)}
                    className="bg-white border-none rounded-2xl text-xs font-bold px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    {[1,2,3,4,5,6,7].map(d => <option key={d} value={d.toString()}>{d} Day{d > 1 ? 's' : ''} Old</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Breed Filter</p>
                  <select 
                    value={eggFilterBreed} 
                    onChange={(e) => setEggFilterBreed(e.target.value)}
                    className="bg-white border-none rounded-2xl text-xs font-bold px-4 py-2 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="all">All Breeds</option>
                    {Array.from(new Set(allFlocks.map(f => f.breed).filter(Boolean))).map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="text-[10px] font-black uppercase">Age</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Farmer</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Batch/Breed</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Location</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Available</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Laying %</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Cost/Egg</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Cost/Bird</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEggLogs.map(l => {
                    const flock = allFlocks.find(f => f.id === l.flockId);
                    const farmer = usersMap[l.userId];
                    const now = new Date();
                    now.setHours(0,0,0,0);
                    const daysOld = Math.floor((now.getTime() - new Date(l.date).getTime()) / (1000 * 60 * 60 * 24));
                    const available = l.totalEggs - (eggSales.filter(s => s.date === l.date && s.flockId === l.flockId).reduce((sum, s) => sum + s.eggCount, 0));
                    const layingPercent = flock?.currentCount > 0 ? ((l.totalEggs / flock.currentCount) * 100).toFixed(1) : '-';
                    const costPerBird = flock?.currentCount > 0 ? (l.totalExpenses || 0) / flock.currentCount : 0;
                    
                    if (available <= 0) return null;

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs font-black text-amber-600">{daysOld === 0 ? 'FRESH' : `${daysOld}D OLD`}</TableCell>
                        <TableCell>
                          <p className="text-xs font-black uppercase leading-none mb-1">{farmer?.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold italic">{farmer?.phone}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-black italic text-slate-900 leading-none mb-1">{flock?.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{flock?.breed}</p>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">
                          {farmer?.city}, {farmer?.state}
                        </TableCell>
                        <TableCell className="text-xs text-right font-black text-amber-900">{available.toLocaleString()} PCS</TableCell>
                        <TableCell className="text-xs text-right font-black text-emerald-600">{layingPercent}%</TableCell>
                        <TableCell className="text-xs text-right font-bold">₹{l.costPerEgg || '-'}</TableCell>
                        <TableCell className="text-xs text-right font-bold">₹{costPerBird.toFixed(1)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'total_feed':
          return (
            <div className="space-y-6">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Farmer Feed Inventory Tracking</h4>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="font-black text-[10px] uppercase">Farmer</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Location</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center text-blue-600">P</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center text-indigo-600">S</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center text-emerald-600">F</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center text-amber-600">L</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-center text-slate-400">O</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right">Total</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Last Entry & Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedByFarm.map(f => {
                    const farmer = usersMap[f.userId];
                    const primaryCompany = Object.values(f.companyMap)[0] || '-';
                    return (
                      <TableRow key={f.userId} className={f.total < 100 ? 'bg-red-50/50' : 'border-slate-50'}>
                        <TableCell>
                          <p className="text-xs font-black uppercase">{farmer?.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{farmer?.phone}</p>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">
                          {farmer?.city}, {farmer?.state}
                        </TableCell>
                        <TableCell className="text-center font-black text-blue-600">{f.types['P'] || 0}</TableCell>
                        <TableCell className="text-center font-black text-indigo-600">{f.types['S'] || 0}</TableCell>
                        <TableCell className="text-center font-black text-emerald-600">{f.types['F'] || 0}</TableCell>
                        <TableCell className="text-center font-black text-amber-600">{f.types['L'] || 0}</TableCell>
                        <TableCell className="text-center font-black text-slate-400">{f.types['O'] || 0}</TableCell>
                        <TableCell className={`text-right font-black ${f.total < 100 ? 'text-red-600' : 'text-slate-900'}`}>
                          {f.total.toLocaleString()} kg
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-black italic">{primaryCompany}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{safeFormat(f.lastUpdate, 'MMM dd')} (+{f.lastQty}kg)</p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'medicine':
          return (
            <div className="space-y-6">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Medicine Expiry & Stock Watch</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medByFarm.map(farm => (
                  <div key={farm.userId} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <p className="text-[10px] font-black italic text-indigo-600 uppercase mb-3">{usersMap[farm.userId]?.name} • {usersMap[farm.userId]?.phone}</p>
                    <div className="space-y-3">
                      {farm.items.map((it: any) => (
                        <div key={it.id} className="flex justify-between items-center text-xs p-2 bg-white rounded-xl shadow-sm border border-slate-50">
                          <div>
                            <p className="font-black text-slate-900 uppercase leading-none mb-1">{it.name}</p>
                            <p className={`text-[9px] font-bold uppercase ${it.daysToExpiry <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                              {it.daysToExpiry <= 0 ? 'EXPIRED' : `Expires in ${it.daysToExpiry} days`}
                            </p>
                          </div>
                          <span className="font-black bg-slate-100 px-2 py-1 rounded-lg">{it.quantity} {it.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        case 'growth_700':
        case 'growth_1kg':
        case 'growth_70days':
          const filteredFlocks = flockPerformance.filter(f => {
            if (detailModal.id === 'growth_700') return f.latestWeight >= 0.7 && f.latestWeight < 1;
            if (detailModal.id === 'growth_1kg') return f.latestWeight >= 1;
            if (detailModal.id === 'growth_70days') return f.age >= 70;
            return true;
          });
          
          return (
            <div className="space-y-6">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Growth Performance Analytics</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="text-[10px] font-black uppercase">Batch/Farmer</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-center">Weight</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-center">Age</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-center">FCR</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Cost/Kg</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Cost/Bird</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Mortality</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Feed Cons.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlocks.map(f => {
                    const farmer = usersMap[f.userId];
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <p className="text-xs font-black uppercase">{f.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer?.name} • {farmer?.city}</p>
                        </TableCell>
                        <TableCell className="text-center font-black text-blue-600 text-xs">{f.latestWeight.toFixed(2)} kg</TableCell>
                        <TableCell className="text-center font-black text-xs">{f.age} D</TableCell>
                        <TableCell className="text-center font-black text-emerald-600 text-xs">{f.fcr.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold text-xs">₹{f.costPerKg.toFixed(1)}</TableCell>
                        <TableCell className="text-right font-bold text-xs">₹{f.costPerBird.toFixed(1)}</TableCell>
                        <TableCell className="text-right">
                          <p className="text-xs font-black text-red-500">{f.totalMortality}</p>
                          <p className="text-[10px] font-black text-red-300">{f.mortalityPercent.toFixed(1)}%</p>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-slate-700">{f.totalFeedConsumed.toLocaleString()} kg</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        case 'orders':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Store Orders ({sectionFilters.shop})</h4>
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Customer</TableHead>
                     <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                     <TableHead className="text-[10px] font-black uppercase text-right">Total</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.sort((a,b) => b.date.localeCompare(a.date)).map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs font-bold">{o.date}</TableCell>
                      <TableCell className="text-xs">{usersMap[o.userId]?.name || 'Guest'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[8px] font-bold border-none ${
                          o.status === 'Pending' ? 'bg-amber-100 text-amber-600' : 
                          o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {o.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-black text-right">₹{o.totalAmount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        case 'revenue':
        case 'total_sales':
          return (
            <div className="space-y-4">
              <h4 className="text-sm font-black italic text-slate-400 uppercase">Revenue Breakdown ({sectionFilters.revenue})</h4>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="font-black text-[10px] uppercase">Date</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Source</TableHead>
                        <TableHead className="font-black text-[10px] uppercase">Category</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.filter(t => t.type === 'Income').sort((a,b) => b.date.localeCompare(a.date)).map(t => (
                        <TableRow key={t.id} className="border-slate-50">
                          <TableCell className="text-xs font-bold">{t.date}</TableCell>
                          <TableCell className="text-xs">{t.source || 'General Sale'}</TableCell>
                          <TableCell className="text-xs italic text-slate-500">{t.category}</TableCell>
                          <TableCell className="text-xs font-black text-emerald-600 text-right">₹{t.amount.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-4">
                  <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white">
                    <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest mb-2">Total Period Revenue</p>
                    <h3 className="text-4xl font-black italic">₹{revenueTotal.toLocaleString()}</h3>
                  </div>
                </div>
              </div>
            </div>
          );
        default:
          return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic font-bold">
               <Activity size={48} className="mb-4 opacity-20" />
               <p>Detailed analysis for "{detailModal.title}" is in production.</p>
            </div>
          );
      }
    };

    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col p-4 md:p-10 animate-in slide-in-from-bottom duration-500 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full min-h-full flex flex-col">
          <div className="flex justify-between items-center mb-12 flex-shrink-0">
            <div>
              <p className="text-[10px] font-black italic text-emerald-600 uppercase tracking-[0.2em] mb-2">Analytics Insight</p>
              <h2 className="text-3xl md:text-5xl font-black italic text-slate-900 uppercase tracking-tighter">{detailModal.title}</h2>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => setDetailModal(null)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 px-8 font-black italic uppercase text-sm shadow-xl shadow-red-200"
            >
              Close
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {renderDetailContent()}
          </div>
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, subtitle, icon: Icon, section }: any) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 mt-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-100">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black italic text-slate-900 uppercase tracking-tight leading-none">{title}</h2>
          <p className="text-[10px] font-bold text-slate-400 italic uppercase tracking-widest mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-1 bg-slate-100/50 p-1 rounded-xl w-fit">
        {['today', 'yesterday', '7days', '15days', '30days'].map((f) => (
          <button
            key={f}
            onClick={() => setSectionFilters(prev => ({ ...prev, [section]: f }))}
            className={`px-3 py-1 rounded-lg text-[9px] font-black italic uppercase transition-all ${
              sectionFilters[section as keyof typeof sectionFilters] === f
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {f === '7days' ? '7D' : f === '15days' ? '15D' : f === '30days' ? '30D' : f}
          </button>
        ))}
      </div>
    </div>
  );

  const getMortalityTrendData = () => {
    const now = new Date();
    let data: any[] = [];
    
    const normalizeDate = (date: any) => {
      if (!date) return '';
      if (typeof date === 'string') return date.split('T')[0];
      if (date.toDate) return format(date.toDate(), 'yyyy-MM-dd');
      if (date instanceof Date) return format(date, 'yyyy-MM-dd');
      return String(date);
    };

    if (timeRange === '7days' || timeRange === '14days' || timeRange === '30days') {
      const days = timeRange === '7days' ? 7 : timeRange === '14days' ? 14 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = subDays(now, i);
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayLogs = allLogs.filter(log => normalizeDate(log.date) === dateStr);
        const mortality = dayLogs.reduce((sum, log) => sum + (Number(log.health?.mortality) || 0), 0);
        const dayFlockIds = new Set(dayLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => dayFlockIds.has(f.id) || (f.status === 'Active' && normalizeDate(f.placementDate) <= dateStr));
        const totalBirds = relevantFlocks.reduce((sum, f) => sum + (Number(f.initialCount) || 0), 0);
        const rate = totalBirds > 0 ? (mortality / totalBirds) * 100 : 0;
        data.push({
          name: days > 7 ? format(d, 'MM/dd') : format(d, 'EEE'),
          fullDate: dateStr,
          mortality,
          rate: Number(rate.toFixed(2))
        });
      }
    } else if (timeRange === 'weekly') {
      for (let i = 3; i >= 0; i--) {
        const d = subDays(now, i * 7);
        const weekStart = startOfWeek(d);
        const weekLogs = allLogs.filter(log => {
          if (!log.date) return false;
          const logDate = parseISO(log.date);
          if (isNaN(logDate.getTime())) return false;
          return isSameWeek(logDate, weekStart);
        });
        const mortality = weekLogs.reduce((sum, log) => sum + (log.health?.mortality || 0), 0);
        const weekFlockIds = new Set(weekLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => weekFlockIds.has(f.id) || f.status === 'Active');
        const totalBirds = relevantFlocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
        const rate = totalBirds > 0 ? (mortality / totalBirds) * 100 : 0;
        data.push({ name: `W${format(weekStart, 'w')}`, weekStart, mortality, rate: Number(rate.toFixed(2)) });
      }
    } else if (timeRange === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = subDays(now, i * 30);
        const monthStart = startOfMonth(d);
        const monthLogs = allLogs.filter(log => {
          if (!log.date) return false;
          const logDate = parseISO(log.date);
          if (isNaN(logDate.getTime())) return false;
          return isSameMonth(logDate, monthStart);
        });
        const mortality = monthLogs.reduce((sum, log) => sum + (log.health?.mortality || 0), 0);
        const monthFlockIds = new Set(monthLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => monthFlockIds.has(f.id) || f.status === 'Active');
        const totalBirds = relevantFlocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
        const rate = totalBirds > 0 ? (mortality / totalBirds) * 100 : 0;
        data.push({ name: format(monthStart, 'MMM'), monthStart, mortality, rate: Number(rate.toFixed(2)) });
      }
    }
    return data;
  };

  const handleBarClick = (data: any) => {
    if (!data) return;
    let filteredLogs: any[] = [];
    if (timeRange === '7days' || timeRange === '14days' || timeRange === '30days') {
      filteredLogs = allLogs.filter(log => log.date === data.fullDate && (log.health?.mortality > 0));
    } else if (timeRange === 'weekly') {
      filteredLogs = allLogs.filter(log => {
        if (!log.date) return false;
        const logDate = parseISO(log.date);
        if (isNaN(logDate.getTime())) return false;
        return isSameWeek(logDate, data.weekStart) && (log.health?.mortality > 0);
      });
    } else if (timeRange === 'monthly') {
      filteredLogs = allLogs.filter(log => {
        if (!log.date) return false;
        const logDate = parseISO(log.date);
        if (isNaN(logDate.getTime())) return false;
        return isSameMonth(logDate, data.monthStart) && (log.health?.mortality > 0);
      });
    }
    const details = filteredLogs.map(log => ({
      farmerName: usersMap[log.userId]?.name || 'Unknown',
      flockName: allFlocks.find((f: any) => f.id === log.flockId)?.name || 'Unknown',
      mortality: log.health?.mortality || 0,
      date: log.date
    }));
    setSelectedDayDetails(details);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">ANALYTICS</h1>
          <p className="text-slate-500 font-bold italic">Global Poultry Performance Dashboard</p>
        </div>
      </div>

      {/* FARMER SECTION */}
      <SectionHeader title="Farmer Analytics" subtitle="Health and Engagement Metrics" icon={Users} section="farmer" />
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatMiniCard title="System Alerts" value={allProcessedAlerts.filter(a => a.severity === 'critical').length} unit="High" icon={AlertTriangle} color="bg-red-500" onClick={() => setDetailModal({ id: 'alerts', title: 'System Alerts' })} />
        <StatMiniCard title="Submissions" value={submissionsCount} unit={`/ ${totalExpectedLogs}`} icon={Activity} color="bg-orange-500" onClick={() => setDetailModal({ id: 'logs', title: 'Daily Submissions' })} />
        <StatMiniCard title="Total Farmers" value={farmersCount} icon={Users} color="bg-emerald-600" id="total_farmers" />
        <StatMiniCard title="Active Flocks" value={activeFlocks.length} icon={Package} color="bg-indigo-600" id="active_flocks" />
        <StatMiniCard title="Total Birds" value={totalBirds.toLocaleString()} icon={TrendingUp} color="bg-amber-500" id="total_birds" />
        <StatMiniCard title="Mortality" value={mortalityRate} unit="%" icon={AlertTriangle} color={mortalityRate > 5 ? "bg-red-600" : "bg-emerald-500"} id="mortality" />
        <StatMiniCard 
          title="Schedule" 
          value={upcomingSchedulesCount} 
          unit="Upcoming" 
          subValue={missedSchedulesCount > 0 ? `${missedSchedulesCount} Miss` : undefined}
          icon={Activity} 
          color={missedSchedulesCount > 0 ? "bg-red-500" : "bg-slate-700"} 
          id="schedule" 
        />
      </div>

      {/* STOCK SECTION */}
      <SectionHeader title="Stock & Growth" subtitle="Inventory and Bird Performance" icon={Package} section="stock" />
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatMiniCard title="Total Feed" value={totalFeed.toLocaleString()} unit="kg" subValue={lowFeedFarmersCount > 0 ? `${lowFeedFarmersCount} Low` : undefined} icon={Package} color="bg-emerald-600" id="total_feed" />
        <StatMiniCard title="Medicine" value={totalMedicineTypes} unit="Types" icon={Activity} color="bg-indigo-600" id="medicine" />
        <StatMiniCard title="Batch > 700g" value={batchesAbove700g} unit="Units" icon={Activity} color="bg-blue-500" id="growth_700" />
        <StatMiniCard title="Batch > 1kg" value={batchesAbove1kg} unit="Units" icon={TrendingUp} color="bg-emerald-500" id="growth_1kg" />
        <StatMiniCard title="70 Days Birds" value={batches70Days} unit="Batches" icon={Activity} color="bg-orange-600" id="growth_70days" />
        <StatMiniCard title="Egg Collection" value={filteredEggCollection} unit="Pcs" subValue={`${collectionPercent.toFixed(1)}%`} icon={TrendingUp} color="bg-amber-400" id="egg_collection" />
        <StatMiniCard title="Available Eggs" value={filteredAvailableEggs} unit="Pcs" icon={Package} color="bg-amber-600" id="available_eggs" />
      </div>

      {/* SHOP SECTION */}
      <SectionHeader title="Shop Operations" subtitle="Sales and Inventory Health" icon={TrendingUp} section="shop" />
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatMiniCard title="Total Items" value={shopItems.length} icon={Package} color="bg-slate-700" id="shop_items" />
        <StatMiniCard title="Total Orders" value={ordersCount} icon={TrendingUp} color="bg-indigo-600" id="orders" />
        <StatMiniCard title="Pending" value={pendingOrders} icon={AlertTriangle} color="bg-amber-500" id="orders" />
        <StatMiniCard title="Delivered" value={deliveredOrders} icon={Activity} color="bg-emerald-600" id="orders" />
        <StatMiniCard title="Abandoned" value={abandonedCarts} unit="Carts" icon={AlertTriangle} color="bg-red-400" id="shop_stats" />
        <StatMiniCard title="Low Stock" value={lowStock} unit="Items" icon={AlertTriangle} color="bg-orange-400" id="shop_items" />
        <StatMiniCard title="Out of Stock" value={outOfStock} unit="Items" icon={AlertTriangle} color="bg-red-600" id="shop_items" />
      </div>

      {/* REVENUE SECTION */}
      <SectionHeader title="Financial Status" subtitle="Revenue and Transactions" icon={TrendingUp} section="revenue" />
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatMiniCard title="Revenue" value={`₹${revenueTotal.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-600" id="revenue" />
        <StatMiniCard title="Total Sales" value={`₹${totalRevenueAllTime.toLocaleString()}`} icon={Activity} color="bg-indigo-600" id="total_sales" />
      </div>

      {/* Detailed Sections Container */}
      {activeDetail && (
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {activeDetail === 'feed' && 'Detailed Feed Inventory'}
                {activeDetail === 'medicine' && 'Detailed Medicine Stock'}
                {activeDetail === 'alerts' && 'Active Critical Alerts'}
                {activeDetail === 'logs' && 'Missing Daily Logs Today'}
              </h3>
              <p className="text-sm text-slate-400">Farm-wise breakdown and status</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveDetail(null)} className="text-xs text-slate-400">Close Details</Button>
          </div>

          {activeDetail === 'logs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missingLogsFlocks.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-emerald-50 rounded-[2rem] text-emerald-600 font-bold">
                  All active batches have submitted logs today! 🎉
                </div>
              ) : (
                missingLogsFlocks.map(flock => (
                  <div key={flock.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{flock.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Farmer: {usersMap[flock.userId]?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-red-100 text-red-600 border-none text-[8px] font-bold">PENDING</Badge>
                        <span className="text-[10px] text-slate-400">{flock.breed}</span>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm">
                      <Phone size={16} className="text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeDetail === 'feed' && (
            <div className="space-y-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farm Name</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total (kg)</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pre-Starter</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Starter</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Finisher</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Layer</th>
                      <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Other</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedByFarm.map((farm) => {
                      const farmer = usersMap[farm.userId];
                      return (
                        <tr key={farm.userId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-2">
                            <p className="font-bold text-slate-900 text-sm">{farmer?.farmName || farmer?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400">{farmer?.email || 'No email'}</p>
                          </td>
                          <td className="py-4 px-2 font-bold text-emerald-600 text-sm">{farm.total.toLocaleString()}</td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{farm.types['Pre-Starter'] || 0}</td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{farm.types['Starter'] || 0}</td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{farm.types['Finisher'] || 0}</td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{farm.types['Layer'] || 0}</td>
                          <td className="py-4 px-2 text-slate-600 text-xs">{farm.types['Other'] || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Feed Entry History</h4>
                    <p className="text-[10px] text-slate-400">All individual stock additions across all farms</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold">{feedItems.length} Total Entries</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farmer</th>
                        <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feed Type</th>
                        <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Quantity</th>
                        <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedItems
                        .sort((a, b) => {
                          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                          return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                        })
                        .map((item) => {
                          const farmer = usersMap[item.userId];
                          return (
                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-2 text-xs text-slate-500">
                                {safeFormat(item.createdAt, 'MMM dd, yyyy')}
                              </td>
                              <td className="py-3 px-2">
                                <p className="text-xs font-bold text-slate-900">{farmer?.farmName || farmer?.name || 'Unknown'}</p>
                                <p className="text-[9px] text-slate-400">{farmer?.email}</p>
                              </td>
                              <td className="py-3 px-2">
                                <Badge variant="secondary" className="text-[9px] font-bold bg-slate-100 text-slate-600 border-none">
                                  {item.type}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-xs font-bold text-emerald-600 text-right">
                                {item.quantity?.toLocaleString()} kg
                              </td>
                              <td className="py-3 px-2 text-xs text-slate-600 text-right">
                                ₹{item.purchaseCost?.toLocaleString() || 0}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeDetail === 'medicine' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farm Name</th>
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Items</th>
                    <th className="py-4 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medicines</th>
                  </tr>
                </thead>
                <tbody>
                  {medByFarm.map((farm) => {
                    const farmer = usersMap[farm.userId];
                    return (
                      <tr key={farm.userId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2">
                          <p className="font-bold text-slate-900 text-sm">{farmer?.farmName || farmer?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400">{farmer?.email}</p>
                        </td>
                        <td className="py-4 px-2 font-bold text-indigo-600 text-sm">{farm.total.toLocaleString()}</td>
                        <td className="py-4 px-2">
                          <div className="flex flex-wrap gap-1">
                            {farm.items.slice(0, 5).map((item: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-[10px] font-medium">{item.name} ({item.quantity}{item.unit})</Badge>
                            ))}
                            {farm.items.length > 5 && <span className="text-[10px] text-slate-400">+{farm.items.length - 5} more</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeDetail === 'alerts' && (
            <div className="space-y-4">
              {allProcessedAlerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  No critical alerts detected
                </div>
              ) : (
                allProcessedAlerts.map((alert) => (
                  <div key={alert.id} className={`p-6 rounded-2xl border-l-4 flex gap-4 ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'
                  }`}>
                    <div className={`p-2 rounded-xl h-fit ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900">{alert.type}: {alert.farmerName}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">{alert.date}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mortality Chart */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Mortality Rate Trends</h3>
              <p className="text-sm text-slate-400">Day-wise mortality tracking and percentage</p>
            </div>
            <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-lg text-[10px] font-bold ${timeRange === '7days' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setTimeRange('7days')}
              >
                7D
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-lg text-[10px] font-bold ${timeRange === '14days' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setTimeRange('14days')}
              >
                14D
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-lg text-[10px] font-bold ${timeRange === '30days' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setTimeRange('30days')}
              >
                30D
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-lg text-[10px] font-bold ${timeRange === 'weekly' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setTimeRange('weekly')}
              >
                Weekly
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`rounded-lg text-[10px] font-bold ${timeRange === 'monthly' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setTimeRange('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>
          <div className="h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getMortalityTrendData()} onClick={(e: any) => e && handleBarClick(e.activePayload?.[0]?.payload)}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#F9F9F4'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="mortality" fill="#122B21" radius={[6, 6, 0, 0]} barSize={40}>
                  <LabelList 
                    dataKey="rate" 
                    position="top" 
                    formatter={(val: any) => `${val}%`}
                    style={{ fill: '#122B21', fontSize: 10, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Opening Section for Mortality Details */}
          {selectedDayDetails && (
            <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Mortality Details</h4>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDayDetails(null)} className="text-xs text-slate-400">Close</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedDayDetails.map((detail, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold text-slate-900">{detail.farmerName}</p>
                      <Badge className="bg-red-100 text-red-600 border-none text-[10px]">{detail.mortality} Birds</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">Batch: {detail.flockName}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{detail.date}</p>
                  </div>
                ))}
                {selectedDayDetails.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No mortality reported for this period</p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Regional Heatmap Placeholder */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-slate-900">Regional Performance Heatmap</h3>
          <p className="text-sm text-slate-400">Active flock density and health index by district</p>
        </div>
        
        <div className="absolute inset-0 bg-emerald-50/30 flex items-center justify-center opacity-50">
          <div className="w-full h-full bg-[url('https://picsum.photos/seed/map/800/600')] bg-cover bg-center grayscale opacity-20"></div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-40 relative z-10">
          {[
            { label: 'CENTRAL PLAINS', value: '94.2', color: 'text-emerald-600' },
            { label: 'HIGHLANDS', value: '88.5', color: 'text-emerald-600' },
            { label: 'COASTAL BELT', value: '62.1', color: 'text-amber-600' },
          ].map((region) => (
            <div key={region.label} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{region.label}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold text-slate-900">{region.value}</span>
                <span className={`text-[10px] font-bold ${region.color}`}>Health Index</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <DetailModal />
    </div>
  );
};

export default AdminPanel;
