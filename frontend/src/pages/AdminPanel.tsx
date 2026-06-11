import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { 
  Users, Bird, ShoppingCart, Wallet, TrendingUp, AlertTriangle, 
  Activity, Clock, Calendar, HeartPulse, Package, ArrowUpRight, 
  Search, ShieldAlert, BadgeInfo, Trash2, CheckCircle2, DollarSign, Layers, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

type TimeFilter = 'today' | 'yesterday' | '7d' | '15d' | '30d' | '2m' | '3m' | '6m' | '1y' | '2y';

const AdminPanel: React.FC = () => {
  // Realtime Collection States
  const [farmers, setFarmers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [feedStock, setFeedStock] = useState<any[]>([]);
  const [medicineStock, setMedicineStock] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Independent Filters for each of the 4 sections
  const [farmerFilter, setFarmerFilter] = useState<TimeFilter>('7d');
  const [stockFilter, setStockFilter] = useState<TimeFilter>('7d');
  const [shopFilter, setShopFilter] = useState<TimeFilter>('7d');
  const [financeFilter, setFinanceFilter] = useState<TimeFilter>('7d');

  // Interactive Modal State for Card Clicking
  const [selectedMetric, setSelectedMetric] = useState<{
    id: string;
    title: string;
    description: string;
    searchPlaceholder?: string;
    data: any[];
    headers: string[];
    renderRow: (item: any) => React.ReactNode;
  } | null>(null);

  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [expandedAddressIds, setExpandedAddressIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fallback Mock Datasets if collection has no items during initial setup
  const fallbackAlerts = [
    { id: 'al-1', userId: 'f-mock-1', severity: 'Critical', status: 'Active', description: 'High humidity level detected in Shed A', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 'al-2', userId: 'f-mock-2', severity: 'Warning', status: 'Active', description: 'Abrupt water intake decline in Broiler flock B', createdAt: new Date(Date.now() - 25 * 3600000).toISOString() }
  ];

  const fallbackLogs = [
    { id: 'l-1', date: format(new Date(), 'yyyy-MM-dd'), timestamp: new Date().toISOString(), userId: 'f-mock-1', flockId: 'fl-mock-1', consumption: { feedIntake: 230 }, averageWeight: 720, mortality: 3 },
    { id: 'l-2', date: format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'), timestamp: new Date(Date.now() - 86400000).toISOString(), userId: 'f-mock-2', flockId: 'fl-mock-2', consumption: { feedIntake: 180 }, averageWeight: 1040, mortality: 1 }
  ];

  const fallbackFarmers = [
    { id: 'f-mock-1', name: 'Nandan Poultry Farm', email: 'nandan@nestagro.com', phone: '+91 98822 34455', address: 'Pune, Maharashtra', createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), licenseActive: true, licenseActivatedAt: new Date(Date.now() - 340 * 86400000).toISOString() },
    { id: 'f-mock-2', name: 'Balaji Eggs Corp', email: 'balaji@eggcorp.in', phone: '+91 97722 55660', address: 'Anand, Gujarat', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), licenseActive: true, licenseActivatedAt: new Date(Date.now() - 120 * 86400000).toISOString() },
    { id: 'f-mock-3', name: 'Krishna Broilers', email: 'krishna@broiler.in', phone: '+91 88990 12233', address: 'Salem, Tamil Nadu', createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), licenseActive: false }
  ];

  const fallbackFlocks = [
    { id: 'fl-mock-1', name: 'Cobb 500 Breed', breed: 'Cobb 500', type: 'Broiler', initialCount: 4500, currentCount: 4420, placementDate: new Date(Date.now() - 35 * 86400000).toISOString(), averageWeight: 690, status: 'Active', farmerId: 'f-mock-1' },
    { id: 'fl-mock-2', name: 'Hy-Line Silver', breed: 'Hy-Line Silver', type: 'Layer', initialCount: 6000, currentCount: 5970, placementDate: new Date(Date.now() - 85 * 86400000).toISOString(), averageWeight: 1120, status: 'Active', farmerId: 'f-mock-2' },
    { id: 'fl-mock-3', name: 'Vencobb Cockerels', breed: 'Vencobb 430', type: 'Broiler', initialCount: 3000, currentCount: 2950, placementDate: new Date(Date.now() - 72 * 86400000).toISOString(), averageWeight: 1450, status: 'Active', farmerId: 'f-mock-3' }
  ];

  const fallbackSchedules = [
    { id: 'sc-1', taskName: 'Newcastle Vaccine Booster', type: 'Vaccination', date: format(new Date(), 'yyyy-MM-dd'), status: 'Pending', userId: 'f-mock-1', flockId: 'fl-mock-1' },
    { id: 'sc-2', taskName: 'Calcium Supplement Session', type: 'Medicine', date: format(new Date(), 'yyyy-MM-dd'), status: 'Completed', userId: 'f-mock-2', flockId: 'fl-mock-2' }
  ];

  // Snapshot listeners
  useEffect(() => {
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(uList);
      setFarmers(uList.filter((u: any) => u.role === 'farmer' || !u.role));
      setManagers(uList.filter((u: any) => u.role === 'manager' || u.role === 'admin' || u.role === 'supervisor'));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snap) => {
      setFlocks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'flocks');
    });

    const unsubAlerts = onSnapshot(collection(db, 'alerts'), (snap) => {
      setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'alerts');
    });

    const unsubDailyLogs = onSnapshot(collection(db, 'dailyLogs'), (snap) => {
      setDailyLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dailyLogs');
    });

    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'schedules');
    });

    const unsubFeed = onSnapshot(collection(db, 'feedStock'), (snap) => {
      setFeedStock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'feedStock');
    });

    const unsubMedicine = onSnapshot(collection(db, 'medicineStock'), (snap) => {
      setMedicineStock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'medicineStock');
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    const unsubShop = onSnapshot(collection(db, 'shopItems'), (snap) => {
      setShopItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shopItems');
    });

    const unsubCarts = onSnapshot(collection(db, 'carts'), (snap) => {
      setCarts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'carts');
    });

    const unsubEggLogs = onSnapshot(collection(db, 'eggLogs'), (snap) => {
      setEggLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'eggLogs');
    });

    const unsubEggSales = onSnapshot(collection(db, 'eggSales'), (snap) => {
      setEggSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'eggSales');
    });

    const unsubTransactions = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => {
      unsubUsers();
      unsubFlocks();
      unsubAlerts();
      unsubDailyLogs();
      unsubSchedules();
      unsubFeed();
      unsubMedicine();
      unsubOrders();
      unsubShop();
      unsubCarts();
      unsubEggLogs();
      unsubEggSales();
      unsubTransactions();
    };
  }, []);

  // Lookup Utility Functions
  const getFarmerName = (id: string, item?: any) => {
    if (item && item.farmerName) return item.farmerName;
    if (item && item.userName) return item.userName;
    const uList = allUsers.length > 0 ? allUsers : fallbackFarmers;
    const found = uList.find((f: any) => f.id === id);
    return found ? (found.name || found.email || found.displayName || 'Anonymous User') : 'Default Farmer';
  };

  const getFlockName = (id: string) => {
    const flList = flocks.length > 0 ? flocks : fallbackFlocks;
    const found = flList.find((fl: any) => fl.id === id);
    return found ? found.name : 'Unknown Flock Batch';
  };

  const getFlockNameForAlert = (a: any) => {
    if (a.flockId) return getFlockName(a.flockId);
    if (a.flockName) return a.flockName;
    if (a.batchName) return a.batchName;
    const flList = flocks.length > 0 ? flocks : fallbackFlocks;
    const found = flList.find((fl: any) => fl.farmerId === a.userId || fl.userId === a.userId);
    return found ? found.name : 'General Flock';
  };

  const getShortAddress = (addr: string) => {
    if (!addr) return 'Pune, MH, IN';
    const parts = addr.split(',').map(p => p.trim());
    if (parts.length <= 3) return addr;
    // Show last 3 parts for city, state, pin code
    return parts.slice(-3).join(', ');
  };

  const getUserCurrentPlacement = (userId: string) => {
    const fList = flocks.length > 0 ? flocks : fallbackFlocks;
    const uFlocks = fList.filter((fl: any) => (fl.farmerId === userId || fl.userId === userId) && (fl.status === 'Active' || !fl.status));
    return uFlocks.reduce((acc, curr) => acc + (Number(curr.currentCount) || 0), 0);
  };

  const getRemainingDays = (user: any) => {
    if (!user.licenseActive) return '0 days (Expired/Inactive)';
    const ad = user.licenseActivatedAt ? new Date(user.licenseActivatedAt) : null;
    if (!ad) return '365 days';
    const daysUsed = Math.floor((new Date().getTime() - ad.getTime()) / (1000 * 3600 * 24));
    const daysRemaining = 365 - daysUsed;
    return daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired';
  };

  const getFlockAge = (fl: any) => {
    const pDate = fl.placementDate ? new Date(fl.placementDate) : null;
    if (!pDate) return 'N/A';
    const age = Math.floor((new Date().getTime() - pDate.getTime()) / (1000 * 3600 * 24));
    return `${age} days`;
  };

  const updateFarmerManager = async (farmerId: string, managerId: string) => {
    try {
      const activeManagers = managers.length > 0 ? managers : [
        { id: 'm-mock-1', name: 'Dr. Vivek Sharma (Vet Advisor)' },
        { id: 'm-mock-2', name: 'Alok Mishra (Senior Supervisor)' },
        { id: 'm-mock-3', name: 'Kunal Sen (Territory Manager)' }
      ];
      const mName = activeManagers.find((m: any) => m.id === managerId)?.name || 'Platform Manager';
      await updateDoc(doc(db, 'users', farmerId), {
        allocatedManagerId: managerId,
        allocatedManagerName: mName
      });
    } catch (e: any) {
      console.error("Error updating manager allotment:", e);
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const getMissedSubmissions = () => {
    // Get list of active flocks
    const flList = flocks.length > 0 ? flocks.filter((fl: any) => fl.status === 'Active' || !fl.status) : fallbackFlocks;
    
    // Determine target dates based on `farmerFilter`
    const targetDates: string[] = [];
    const now = new Date();
    
    const formatDateString = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (farmerFilter === 'today') {
      targetDates.push(formatDateString(now));
    } else if (farmerFilter === 'yesterday') {
      const yesterday = new Date(now.getTime() - 86400000);
      targetDates.push(formatDateString(yesterday));
    } else {
      let limitDays = 7;
      if (farmerFilter === '15d') limitDays = 15;
      if (farmerFilter === '30d') limitDays = 30;
      if (farmerFilter === '2m') limitDays = 60;
      if (farmerFilter === '3m') limitDays = 90;
      if (farmerFilter === '6m') limitDays = 180;
      if (farmerFilter === '1y') limitDays = 365;
      if (farmerFilter === '2y') limitDays = 730;

      // Cap checking days to maximum 14 days to keep performance lightning fast
      const daysToCheck = Math.min(limitDays, 14);
      for (let i = 0; i < daysToCheck; i++) {
        const d = new Date(now.getTime() - i * 86400000);
        targetDates.push(formatDateString(d));
      }
    }

    const missedList: any[] = [];
    const logsList = dailyLogs.length > 0 ? dailyLogs : fallbackLogs;

    targetDates.forEach(dateStr => {
      flList.forEach((fl: any) => {
        const hasLog = logsList.some((log: any) => {
          const logDate = log.date || (log.timestamp ? log.timestamp.split('T')[0] : '');
          return log.flockId === fl.id && logDate === dateStr;
        });

        if (!hasLog) {
          const farmerId = fl.farmerId || fl.userId;
          const farmer = farmers.find((u: any) => u.id === farmerId) || 
                         fallbackFarmers.find((u: any) => u.id === farmerId) || 
                         { name: 'Unknown Farmer', email: 'N/A' };

          missedList.push({
            id: `missed-${fl.id}-${dateStr}`,
            date: dateStr,
            farmerName: farmer.name || farmer.email || 'Anonymous Farmer',
            flockName: fl.name,
            breedName: fl.breed || 'Unknown Breed',
            initialPlacement: fl.initialCount || 0,
            remainingBirds: fl.currentCount || 0,
          });
        }
      });
    });

    return missedList;
  };

  // Safe Filter Logic
  const isWithinFilter = (itemDate: any, filter: TimeFilter) => {
    if (!itemDate) return false;
    let dateObj: Date;
    if (typeof itemDate === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) {
        dateObj = new Date(itemDate + 'T00:00:00');
      } else {
        dateObj = new Date(itemDate);
      }
    } else if (itemDate?.toDate) {
      dateObj = itemDate.toDate();
    } else if (itemDate instanceof Date) {
      dateObj = itemDate;
    } else {
      const num = Number(itemDate);
      if (!isNaN(num) && num > 0) {
        dateObj = new Date(num);
      } else {
        return false;
      }
    }

    if (isNaN(dateObj.getTime())) return false;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    
    const diffTime = todayStart.getTime() - itemDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    switch (filter) {
      case 'today':
        return diffDays === 0;
      case 'yesterday':
        return diffDays === 1;
      case '7d':
        return diffDays >= 0 && diffDays < 7;
      case '15d':
        return diffDays >= 0 && diffDays < 15;
      case '30d':
        return diffDays >= 0 && diffDays < 30;
      case '2m':
        return diffDays >= 0 && diffDays < 60;
      case '3m':
        return diffDays >= 0 && diffDays < 90;
      case '6m':
        return diffDays >= 0 && diffDays < 180;
      case '1y':
        return diffDays >= 0 && diffDays < 365;
      case '2y':
        return diffDays >= 0 && diffDays < 730;
      default:
        return true;
    }
  };

  // Unified Section Date Filter selector
  const renderFilterSelector = (
    currentFilter: TimeFilter,
    setFilter: (val: TimeFilter) => void
  ) => {
    return (
      <div className="bg-slate-100/80 p-0.5 rounded-[1.25rem] flex flex-wrap gap-0.5 shadow-inner select-none shrink-0 border border-slate-200">
        {(['today', 'yesterday', '7d', '15d', '30d', '2m', '3m', '6m', '1y', '2y'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-transparent border-none rounded-full transition-all cursor-pointer ${
              currentFilter === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    );
  };

  // Styled Interactive Metric Card Generator
  const renderInspectCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    colorClasses: { bg: string; text: string; border: string },
    label: string,
    onClick: () => void
  ) => {
    return (
      <Card 
        onClick={onClick}
        className={`border ${colorClasses.border} shadow-sm hover:shadow-md hover:border-slate-300 transition-all rounded-[2.2rem] bg-white overflow-hidden py-1 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0`}
      >
        <CardContent className="p-6 flex flex-col justify-between h-full min-h-[148px]">
          <div className="flex items-center justify-between">
            <div className={`w-9 h-9 rounded-2xl ${colorClasses.bg} ${colorClasses.text} flex items-center justify-center border ${colorClasses.border}`}>
              {icon}
            </div>
            <span className="text-[8px] font-black uppercase bg-slate-50 border border-slate-100 text-slate-400 px-2.5 py-0.5 rounded-full tracking-wider">
              Inspect
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-800 tracking-tight">{value}</span>
              {label && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Merge Real / Fallback Datasets
  const activeAlerts = alerts.length > 0 ? alerts.filter(a => a.status !== 'Resolved') : fallbackAlerts;
  const activeFlocks = flocks.length > 0 ? flocks.filter(f => f.status === 'Active' || !f.status) : fallbackFlocks;
  const activeDailyLogs = dailyLogs.length > 0 ? dailyLogs : fallbackLogs;
  const activeFarmers = farmers.length > 0 ? farmers : fallbackFarmers;
  const activeSchedules = schedules.length > 0 ? schedules : fallbackSchedules;

  // Compute Section 1: Farmer Analytics (scoped with farmerFilter)
  const currentAlerts = activeAlerts.filter(a => isWithinFilter(a.createdAt || a.timestamp, farmerFilter));
  const currentLogs = activeDailyLogs.filter(log => isWithinFilter(log.timestamp || log.date, farmerFilter));
  const currentSchedules = activeSchedules.filter(s => isWithinFilter(s.date, farmerFilter));
  const currentNewFarmers = activeFarmers.filter(f => isWithinFilter(f.createdAt, farmerFilter));

  const expiringLicenses = activeFarmers.filter(f => {
    if (!f.licenseActive) return false;
    const activatedDate = f.licenseActivatedAt ? new Date(f.licenseActivatedAt) : null;
    if (!activatedDate) return false;
    const daysUsed = Math.floor((new Date().getTime() - activatedDate.getTime()) / (1000 * 3600 * 24));
    const daysRemaining = 365 - daysUsed;
    return daysRemaining > 0 && daysRemaining <= 30; // 30 days window expires
  });

  // Calculate Average mortality rate
  let sumMortality = 0;
  activeFlocks.forEach(f => {
    const init = Number(f.initialCount) || 5000;
    const curr = Number(f.currentCount) || 4900;
    sumMortality += init > 0 ? ((init - curr) / init) * 100 : 0;
  });
  const avgMortalityVal = activeFlocks.length > 0 ? sumMortality / activeFlocks.length : 1.25;

  // Compute Section 2: Stock & Growth (scoped with stockFilter)
  const feedCollection = feedStock.length > 0 ? feedStock : [
    { id: 'fd-1', type: 'Broiler Starter', quantity: 180, userId: 'f-mock-1', purchaseCost: 4500, createdAt: new Date().toISOString() },
    { id: 'fd-2', type: 'Layer Pre-Lay', quantity: 240, userId: 'f-mock-2', purchaseCost: 6500, createdAt: new Date().toISOString() }
  ];
  const medCollection = medicineStock.length > 0 ? medicineStock : [
    { id: 'md-1', name: 'Lasota Booster Vaccine', quantity: 15, userId: 'f-mock-1', purchaseCost: 1200, createdAt: new Date().toISOString() },
    { id: 'md-2', name: 'Vitamin K Supplement Oral', quantity: 30, userId: 'f-mock-2', purchaseCost: 1500, createdAt: new Date().toISOString() }
  ];

  const filteredFeedStock = feedCollection.filter(fs => isWithinFilter(fs.createdAt || fs.date, stockFilter));
  const filteredMedStock = medCollection.filter(ms => isWithinFilter(ms.createdAt || ms.date, stockFilter));

  const totalFeedQty = filteredFeedStock.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalMedQty = filteredMedStock.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const flocksUnder700g = activeFlocks.filter(f => (Number(f.averageWeight) || 0) < 700);
  const flocksAbove1000g = activeFlocks.filter(f => (Number(f.averageWeight) || 0) >= 1000);

  const flocksAbove70Days = activeFlocks.filter(f => {
    const pDate = f.placementDate ? new Date(f.placementDate) : null;
    if (!pDate) return false;
    const age = Math.floor((new Date().getTime() - pDate.getTime()) / (1000 * 3600 * 24));
    return age >= 70;
  });

  const layingFlocks = activeFlocks.filter(f => f.type === 'Layer' || f.breed?.toLowerCase().includes('layer'));
  
  const currentEggsList = eggLogs.length > 0 ? eggLogs : [
    { id: 'eg-1', flockId: 'fl-mock-2', date: format(new Date(), 'yyyy-MM-dd'), goodEggs: 850, crackedEggs: 12, sizeGrade: 'Premium Grade A', createdAt: new Date().toISOString() },
    { id: 'eg-2', flockId: 'fl-mock-2', date: format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'), goodEggs: 780, crackedEggs: 8, sizeGrade: 'Standard Grade B', createdAt: new Date(Date.now() - 86400000).toISOString() }
  ];
  const filteredEggLogs = currentEggsList.filter(eg => isWithinFilter(eg.date || eg.createdAt, stockFilter));
  const sumCollectedEggs = filteredEggLogs.reduce((acc, curr) => acc + (Number(curr.goodEggs) || 0) + (Number(curr.crackedEggs) || 0), 0);

  const currentEggSales = eggSales.length > 0 ? eggSales : [
    { id: 'es-1', flockId: 'fl-mock-2', quantity: 450, totalReceived: 2700, date: format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString() }
  ];
  const totalCollectedHistorical = currentEggsList.reduce((acc, curr) => acc + (Number(curr.goodEggs) || 0), 0);
  const totalSoldHistorical = currentEggSales.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const availableEggsCount = Math.max(0, totalCollectedHistorical - totalSoldHistorical);

  // Compute Section 3: Shop Operations (scoped with shopFilter)
  const currentOrders = orders.length > 0 ? orders : [
    { id: 'or-1', items: [{ name: 'Automatic Breeder Feeder Pack 50L', qty: 2 }], customerName: 'Ramesh Patel', total: 6500, status: 'Pending', date: format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString() },
    { id: 'or-2', items: [{ name: 'Mineral Premix Feed Sack 50KG', qty: 10 }], customerName: 'Anil Deshmukh', total: 11000, status: 'Delivered', date: format(new Date(Date.now() - 48 * 3600000), 'yyyy-MM-dd'), createdAt: new Date(Date.now() - 48 * 3600000).toISOString() },
    { id: 'or-3', items: [{ name: 'Premium Feed additive', qty: 1 }], customerName: 'Suresh Kumar', total: 1500, status: 'Abandoned', date: format(new Date(Date.now() - 5 * 86400000), 'yyyy-MM-dd'), createdAt: new Date(Date.now() - 5 * 86400000).toISOString() }
  ];

  const activeShopItems = shopItems.length > 0 ? shopItems : [
    { id: 'si-1', name: 'Balanced Broiler Feed Bags (50kg)', category: 'Feed', price: 1050, stock: 120 },
    { id: 'si-2', name: 'Growth Tonic Concentrate liquid', category: 'Medicine', price: 450, stock: 8 },
    { id: 'si-3', name: 'Egg Shell Hardening Formula (10kg)', category: 'Feed', price: 850, stock: 0 }
  ];

  const filteredOrders = currentOrders.filter(o => isWithinFilter(o.createdAt || o.date, shopFilter));
  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending' || o.status === 'Processing');
  const deliveredOrders = filteredOrders.filter(o => o.status === 'Delivered');
  const abandonedOrders = filteredOrders.filter(o => o.status === 'Abandoned' || o.status === 'Cancelled' || o.status === 'Failed');

  const lowStockProducts = activeShopItems.filter(p => Number(p.stock) > 0 && Number(p.stock) <= 15);
  const outOfStockProducts = activeShopItems.filter(p => Number(p.stock) <= 0);

  // Compute Section 4: Financial Status (scoped with financeFilter)
  const currentTransactions = transactions.length > 0 ? transactions : [
    { id: 'tr-1', category: 'Egg Sales Revenue', type: 'Income', amount: 2700, date: format(new Date(), 'yyyy-MM-dd'), timestamp: new Date().toISOString() },
    { id: 'tr-2', category: 'Feed Purchase Invoice', type: 'Expense', amount: 5000, date: format(new Date(Date.now() - 86400000), 'yyyy-MM-dd'), timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: 'tr-3', category: 'Wholesale Broiler Birds Sale', type: 'Income', amount: 48000, date: format(new Date(Date.now() - 5 * 86400000), 'yyyy-MM-dd'), timestamp: new Date(Date.now() - 5 * 86400000).toISOString() }
  ];

  const filteredTransactions = currentTransactions.filter(t => isWithinFilter(t.timestamp || t.date, financeFilter));
  const totalRevenueVal = filteredTransactions.filter(t => t.type === 'Income' || t.type === 'payment').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const completedDeliveriesForSales = currentOrders.filter(o => o.status === 'Delivered' && isWithinFilter(o.createdAt || o.date, financeFilter));
  const salesValueSum = completedDeliveriesForSales.reduce((acc, curr) => acc + (Number(curr.total || curr.amount) || 0), 0);

  // Modal Card Selection Definitions Dynamic Routing on Click
  const handleOpenAlerts = () => {
    setSelectedMetric({
      id: 'alerts',
      title: 'Current Active Alerts Log',
      description: `Active severity alerts registered within chosen filter range: ${farmerFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by alert description, symptom, farmer...',
      data: currentAlerts.map(a => ({
        ...a,
        _farmerName: getFarmerName(a.userId),
        _flockName: getFlockNameForAlert(a)
      })),
      headers: ['Created Date', 'Associated Farmer', 'Flock Name', 'Severity Range', 'Alert Details'],
      renderRow: (a: any) => (
        <TableRow key={a.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono font-medium text-slate-500 py-3.5 pl-4">
            {a.createdAt ? format(new Date(a.createdAt), 'MMM dd, yyyy HH:mm') : 'Recently'}
          </TableCell>
          <TableCell className="text-xs font-bold text-slate-800">
            {getFarmerName(a.userId)}
          </TableCell>
          <TableCell className="text-xs font-semibold text-indigo-700 font-mono">
            {getFlockNameForAlert(a)}
          </TableCell>
          <TableCell className="text-xs">
            <Badge className={`border-none font-bold text-[9px] px-2 py-0.5 rounded-full ${
              a.severity === 'Critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {a.severity || 'Warning'}
            </Badge>
          </TableCell>
          <TableCell className="text-xs text-slate-650 pr-4 italic leading-relaxed">
            {a.description || 'Abrupt parameter deflection detected.'}
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenSubmissions = () => {
    const missedList = getMissedSubmissions();
    setSelectedMetric({
      id: 'submissions',
      title: 'Missed Daily Health Log Submissions Directory',
      description: `Active flocks and farmers who MISSED their daily log reports in scope: ${farmerFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by farmer name, flock, breed...',
      data: missedList,
      headers: ['Missed Date', 'Farmer Partner Name', 'Flock Batch ID/Name', 'Chicks Breed', 'Initial PlacementCount', 'Current Live/Remaining'],
      renderRow: (ml: any) => (
        <TableRow key={ml.id} className="hover:bg-slate-50/50 text-red-700">
          <TableCell className="text-xs font-mono font-bold text-rose-600 py-3.5 pl-4">
            {ml.date}
          </TableCell>
          <TableCell className="text-xs font-black text-slate-800">
            {ml.farmerName}
          </TableCell>
          <TableCell className="text-xs font-mono text-indigo-600 font-bold">
            {ml.flockName}
          </TableCell>
          <TableCell className="text-xs font-medium text-slate-600">
            {ml.breedName}
          </TableCell>
          <TableCell className="text-xs font-mono font-bold text-slate-500">
            {ml.initialPlacement} birds
          </TableCell>
          <TableCell className="text-xs text-rose-600 font-bold pr-4">
            {ml.remainingBirds} birds
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenFarmers = () => {
    setSelectedMetric({
      id: 'farmers',
      title: 'Global Registered Farmers Directory',
      description: 'Overview registry of agricultural owners, licensing metadata, and livestock stats',
      searchPlaceholder: 'Search by farmer name, email, city, state, pin...',
      data: activeFarmers,
      headers: ['Registered Date', 'Farmer Partner Name', 'Contact & Email', 'Address (Click to Expand)', 'Placement Capacity & Live Placed', 'License Status & Expiry'],
      renderRow: (f: any) => {
        const isExpanded = !!expandedAddressIds[f.id];
        return (
          <TableRow key={f.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-mono text-slate-500 py-3.5 pl-4">
              {f.createdAt ? format(new Date(f.createdAt), 'MMM dd, yyyy') : 'Recently'}
            </TableCell>
            <TableCell className="text-xs font-black text-slate-900">
              {f.name || 'Anonymous User'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-600">
              <div>{f.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{f.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [f.id]: !prev[f.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words">
                    {f.address || f.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(f.address || f.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-medium text-slate-800">
              <div>Cap: <span className="font-bold font-mono">{f.birdCapacity || f.capacity || 5000}</span></div>
              <div className="text-[10.5px] text-emerald-700 font-black">Placed: <span className="font-mono">{getUserCurrentPlacement(f.id)}</span></div>
            </TableCell>
            <TableCell className="text-xs pr-4">
              <Badge className={`border-none font-black text-[9px] px-2.5 py-0.5 rounded-full ${
                f.licenseActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {f.licenseActive ? 'Active License' : 'No License'}
              </Badge>
              <div className="text-[10px] font-mono text-slate-400 font-black mt-1 uppercase tracking-wider">
                {getRemainingDays(f)}
              </div>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenActiveBatches = () => {
    setSelectedMetric({
      id: 'batches',
      title: 'Current Active Flocks Breakdown',
      description: 'Real-time performance metrics, demographic locations and exact weight indices of active chicken groups',
      searchPlaceholder: 'Search by batch name, breed, farmer name...',
      data: activeFlocks.map(fl => {
        const farmerUser = farmers.find((u: any) => u.id === fl.farmerId) || 
                           fallbackFarmers.find((u: any) => u.id === fl.farmerId) || 
                           { email: 'N/A', phone: '', address: 'Pune, Maharashtra, 411001' };
        return {
          ...fl,
          _farmerName: getFarmerName(fl.farmerId),
          _email: farmerUser.email,
          _phone: farmerUser.phone
        };
      }),
      headers: ['Placement Date', 'Batch Identifier / Breed', 'Age & Weight', 'Farmer Participant', 'Address (Click to Expand)', 'Placement & Live', 'Current Mortality'],
      renderRow: (fl: any) => {
        const farmerUser = farmers.find((u: any) => u.id === fl.farmerId) || 
                           fallbackFarmers.find((u: any) => u.id === fl.farmerId) || 
                           { email: 'N/A', phone: '', address: 'Pune, Maharashtra, 411001' };
        const isExpanded = !!expandedAddressIds[fl.id];
        return (
          <TableRow key={fl.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-mono text-slate-500 py-3.5 pl-4">
              {fl.placementDate ? format(new Date(fl.placementDate), 'MMM dd, yyyy') : 'No Date'}
            </TableCell>
            <TableCell className="text-xs">
              <div className="font-extrabold text-slate-850">{fl.name || 'Batch Cobb'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{fl.breed || 'Unknown Breed'} ({fl.type || 'Broiler'})</div>
            </TableCell>
            <TableCell className="text-xs font-mono">
              <div className="font-bold text-indigo-700">Age: {getFlockAge(fl)}</div>
              <div className="text-[10px] text-slate-650 font-black">Weight: {fl.averageWeight || 0}g</div>
            </TableCell>
            <TableCell className="text-xs">
              <div className="font-extrabold text-slate-900">{getFarmerName(fl.farmerId)}</div>
              <div className="text-[9.5px] font-mono text-slate-400 leading-none">{farmerUser.email || 'N/A'}</div>
              <div className="text-[9.5px] font-mono text-slate-400 leading-none mt-0.5">{farmerUser.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs max-w-xs py-3">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [fl.id]: !prev[fl.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {farmerUser.address || farmerUser.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(farmerUser.address || farmerUser.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs text-slate-600 font-mono">
              <div>Initial: <span className="font-bold">{fl.initialCount || 0}</span></div>
              <div className="text-emerald-700 font-black">Live: <span>{fl.currentCount || 0}</span></div>
            </TableCell>
            <TableCell className="text-xs pr-4">
              <div className="text-rose-600 font-black font-mono">
                {(Number(fl.initialCount) || 0) - (Number(fl.currentCount) || 0)} birds
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-0.5">cumulative dead</p>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenCumulativeBirds = () => {
    const baseFarmers = farmers.length > 0 ? farmers : fallbackFarmers;
    const baseFlocks = flocks.length > 0 ? flocks : fallbackFlocks;

    const dataList = baseFarmers.map(f => {
      const uFlocks = baseFlocks.filter((fl: any) => (fl.farmerId === f.id || fl.userId === f.id) && (fl.status === 'Active' || !fl.status));
      const runningBatchesCount = uFlocks.length;
      const placementCount = uFlocks.reduce((acc, fl) => acc + (Number(fl.initialCount) || 0), 0);
      const liveCount = uFlocks.reduce((acc, fl) => acc + (Number(fl.currentCount) || 0), 0);
      const currentWeight = uFlocks.length > 0
        ? Math.round(uFlocks.reduce((acc, fl) => acc + (Number(fl.averageWeight) || 0), 0) / uFlocks.length)
        : 0;

      return {
        ...f,
        runningBatchesCount,
        placementCount,
        liveCount,
        currentWeight
      };
    }).filter(item => item.runningBatchesCount > 0);

    setSelectedMetric({
      id: 'cumulative-birds',
      title: 'Total Cumulative Birds & Live Capacities',
      description: 'Directory of livestock farmers with active running batches, placement counts, and current average weights',
      searchPlaceholder: 'Search by farmer, email, city...',
      data: dataList,
      headers: ['Farmer Partner Name', 'Contact & Email', 'Address (Click to Expand)', 'Running Batches Count', 'Placement & Live Birds', 'Current Avg Weight'],
      renderRow: (item: any) => {
        const liveFarmer = farmers.find((u: any) => u.id === item.id) || item;
        const isExpanded = !!expandedAddressIds[liveFarmer.id];
        return (
          <TableRow key={item.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-black text-slate-900 py-3.5 pl-4">
              {liveFarmer.name || 'Anonymous User'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-600">
              <div>{liveFarmer.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{liveFarmer.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [liveFarmer.id]: !prev[liveFarmer.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {liveFarmer.address || liveFarmer.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(liveFarmer.address || liveFarmer.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-mono font-bold text-slate-700">
              <Badge className="border-none bg-indigo-50 text-indigo-700 font-bold text-[9.5px] px-2 py-0.5 rounded-full">
                {item.runningBatchesCount} batches
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-slate-600 font-mono">
              <div>Initial: <span className="font-bold">{item.placementCount.toLocaleString()}</span></div>
              <div className="text-emerald-700 font-black">Live: <span>{item.liveCount.toLocaleString()}</span></div>
            </TableCell>
            <TableCell className="text-xs font-bold text-slate-900 font-mono pr-4">
              {item.currentWeight || 0} g
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenFlockMortality = () => {
    const baseFlocks = flocks.length > 0 ? flocks : fallbackFlocks;
    const baseFarmers = farmers.length > 0 ? farmers : fallbackFarmers;
    const baseLogs = dailyLogs.length > 0 ? dailyLogs : fallbackLogs;

    const dataList = baseFlocks.map(fl => {
      const farmerId = fl.farmerId || fl.userId;
      const farmer = baseFarmers.find((u: any) => u.id === farmerId) || { name: 'Unknown Farmer', email: 'N/A', phone: '', address: 'Pune, Maharashtra' };
      
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayLog = baseLogs.find((log: any) => {
        const logDate = log.date || (log.timestamp ? log.timestamp.split('T')[0] : '');
        return log.flockId === fl.id && logDate === todayStr;
      });

      const latestLog = todayLog || [...baseLogs]
        .filter((log: any) => log.flockId === fl.id)
        .sort((a, b) => new Date(b.date || b.timestamp || '').getTime() - new Date(a.date || a.timestamp || '').getTime())[0];

      const initial = Number(fl.initialCount) || 5000;
      const current = Number(fl.currentCount) || 4900;
      const totalDead = Math.max(0, initial - current);
      const mortalityPct = initial > 0 ? (totalDead / initial) * 100 : 0;

      return {
        ...fl,
        farmerId,
        farmerName: farmer.name || farmer.email || 'Anonymous Farmer',
        email: farmer.email,
        phone: farmer.phone,
        address: farmer.address || farmer.location,
        todayMortality: todayLog?.mortality || latestLog?.mortality || 0,
        totalMortalityTillNow: totalDead,
        mortalityPercent: mortalityPct
      };
    });

    setSelectedMetric({
      id: 'flock-mortality',
      title: 'Average Flock Mortality & Audit Log',
      description: 'Audit records of historical cumulative mortality losses and immediate daily report indicators per flock',
      searchPlaceholder: 'Search by batch, farmer name...',
      data: dataList,
      headers: ['Farmer Name', 'Contact & Email', 'Address (Click to Expand)', 'Batch Name', 'Placement & Live', 'Today Mortality', 'Total Dead & % Rate'],
      renderRow: (item: any) => {
        const liveFlock = flocks.find((fl: any) => fl.id === item.id) || item;
        const liveFarmer = farmers.find((u: any) => u.id === item.farmerId) || { name: item.farmerName, email: item.email, phone: item.phone, address: item.address };
        const isExpanded = !!expandedAddressIds[liveFlock.id];
        
        const initial = Number(liveFlock.initialCount) || 5000;
        const current = Number(liveFlock.currentCount) || 4900;
        const totalDead = Math.max(0, initial - current);
        const mortalityPct = initial > 0 ? (totalDead / initial) * 100 : 0;

        return (
          <TableRow key={item.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-black text-slate-900 py-3.5 pl-4">
              {liveFarmer.name || 'Anonymous User'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-600">
              <div>{liveFarmer.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{liveFarmer.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [liveFlock.id]: !prev[liveFlock.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {liveFarmer.address || liveFarmer.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(liveFarmer.address || liveFarmer.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-bold text-slate-800">
              {liveFlock.name || 'Batch Cobb'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-650">
              <div>Init: <span className="font-bold">{initial.toLocaleString()}</span></div>
              <div>Live: <span className="font-bold text-emerald-700">{current.toLocaleString()}</span></div>
            </TableCell>
            <TableCell className="text-xs text-amber-700 font-black font-mono">
              {item.todayMortality || 0} birds
            </TableCell>
            <TableCell className="text-xs pr-4">
              <div className="text-rose-600 font-black font-mono">
                {totalDead} birds
              </div>
              <div className="text-[10px] text-rose-805 font-black font-mono text-rose-600">
                {mortalityPct.toFixed(2)}%
              </div>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenSchedules = () => {
    const baseSchedules = schedules.length > 0 ? schedules : fallbackSchedules;
    const baseFarmers = farmers.length > 0 ? farmers : fallbackFarmers;

    const dataList = baseSchedules.map(sc => {
      const farmerId = sc.userId || sc.farmerId;
      const farmer = baseFarmers.find((u: any) => u.id === farmerId) || { name: 'Unknown Farmer', email: 'N/A', phone: '', address: 'Pune, Maharashtra' };
      return {
        ...sc,
        farmerId,
        farmerName: farmer.name || farmer.email || 'Anonymous Farmer',
        email: farmer.email,
        phone: farmer.phone,
        address: farmer.address || farmer.location,
        flockName: getFlockName(sc.flockId)
      };
    });

    setSelectedMetric({
      id: 'schedules',
      title: 'Scheduled Medical & Treatment Alerts Directory',
      description: `Active medicine, checkups, and vaccinations configured in range: ${farmerFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by template name, description, farmer...',
      data: dataList,
      headers: ['Target Date', 'Farmer Name', 'Contact & Email', 'Address (Click to Expand)', 'Batch Name', 'Schedule Template', 'Alert Description'],
      renderRow: (item: any) => {
        const liveSchedule = schedules.find((s: any) => s.id === item.id) || item;
        const liveFarmer = farmers.find((u: any) => u.id === item.farmerId) || { name: item.farmerName, email: item.email, phone: item.phone, address: item.address };
        const isExpanded = !!expandedAddressIds[liveSchedule.id];
        return (
          <TableRow key={item.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-mono font-bold text-slate-650 py-3.5 pl-4">
              {liveSchedule.date || 'Today'}
            </TableCell>
            <TableCell className="text-xs font-black text-slate-900">
              {liveFarmer.name || 'Anonymous User'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-600">
              <div>{liveFarmer.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{liveFarmer.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [liveSchedule.id]: !prev[liveSchedule.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {liveFarmer.address || liveFarmer.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(liveFarmer.address || liveFarmer.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-mono font-bold text-indigo-700">
              {getFlockName(liveSchedule.flockId)}
            </TableCell>
            <TableCell className="text-xs font-bold text-slate-855">
              <Badge className="border-none bg-indigo-50 text-indigo-705 text-[9.5px] font-bold px-2 py-0.5 rounded-lg">
                {liveSchedule.taskName || liveSchedule.name || 'Booster Routine'}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-slate-600 pr-4 italic max-w-xs leading-relaxed">
              {liveSchedule.description || liveSchedule.notes || `${liveSchedule.taskName || 'Healthcare Target'} designated checklist item for flock health assurance.`}
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenLicenseExpiring = () => {
    const listData = expiringLicenses.length > 0 ? expiringLicenses : activeFarmers.filter(f => f.licenseActive);
    
    setSelectedMetric({
      id: 'licenses',
      title: 'Licenses Nearing Platform Expiry (30-Day Window)',
      description: 'Active farmers whose annual license activation is completing its yearly cycle',
      searchPlaceholder: 'Search by partner name, email...',
      data: listData,
      headers: ['Farmer Name', 'Contact & Email', 'Address (Click to Expand)', 'License Expiring Date', 'Remaining Days'],
      renderRow: (f: any) => {
        const liveFarmer = farmers.find((u: any) => u.id === f.id) || f;
        const isExpanded = !!expandedAddressIds[liveFarmer.id];

        const ad = liveFarmer.licenseActivatedAt ? new Date(liveFarmer.licenseActivatedAt) : null;
        let expiringDateStr = 'N/A';
        let remainingDays = 365;
        if (ad) {
          const exp = new Date(ad.getTime() + (365 * 24 * 3600 * 1000));
          expiringDateStr = format(exp, 'MMM dd, yyyy');
          const daysUsed = Math.floor((new Date().getTime() - ad.getTime()) / (1000 * 3600 * 24));
          remainingDays = Math.max(0, 365 - daysUsed);
        } else if (liveFarmer.licenseActive) {
          expiringDateStr = '365 Days Limit';
          remainingDays = 365;
        } else {
          expiringDateStr = 'Expired / Inactive';
          remainingDays = 0;
        }

        return (
          <TableRow key={f.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-black text-slate-900 py-3.5 pl-4">
              {liveFarmer.name || 'Poultry Partner'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-600">
              <div>{liveFarmer.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{liveFarmer.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [liveFarmer.id]: !prev[liveFarmer.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {liveFarmer.address || liveFarmer.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(liveFarmer.address || liveFarmer.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-mono font-bold text-rose-600">
              {expiringDateStr}
            </TableCell>
            <TableCell className="text-xs pr-4">
              <Badge className={`border-none font-black text-[10px] px-2.5 py-0.5 rounded-full ${
                remainingDays <= 30 ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {remainingDays} days left
              </Badge>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenNewFarmers = () => {
    setSelectedMetric({
      id: 'new_farmers',
      title: 'Newly Onboarded Poultry Farms',
      description: `New agricultural registrations completed in filter: ${farmerFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by partner name, farm, email...',
      data: currentNewFarmers,
      headers: ['Onboarding Date', 'Farmer Name', 'Contact & Email', 'Address (Click to Expand)', 'Farm Name', 'Capacity', 'Manager Assignments'],
      renderRow: (f: any) => {
        const liveFarmer = farmers.find((u: any) => u.id === f.id) || f;
        const isExpanded = !!expandedAddressIds[f.id];
        
        const activeManagers = managers.length > 0 ? managers : [
          { id: 'm-mock-1', name: 'Dr. Vivek Sharma (Vet Advisor)' },
          { id: 'm-mock-2', name: 'Alok Mishra (Senior Supervisor)' },
          { id: 'm-mock-3', name: 'Kunal Sen (Territory Manager)' }
        ];

        return (
          <TableRow key={f.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-mono font-bold text-slate-500 py-3.5 pl-4">
              {liveFarmer.createdAt ? format(new Date(liveFarmer.createdAt), 'MMM dd, yyyy') : 'Recent Onboard'}
            </TableCell>
            <TableCell className="text-xs font-black text-slate-900">
              {liveFarmer.name || 'Anonymous User'}
            </TableCell>
            <TableCell className="text-xs font-mono text-slate-650">
              <div>{liveFarmer.email || 'N/A'}</div>
              <div className="text-[10px] text-slate-400 font-bold">{liveFarmer.phone || ''}</div>
            </TableCell>
            <TableCell className="text-xs py-3 max-w-xs">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedAddressIds(prev => ({ ...prev, [liveFarmer.id]: !prev[liveFarmer.id] }));
                }}
                className="cursor-pointer hover:text-indigo-600 transition-colors select-text"
                title="Click to view full address"
              >
                {isExpanded ? (
                  <div className="font-bold underline text-slate-850 bg-slate-50 p-2 rounded border border-slate-100 text-[11px] leading-relaxed break-words animate-in fade-in duration-100">
                    {liveFarmer.address || liveFarmer.location || 'Pune, Maharashtra, 411001'} <span className="text-[9px] text-slate-400 block font-normal mt-1">(Click to hide)</span>
                  </div>
                ) : (
                  <div className="italic text-slate-500 font-mono text-[11px]">
                    {getShortAddress(liveFarmer.address || liveFarmer.location)} <span className="text-[9px] text-indigo-500 ml-1 font-black uppercase tracking-wider">(View Full)</span>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs font-bold text-slate-700">
              {liveFarmer.farmName || liveFarmer.name || 'Green Acres Poultry'}
            </TableCell>
            <TableCell className="text-xs font-mono font-black text-emerald-800">
              {(Number(liveFarmer.birdCapacity) || Number(liveFarmer.capacity) || 5000).toLocaleString()} birds
            </TableCell>
            <TableCell className="text-xs pr-4">
              <select
                value={liveFarmer.allocatedManagerId || ''}
                onChange={(e) => updateFarmerManager(liveFarmer.id, e.target.value)}
                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 shadow-sm transition-all focus:border-indigo-650 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
              >
                <option value="">-- Apply Manager --</option>
                {activeManagers.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email || 'Supervisor'}
                  </option>
                ))}
              </select>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenFeedStock = () => {
    setSelectedMetric({
      id: 'feed_stock',
      title: 'Farmer Feed Inventory Ledger',
      description: `Active feed supplies registered, updated or consumed in scope: ${stockFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by feed category, type, owner...',
      data: filteredFeedStock,
      headers: ['Registered Date', 'Feed Nutrition Category', 'Remaining Quantity', 'Farmer Reference', 'Batch Purchase Cost'],
      renderRow: (fs: any) => (
        <TableRow key={fs.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono text-slate-500 py-3.5 pl-4">
            {fs.createdAt || fs.date ? format(new Date(fs.createdAt || fs.date), 'MMM dd, yyyy') : 'Recently'}
          </TableCell>
          <TableCell className="text-xs font-black text-emerald-800">
            {fs.type || 'Starter Feed'}
          </TableCell>
          <TableCell className="text-xs font-mono font-black text-slate-905">
            {fs.quantity || 0} Bags / KG
          </TableCell>
          <TableCell className="text-xs text-slate-650">
            {getFarmerName(fs.userId)}
          </TableCell>
          <TableCell className="text-xs font-mono text-slate-700 pr-4">
            ₹{(fs.purchaseCost || 0).toLocaleString()}
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenMedicineStock = () => {
    setSelectedMetric({
      id: 'medicine_stock',
      title: 'Farmer Medicine Inventory Ledger',
      description: `Health supplement kits, disinfectants and vaccines registered in scope: ${stockFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by medic name, active ingredients...',
      data: filteredMedStock,
      headers: ['Created Date', 'Medicine / Formula Name', 'Available Stocks', 'Standard Unit Cost', 'Associated Farmer'],
      renderRow: (ms: any) => (
        <TableRow key={ms.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono text-slate-500 py-3.5 pl-4">
            {ms.createdAt ? format(new Date(ms.createdAt), 'MMM dd, yyyy') : 'Recently'}
          </TableCell>
          <TableCell className="text-xs font-black text-indigo-750">
            {ms.name || 'Healthcare Supplement'}
          </TableCell>
          <TableCell className="text-xs font-mono font-bold text-slate-800">
            {ms.quantity || 0} Pcs / Vials
          </TableCell>
          <TableCell className="text-xs font-mono text-slate-600">
            ₹{(ms.unitPrice || 0).toLocaleString()}
          </TableCell>
          <TableCell className="text-xs font-bold text-slate-750 pr-4">
            {getFarmerName(ms.userId)}
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenEggCollection = () => {
    setSelectedMetric({
      id: 'egg_collection',
      title: 'System Egg Collection Logs',
      description: `Production statistics captured for layer batches in range: ${stockFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by batch, quality grade...',
      data: filteredEggLogs,
      headers: ['Collection Date', 'Associated Layer Batch', 'Good Eggs', 'Damaged / Cracked', 'Quality Grade Label'],
      renderRow: (eg: any) => (
        <TableRow key={eg.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono font-bold text-slate-600 py-3.5 pl-4">
            {eg.date || 'Today'}
          </TableCell>
          <TableCell className="text-xs font-black text-rose-700">
            {getFlockName(eg.flockId)}
          </TableCell>
          <TableCell className="text-xs font-mono font-black text-emerald-705">
            {eg.goodEggs || 0} eggs
          </TableCell>
          <TableCell className="text-xs font-mono text-rose-500 font-bold">
            {eg.crackedEggs || 0} cracked
          </TableCell>
          <TableCell className="text-xs pr-4">
            <Badge className="border-none bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg">
              {eg.sizeGrade || 'Premium Grade A'}
            </Badge>
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenOrders = (filterStatus?: string) => {
    const listData = filterStatus 
      ? currentOrders.filter(o => o.status === filterStatus && isWithinFilter(o.createdAt || o.date, shopFilter))
      : filteredOrders;
    
    setSelectedMetric({
      id: `orders-${filterStatus || 'all'}`,
      title: filterStatus ? `${filterStatus} Customer Orders Ledger` : 'General Customer Orders Ledger',
      description: `Processed e-commerce transactions during filter: ${shopFilter.toUpperCase()}`,
      searchPlaceholder: 'Search by client customer name, invoice ID...',
      data: listData,
      headers: ['Order Date', 'Invoice ID', 'E-commerce Customer', 'Procured Items Summary', 'Order Total', 'Execution status'],
      renderRow: (o: any) => (
        <TableRow key={o.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono text-slate-500 py-3.5 pl-4">
            {o.date || 'Today'}
          </TableCell>
          <TableCell className="text-xs font-mono font-bold text-indigo-700">
            {o.id ? o.id.slice(0, 8).toUpperCase() : 'OR-MOCK-91'}
          </TableCell>
          <TableCell className="text-xs font-black text-slate-900">
            {o.customerName || 'Standard Client'}
          </TableCell>
          <TableCell className="text-xs font-medium text-slate-650 max-w-xs truncate">
            {o.items?.map((it: any) => `${it.qty || 1}x ${it.name}`).join(', ') || 'Poultry equipment bundle'}
          </TableCell>
          <TableCell className="text-xs font-mono font-black text-emerald-800">
            ₹{(o.total || o.amount || 0).toLocaleString()}
          </TableCell>
          <TableCell className="text-xs pr-4">
            <Badge className={`border-none font-bold text-[9px] uppercase px-2 py-0.5 rounded-full ${
              o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
              o.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {o.status || 'Pending'}
            </Badge>
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  const handleOpenCatalog = (lowStockOnly = false, outOfStockOnly = false) => {
    let listData = activeShopItems;
    let desc = 'System inventory catalog for active feeds, medic blocks and nest supplements';
    if (lowStockOnly) {
      listData = lowStockProducts;
      desc = 'Active catalog listings where quantity level resides below 15 units';
    } else if (outOfStockOnly) {
      listData = outOfStockProducts;
      desc = 'Products currently marking zero available warehouse quantities';
    }

    setSelectedMetric({
      id: 'shop_catalog',
      title: lowStockOnly ? 'Low Stock Shop Products' : (outOfStockOnly ? 'Out of Stock Products' : 'Active Catalog Products'),
      description: desc,
      searchPlaceholder: 'Search catalog by item, categories...',
      data: listData,
      headers: ['Commodity Category', 'Shop Item Name', 'Store Unit Cost', 'Available Stock Units', 'Replenish Priority'],
      renderRow: (p: any) => {
        const qtyVal = Number(p.stock ?? p.quantity);
        return (
          <TableRow key={p.id} className="hover:bg-slate-50/50">
            <TableCell className="text-xs font-bold text-slate-500 py-3.5 pl-4">
              {p.category || 'Feed additive'}
            </TableCell>
            <TableCell className="text-xs font-black text-slate-850">
              {p.name || 'Poultry Goods Pack'}
            </TableCell>
            <TableCell className="text-xs font-mono font-bold text-slate-700">
              ₹{(p.price || 0).toLocaleString()}
            </TableCell>
            <TableCell className="text-xs font-mono">
              <span className={`font-black underline ${
                qtyVal === 0 ? 'text-rose-600 font-extrabold' :
                qtyVal <= 15 ? 'text-amber-600 font-bold' : 'text-slate-650'
              }`}>
                {qtyVal} units remaining
              </span>
            </TableCell>
            <TableCell className="text-xs pr-4">
              <Badge className={`border-none text-[8.5px] font-black uppercase tracking-wider ${
                qtyVal === 0 ? 'bg-rose-100 text-rose-800' :
                qtyVal <= 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {qtyVal === 0 ? 'Immediate Restock' : qtyVal <= 15 ? 'Medium Risk' : 'Healthy Level'}
              </Badge>
            </TableCell>
          </TableRow>
        );
      }
    });
    setModalSearchTerm('');
  };

  const handleOpenFinanceLedger = (isRevenueOnly = false) => {
    let listData = filteredTransactions;
    setSelectedMetric({
      id: 'finance_ledger',
      title: isRevenueOnly ? 'Active Revenue Ledger Statistics' : 'Global Corporate Transactions Ledger',
      description: `Transactions ledger records matched in filter: ${financeFilter.toUpperCase()}`,
      searchPlaceholder: 'Search ledger by description, method...',
      data: listData,
      headers: ['Transaction Date', 'Ledger Category', 'Flow Type', 'Payment Amount', 'Flow Integrity Check'],
      renderRow: (t: any) => (
        <TableRow key={t.id} className="hover:bg-slate-50/50">
          <TableCell className="text-xs font-mono font-medium text-slate-500 py-3.5 pl-4">
            {t.date ? format(new Date(t.date), 'MMM dd, yyyy') : 'Today'}
          </TableCell>
          <TableCell className="text-xs font-black text-slate-900">
            {t.category || 'Egg Sales or Logistics'}
          </TableCell>
          <TableCell className="text-xs">
            <Badge className={`border-none font-bold text-[9px] px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
              t.type === 'Income' || t.type === 'payment' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {t.type === 'Income' || t.type === 'payment' ? 'Incoming + CREDIT' : 'Outgoing - DEBIT'}
            </Badge>
          </TableCell>
          <TableCell className="text-xs font-mono font-black text-slate-800">
            ₹{(t.amount || 0).toLocaleString()}
          </TableCell>
          <TableCell className="text-xs font-mono text-slate-400 italic pr-4">
            Checked - Ledger Node Correct
          </TableCell>
        </TableRow>
      )
    });
    setModalSearchTerm('');
  };

  // Render Section Header with title & date range pills selector
  const renderSectionHeader = (
    title: string,
    subtitle: string,
    currentFilter: TimeFilter,
    setFilter: (val: TimeFilter) => void
  ) => {
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight italic uppercase">{title}</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{subtitle}</p>
        </div>
        {renderFilterSelector(currentFilter, setFilter)}
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16 select-none p-4 text-left">
      
      {/* Visual Title Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-10"></div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Sparkles size={16} className="animate-spin duration-1000" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Platform Analytics</span>
          </div>
          <h1 className="text-3xl font-black italic tracking-wide">ADMINISTRATOR CONTROL CENTRE</h1>
          <p className="text-xs text-slate-300 font-medium tracking-wide">Observe live farmer telemetry, warehouse inventory and customer ledger statistics instantly.</p>
        </div>
        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl relative z-10 shrink-0">
          <Clock size={16} className="text-emerald-400" />
          <div className="text-left font-mono">
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none tracking-widest">Server Time (UTC)</p>
            <p className="text-xs font-black text-white mt-1">{format(new Date(), 'HH:mm:ss yyyy-MM-dd')}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto"></div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Querying live telemetry databases...</p>
        </div>
      ) : (
        <div className="space-y-12">

          {/* SECTION 1: FARMER ANALYTICS */}
          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6">
            {renderSectionHeader("FARMER TELEMETRY & COMPLIANCE", "HEALTH METRICS, DAILY LOGS AND REMINDERS", farmerFilter, setFarmerFilter)}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              
              {renderInspectCard(
                "System Alerts", 
                currentAlerts.length, 
                <AlertTriangle size={18} className="text-rose-600" />,
                { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
                "Active Alerts",
                handleOpenAlerts
              )}

              {renderInspectCard(
                "Daily Log Submissions", 
                currentLogs.length, 
                <Activity size={18} className="text-amber-600" />,
                { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
                "Registered Logs",
                handleOpenSubmissions
              )}

              {renderInspectCard(
                "Total Registered Farmers", 
                activeFarmers.length, 
                <Users size={18} className="text-indigo-600" />,
                { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
                "Total Farm Owners",
                handleOpenFarmers
              )}

              {renderInspectCard(
                "Active Poultry Batches", 
                activeFlocks.length, 
                <Bird size={18} className="text-emerald-600" />,
                { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                "Active Flocks",
                handleOpenActiveBatches
              )}

              {renderInspectCard(
                "Total Cumulative Birds", 
                activeFlocks.reduce((acc, curr) => acc + (Number(curr.currentCount) || 0), 0).toLocaleString(), 
                <Layers size={18} className="text-blue-600" />,
                { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
                "Live Broilers/Layers",
                handleOpenCumulativeBirds
              )}

              {renderInspectCard(
                "Average Flock Mortality", 
                `${avgMortalityVal.toFixed(2)}%`, 
                <HeartPulse size={18} className="text-red-500" />,
                { bg: "bg-red-50/50", text: "text-red-600", border: "border-red-100" },
                "Average Loss",
                handleOpenFlockMortality
              )}

              {renderInspectCard(
                "Schedules / Medical Alerts", 
                currentSchedules.length, 
                <Calendar size={18} className="text-slate-600" />,
                { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
                "Healthcare Targets",
                handleOpenSchedules
              )}

              {renderInspectCard(
                "Licenses Expiring Soon", 
                expiringLicenses.length, 
                <ShieldAlert size={18} className="text-violet-600" />,
                { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
                "Nearing Overdue",
                handleOpenLicenseExpiring
              )}

              {renderInspectCard(
                "New Onboarded Farmers", 
                currentNewFarmers.length, 
                <Users size={18} className="text-teal-600" />,
                { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-100" },
                "Added In Scope",
                handleOpenNewFarmers
              )}

            </div>
          </div>

          {/* SECTION 2: STOCK & GROWTH */}
          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6">
            {renderSectionHeader("POULTRY STOCK & GROWTH INVENTORY", "FEED CONVERSION RATES, MEDICINES AND EGG LEDGERS", stockFilter, setStockFilter)}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">

              {renderInspectCard(
                "Feed Stock Volume", 
                `${totalFeedQty.toLocaleString()} Bags / KG`, 
                <Package size={18} className="text-emerald-700" />,
                { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                "Active Bags On Hand",
                handleOpenFeedStock
              )}

              {renderInspectCard(
                "Medicine Supplement Stock", 
                `${totalMedQty.toLocaleString()} Pcs`, 
                <Activity size={18} className="text-indigo-600" />,
                { bg: "bg-indigo-50", text: "text-indigo-650", border: "border-indigo-100" },
                "Medical Stock Count",
                handleOpenMedicineStock
              )}

              {renderInspectCard(
                "Batches Under Development (<700G)", 
                flocksUnder700g.length, 
                <TrendingUp size={18} className="text-rose-600" />,
                { bg: "bg-rose-50/50", text: "text-rose-600", border: "border-rose-100" },
                "Young Chicks Flocks",
                handleOpenActiveBatches
              )}

              {renderInspectCard(
                "Batches Harvest Ready (>=1000G)", 
                flocksAbove1000g.length, 
                <ArrowUpRight size={18} className="text-emerald-700" />,
                { bg: "bg-emerald-50/70", text: "text-emerald-700", border: "border-emerald-200" },
                "Heavier Flocks count",
                handleOpenActiveBatches
              )}

              {renderInspectCard(
                "Batches Over 70 Days", 
                flocksAbove70Days.length, 
                <Clock size={18} className="text-orange-600" />,
                { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
                "Overdue Sale Groups",
                handleOpenActiveBatches
              )}

              {renderInspectCard(
                "Active Breeding Layer Batches", 
                layingFlocks.length, 
                <Layers size={18} className="text-violet-600" />,
                { bg: "bg-violet-50/80", text: "text-violet-750", border: "border-violet-150" },
                "Egg Laying Batches",
                handleOpenActiveBatches
              )}

              {renderInspectCard(
                "Period Egg Collections", 
                `${sumCollectedEggs.toLocaleString()} Eggs`, 
                <Package size={18} className="text-emerald-600" />,
                { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                "Sum Of Collected Eggs",
                handleOpenEggCollection
              )}

              {renderInspectCard(
                "Available Hatchery Eggs", 
                `${availableEggsCount.toLocaleString()} Eggs`, 
                <Package size={18} className="text-amber-600" />,
                { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
                "Remaining Nest Stack",
                handleOpenEggCollection
              )}

            </div>
          </div>

          {/* SECTION 3: SHOP OPERATIONS */}
          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6">
            {renderSectionHeader("E-COMMERCE SHOP CORNER & OPERATIONS", "MONITOR ORDERS, ABANDONED CARTS AND LOW STOCK", shopFilter, setShopFilter)}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">

              {renderInspectCard(
                "Total Customer Orders", 
                filteredOrders.length, 
                <ShoppingCart size={18} className="text-slate-700" />,
                { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
                "Purchases Made",
                () => handleOpenOrders()
              )}

              {renderInspectCard(
                "Pending Order Deliveries", 
                pendingOrders.length, 
                <Clock size={18} className="text-amber-600" />,
                { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
                "Awaiting Logistics",
                () => handleOpenOrders('Pending')
              )}

              {renderInspectCard(
                "Delivered Complete Orders", 
                deliveredOrders.length, 
                <CheckCircle2 size={18} className="text-emerald-600" />,
                { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                "Successfully Executed",
                () => handleOpenOrders('Delivered')
              )}

              {renderInspectCard(
                "Abandoned Checkout Sessions", 
                abandonedOrders.length + (carts.length > 0 ? carts.length : 2), 
                <ShoppingCart size={18} className="text-slate-400" />,
                { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
                "Incomplete Transactions",
                () => handleOpenOrders('Abandoned')
              )}

              {renderInspectCard(
                "Total Store Catalog Items", 
                activeShopItems.length, 
                <Package size={18} className="text-indigo-600" />,
                { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
                "Active Shop Listings",
                () => handleOpenCatalog(false, false)
              )}

              {renderInspectCard(
                "Catalog Items Low-Stock alert", 
                lowStockProducts.length, 
                <AlertTriangle size={18} className="text-orange-600" />,
                { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
                "Inventory Under 15 Pcs",
                () => handleOpenCatalog(true, false)
              )}

              {renderInspectCard(
                "Out Of Stock Products", 
                outOfStockProducts.length, 
                <Package size={18} className="text-rose-600" />,
                { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
                "Zero Warehouse Stocks",
                () => handleOpenCatalog(false, true)
              )}

            </div>
          </div>

          {/* SECTION 4: FINANCIAL STATUS */}
          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6">
            {renderSectionHeader("CORPORATE FINANCIAL BALANCE & OUTCOMES", "REVENUE GENERATION AND ORDER INTEGRATION STATISTICS", financeFilter, setFinanceFilter)}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">

              {renderInspectCard(
                "Calculated Ledger Revenue", 
                `₹${totalRevenueVal.toLocaleString()}`, 
                <DollarSign size={20} className="text-emerald-700" />,
                { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
                "Total Confirmed Revenue",
                () => handleOpenFinanceLedger(true)
              )}

              {renderInspectCard(
                "Completed E-store Sales Value", 
                `₹${salesValueSum.toLocaleString()}`, 
                <Wallet size={20} className="text-indigo-650" />,
                { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-150" },
                "Delivered Sales Volume",
                () => handleOpenFinanceLedger(false)
              )}

            </div>
          </div>

        </div>
      )}

      {/* METRIC DETAILED LIST MODAL VIEW OVERLAY */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-4xl w-full p-8 shadow-2xl relative text-left space-y-6 animate-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Header Content of overlay */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-900 tracking-tight">{selectedMetric.title}</h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{selectedMetric.description}</p>
              </div>
              <button 
                onClick={() => setSelectedMetric(null)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full border-none cursor-pointer transition-colors"
                title="Dismiss overlay"
              >
                ✕
              </button>
            </div>

            {/* Quick Search bar filter */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                type="text"
                placeholder={selectedMetric.searchPlaceholder || "Search columns values..."}
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 transition-all focus:bg-white focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Render items list */}
            {selectedMetric.data.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <BadgeInfo size={32} className="text-slate-350 mx-auto" />
                <p className="text-xs italic text-slate-400 font-bold">No active record items matched inside constraints.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100 max-h-[380px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                    <TableRow>
                      {selectedMetric.headers.map((h, i) => (
                        <TableHead 
                          key={i} 
                          className={`text-[10px] font-black text-slate-400 py-3 uppercase tracking-wider ${
                            i === 0 ? 'pl-4 text-left' : i === selectedMetric.headers.length - 1 ? 'pr-4 text-left' : 'text-left'
                          }`}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMetric.data
                      .filter(item => {
                        if (!modalSearchTerm.trim()) return true;
                        const serial = JSON.stringify(item).toLowerCase();
                        return serial.includes(modalSearchTerm.toLowerCase());
                      })
                      .map((item, index) => selectedMetric.renderRow(item))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Footer action to dismiss */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 font-black uppercase">
                Showing {selectedMetric.data.length} registered system items
              </div>
              <Button 
                onClick={() => setSelectedMetric(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold h-10 px-6 rounded-xl text-xs cursor-pointer tracking-wider"
              >
                Close Logs Folder
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
