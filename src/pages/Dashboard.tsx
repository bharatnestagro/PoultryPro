import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Package, CreditCard, ArrowUpRight, ArrowDownRight, Pill, ClipboardCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    totalFlocks: 0,
    totalBirds: 0,
    balance: 0,
    feedStock: 0,
    medicineStock: 0,
  });
  const [activeFlocks, setActiveFlocks] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [feedStockList, setFeedStockList] = useState<any[]>([]);
  const [medicineStockList, setMedicineStockList] = useState<any[]>([]);
  const [logCompliance, setLogCompliance] = useState(0);

  const calculateProductionCost = (flock: any) => {
    const flockLogs = dailyLogs.filter(log => log.flockId === flock.id);
    
    // 1. Chicks Cost per bird
    const chicksCostPerBird = flock.initialCount > 0 ? (flock.chicksCost || 0) / flock.initialCount : 0;
    
    // 2. Feed Cost
    let totalFeedCost = 0;
    flockLogs.forEach(log => {
      const feedType = log.consumption?.feedType;
      const intake = Number(log.consumption?.feedIntake) || 0;
      if (intake > 0 && feedType) {
        // Find the most relevant stock item for this feed type
        const stockItem = feedStockList.find(s => s.type === feedType);
        if (stockItem && stockItem.purchaseCost && stockItem.quantity) {
          const pricePerKg = stockItem.purchaseCost / stockItem.quantity;
          totalFeedCost += intake * pricePerKg;
        }
      }
    });
    const feedCostPerBird = flock.currentCount > 0 ? totalFeedCost / flock.currentCount : 0;
    
    // 3. Medicine Cost
    let totalMedCost = 0;
    flockLogs.forEach(log => {
      const medName = log.health?.medicines;
      const medDoses = Number(log.health?.medicineDoses) || 0;
      if (medDoses > 0 && medName && medName !== 'none') {
        const medItem = medicineStockList.find(m => m.name === medName);
        if (medItem && medItem.purchaseCost && medItem.quantity) {
          const pricePerUnit = medItem.purchaseCost / medItem.quantity;
          totalMedCost += medDoses * pricePerUnit;
        }
      }
      
      const vacName = log.health?.vaccines;
      const vacDoses = Number(log.health?.vaccineDoses) || 0;
      if (vacDoses > 0 && vacName && vacName !== 'none') {
        const vacItem = medicineStockList.find(m => m.name === vacName);
        if (vacItem && vacItem.purchaseCost && vacItem.quantity) {
          const pricePerUnit = vacItem.purchaseCost / vacItem.quantity;
          totalMedCost += vacDoses * pricePerUnit;
        }
      }
    });
    const medCostPerBird = flock.currentCount > 0 ? totalMedCost / flock.currentCount : 0;
    
    return chicksCostPerBird + feedCostPerBird + medCostPerBird;
  };

  useEffect(() => {
    if (!user) return;

    // Listen to flocks
    const flocksQuery = query(collection(db, 'flocks'), where('userId', '==', user.uid));
    const unsubscribeFlocks = onSnapshot(flocksQuery, (snapshot) => {
      let birds = 0;
      let activeCount = 0;
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      list.forEach(flock => {
        if (flock.status === 'Active') {
          birds += flock.currentCount || 0;
          activeCount++;
        }
      });
      setActiveFlocks(list.filter(f => f.status === 'Active'));
      setStats(prev => ({ ...prev, totalFlocks: activeCount, totalBirds: birds }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'flocks');
    });

    // Listen to transactions
    const transactionsQuery = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(5)
    );
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentTransactions(txs);
      
      // Calculate balance (this would normally be a separate aggregation or state)
      // For simplicity, we'll just sum all transactions for this user
      const allTxsQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      onSnapshot(allTxsQuery, (allSnap) => {
        let bal = 0;
        allSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'Income') bal += data.amount;
          else bal -= data.amount;
        });
        setStats(prev => ({ ...prev, balance: bal }));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // Listen to stock
    const qFeed = query(collection(db, 'feedStock'), where('userId', '==', user.uid));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFeedStockList(list);
      const total = list.reduce((sum, item) => sum + (item.quantity || 0), 0);
      setStats(prev => ({ ...prev, feedStock: total }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const qMed = query(collection(db, 'medicineStock'), where('userId', '==', user.uid));
    const unsubMed = onSnapshot(qMed, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMedicineStockList(list);
      const availableCount = list.filter(item => (item.quantity || 0) > 0).length;
      setStats(prev => ({ ...prev, medicineStock: availableCount }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    // Listen to daily logs for cost calculations
    const qLogs = query(collection(db, 'dailyLogs'), where('userId', '==', user.uid));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    return () => {
      unsubscribeFlocks();
      unsubscribeTransactions();
      unsubFeed();
      unsubMed();
      unsubLogs();
    };
  }, [user]);

  useEffect(() => {
    if (activeFlocks.length === 0) {
      setLogCompliance(0);
      return;
    }

    let totalExpected = 0;
    let totalActual = 0;
    const today = new Date();

    activeFlocks.forEach(flock => {
      if (flock.placementDate) {
        const startDate = new Date(flock.placementDate);
        const daysElapsed = differenceInDays(today, startDate) + 1;
        totalExpected += daysElapsed;
        
        const flockLogs = dailyLogs.filter(log => log.flockId === flock.id);
        totalActual += flockLogs.length;
      }
    });

    const percentage = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;
    setLogCompliance(Math.min(100, Math.round(percentage)));
  }, [activeFlocks, dailyLogs]);

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`${color} p-3 rounded-2xl text-white shadow-lg`}>
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Farm Overview</h1>
        <p className="text-slate-500">Welcome back, {profile?.name || 'Farmer'}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          title="Logs" 
          value={`${logCompliance}%`} 
          icon={ClipboardCheck} 
          color="bg-indigo-600"
          subtitle="Submission compliance"
        />
        <StatCard 
          title="Total Birds" 
          value={stats.totalBirds.toLocaleString()} 
          icon={Users} 
          color="bg-emerald-500"
          subtitle={`${profile?.birdCapacity ? Math.round((stats.totalBirds / profile.birdCapacity) * 100) : 0}% of capacity`}
        />
        <StatCard 
          title="Active Flocks" 
          value={stats.totalFlocks} 
          icon={Package} 
          color="bg-blue-500"
          subtitle="Across all breeds"
        />
        <StatCard 
          title="Net Balance" 
          value={`₹${stats.balance.toLocaleString()}`} 
          icon={CreditCard} 
          color="bg-orange-500"
          subtitle="Total profit/loss"
        />
        <StatCard 
          title="Feed Stock" 
          value={`${stats.feedStock} kg`} 
          icon={Package} 
          color="bg-amber-600"
          subtitle="Available inventory"
        />
        <StatCard 
          title="Medicine Stock" 
          value={`${stats.medicineStock} Items`} 
          icon={Pill} 
          color="bg-indigo-600"
          subtitle="Available vaccines/meds"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Batch Performance Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Batch Performance</h2>
              <p className="text-xs text-slate-500">Current FCR tracking</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeFlocks.length === 0 ? (
                <div className="col-span-full bg-white p-8 rounded-2xl text-center text-slate-400 border border-dashed border-slate-200">
                  No active batches
                </div>
              ) : (
                activeFlocks.map((flock) => (
                  <Card key={flock.id} className="border-none shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900">{flock.name}</h3>
                          <p className="text-xs text-slate-500">{flock.breed}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          (flock.currentFCR || 0) < 1.6 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          FCR: {flock.currentFCR || 'N/A'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase">Mortality</p>
                          <p className="text-sm font-bold text-red-600">
                            {flock.totalMortality || 0} ({flock.initialCount > 0 ? ((flock.totalMortality || 0) / flock.initialCount * 100).toFixed(1) : 0}%)
                          </p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase">Avg Weight</p>
                          <p className="text-sm font-bold text-blue-600">
                            {flock.currentWeight || flock.initialAvgWeight || 0}g
                          </p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl col-span-2">
                          <p className="text-[10px] text-slate-500 uppercase text-center">Cost / Bird</p>
                          <p className="text-sm font-bold text-emerald-600 text-center">
                            ₹{calculateProductionCost(flock).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Live Birds</span>
                          <span className="font-semibold text-slate-800">{flock.currentCount} / {flock.initialCount}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (flock.currentCount / flock.initialCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions Section */}
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 border border-dashed border-slate-200">
                No transactions yet
              </div>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${tx.type === 'Income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'Income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{tx.description}</p>
                      <p className="text-xs text-slate-400">{tx.date ? format(new Date(tx.date), 'MMM dd, yyyy') : ''}</p>
                    </div>
                  </div>
                  <p className={`font-bold ${tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'Income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Farm Summary</h2>
          <Card className="border-none shadow-sm bg-emerald-900 text-white">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-emerald-200 text-xs uppercase tracking-wider font-semibold">Farm Name</p>
                <p className="text-lg font-bold">{profile?.farmName}</p>
              </div>
              <div>
                <p className="text-emerald-200 text-xs uppercase tracking-wider font-semibold">Type</p>
                <p className="text-lg font-bold">{profile?.farmType}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-emerald-200 text-xs uppercase tracking-wider font-semibold">Area</p>
                  <p className="text-lg font-bold">{profile?.farmArea} Acres</p>
                </div>
                <div>
                  <p className="text-emerald-200 text-xs uppercase tracking-wider font-semibold">Capacity</p>
                  <p className="text-lg font-bold">{profile?.birdCapacity} Birds</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
