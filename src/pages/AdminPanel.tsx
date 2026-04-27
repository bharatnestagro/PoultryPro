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
  const [stockStats, setStockStats] = useState({
    totalFeed: 0,
    totalMedicine: 0,
    feedByType: {} as Record<string, number>,
    medByFarmer: [] as any[]
  });
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [allFlocks, setAllFlocks] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [medItems, setMedItems] = useState<any[]>([]);
  const [feedByFarm, setFeedByFarm] = useState<any[]>([]);
  const [medByFarm, setMedByFarm] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'7days' | '14days' | '30days' | 'weekly' | 'monthly'>('14days');
  const [selectedDayDetails, setSelectedDayDetails] = useState<any[] | null>(null);
  const [activeDetail, setActiveDetail] = useState<'feed' | 'medicine' | 'alerts' | 'logs' | null>(null);
  const [missingLogsFlocks, setMissingLogsFlocks] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch users for stats and mapping
    const unsubUsers = onSnapshot(collection(db, 'users'), (userSnap) => {
      const map: Record<string, any> = {};
      userSnap.docs.forEach(u => map[u.id] = u.data());
      setUsersMap(map);
      setStats(prev => ({ ...prev, totalFarmers: userSnap.size }));
    }, (error) => handleFirestoreError(error, 'list', 'users'));

    // 2. Fetch logs
    const qLogs = query(collection(db, 'dailyLogs'), orderBy('date', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAllLogs(logs);
      setLoading(false);
    }, (error) => handleFirestoreError(error, 'list', 'dailyLogs'));

    // 3. Fetch flocks for stats
    const unsubFlocks = onSnapshot(collection(db, 'flocks'), (snapshot) => {
      const flocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAllFlocks(flocks);
      const active = flocks.filter(f => f.status === 'Active');
      const activeBirds = active.reduce((sum, f) => sum + (f.currentCount || 0), 0);
      const totalBirdsPlaced = flocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
      setStats(prev => ({ ...prev, activeFlocks: active.length, totalBirds: activeBirds, totalBirdsPlaced }));
    }, (error) => handleFirestoreError(error, 'list', 'flocks'));

    // 4. Fetch feed stock
    const unsubFeed = onSnapshot(collection(db, 'feedStock'), (feedSnap) => {
      const items = feedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFeedItems(items);
      
      let totalFeed = 0;
      const feedMap: Record<string, number> = {};
      items.forEach(item => {
        totalFeed += item.quantity || 0;
        feedMap[item.type] = (feedMap[item.type] || 0) + (item.quantity || 0);
      });
      setStockStats(prev => ({ ...prev, totalFeed, feedByType: feedMap }));
    }, (error) => handleFirestoreError(error, 'list', 'feedStock'));

    // 5. Fetch medicine stock
    const unsubMed = onSnapshot(collection(db, 'medicineStock'), (medSnap) => {
      const items = medSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMedItems(items);
      setStockStats(prev => ({ ...prev, totalMedicine: medSnap.size }));
    }, (error) => handleFirestoreError(error, 'list', 'medicineStock'));

    return () => {
      unsubUsers();
      unsubLogs();
      unsubFlocks();
      unsubFeed();
      unsubMed();
    };
  }, []);

  // Process Alerts
  useEffect(() => {
    const newAlerts: any[] = [];
    allLogs.slice(0, 100).forEach(data => {
      const farmer = usersMap[data.userId];
      const farmerName = farmer?.name || farmer?.email || `Farmer #${data.userId.substring(0, 4)}`;

      if (data.alerts?.feedDrop || data.alerts?.mortalityIncrease || data.alerts?.eggDrop || data.alerts?.abnormalBehavior) {
        const reasons = [];
        if (data.alerts.feedDrop) reasons.push('Feed Drop');
        if (data.alerts.mortalityIncrease) reasons.push('Mortality Spike');
        if (data.alerts.eggDrop) reasons.push('Egg Drop');
        if (data.alerts.abnormalBehavior) reasons.push(data.alerts.abnormalBehavior);

        newAlerts.push({
          id: `${data.id}-farmer`,
          type: 'Farmer Alert',
          farmerName,
          message: `Farmer reported: ${reasons.join(', ')}`,
          severity: 'critical',
          date: data.date
        });
      }

      if (data.health?.mortality > 5) {
        newAlerts.push({
          id: `${data.id}-mortality`,
          type: 'High Mortality',
          farmerName,
          message: `System detected spike of ${data.health.mortality} birds.`,
          severity: 'critical',
          date: data.date
        });
      }
    });
    setAlerts(newAlerts.slice(0, 10));
  }, [allLogs, usersMap]);

  // Aggregate Feed and Medicine by Farm
  useEffect(() => {
    // Get all unique userIds from feedItems and medicineItems
    const feedUids = new Set(feedItems.map(item => item.userId).filter(Boolean));
    const medUids = new Set(medItems.map(item => item.userId).filter(Boolean));
    const farmerUidsFromMap = Object.keys(usersMap).filter(uid => usersMap[uid].role === 'farmer');
    
    // Combine all unique IDs to ensure no one is missed
    const allRelevantFeedUids = Array.from(new Set([...Array.from(feedUids), ...farmerUidsFromMap]));
    const allRelevantMedUids = Array.from(new Set([...Array.from(medUids), ...farmerUidsFromMap]));

    // Feed aggregation
    const feedData = allRelevantFeedUids.map(uid => {
      const userFeed = feedItems.filter(item => item.userId === uid);
      const types: Record<string, number> = {
        'Pre-Starter': 0,
        'Starter': 0,
        'Finisher': 0,
        'Layer': 0,
        'Counter': 0,
        'Other': 0
      };
      let total = 0;
      userFeed.forEach(item => {
        total += Number(item.quantity) || 0;
        const type = item.type || 'Other';
        types[type] = (types[type] || 0) + (Number(item.quantity) || 0);
      });
      return {
        userId: uid,
        total,
        types
      };
    }).sort((a, b) => b.total - a.total);
    setFeedByFarm(feedData);

    // Medicine aggregation
    const medData = allRelevantMedUids.map(uid => {
      const userMed = medItems.filter(item => item.userId === uid);
      let total = 0;
      userMed.forEach(item => {
        total += Number(item.quantity) || 0;
      });
      return {
        userId: uid,
        total,
        items: userMed
      };
    }).sort((a, b) => b.total - a.total);
    setMedByFarm(medData);
  }, [feedItems, medItems, usersMap]);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const active = allFlocks.filter(f => f.status === 'Active');
    const flocksWithLogs = new Set(allLogs.filter(l => l.date === today).map(l => l.flockId));
    const missing = active.filter(f => !flocksWithLogs.has(f.id));
    setMissingLogsFlocks(missing);

    // Calculate Global Mortality Rate (Active Flocks)
    const activeFlockIds = new Set(active.map(f => f.id));
    const activeLogs = allLogs.filter(l => activeFlockIds.has(l.flockId));
    const totalMortality = activeLogs.reduce((sum, l) => sum + (l.health?.mortality || 0), 0);
    const totalInitialBirds = active.reduce((sum, f) => sum + (f.initialCount || 0), 0);
    const rate = totalInitialBirds > 0 ? (totalMortality / totalInitialBirds) * 100 : 0;
    setStats(prev => ({ ...prev, mortalityRate: rate }));
  }, [allFlocks, allLogs]);

  const getMortalityTrendData = () => {
    const now = new Date();
    let data: any[] = [];
    
    const normalizeDate = (date: any) => {
      if (!date) return '';
      if (typeof date === 'string') return date.split('T')[0]; // Handle ISO strings
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
        
        const mortality = dayLogs.reduce((sum, log) => {
          const val = log.health?.mortality;
          return sum + (typeof val === 'number' ? val : Number(val) || 0);
        }, 0);
        
        // Use initial count of flocks that were active or had logs on that day
        const dayFlockIds = new Set(dayLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => 
          dayFlockIds.has(f.id) || 
          (f.status === 'Active' && normalizeDate(f.placementDate) <= dateStr)
        );
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
        const weekLogs = allLogs.filter(log => isSameWeek(parseISO(log.date), weekStart));
        const mortality = weekLogs.reduce((sum, log) => sum + (log.health?.mortality || 0), 0);
        
        const weekFlockIds = new Set(weekLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => weekFlockIds.has(f.id) || f.status === 'Active');
        const totalBirds = relevantFlocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
        
        const rate = totalBirds > 0 ? (mortality / totalBirds) * 100 : 0;
        
        data.push({
          name: `Week ${format(weekStart, 'w')}`,
          weekStart,
          mortality,
          rate: Number(rate.toFixed(2))
        });
      }
    } else if (timeRange === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = subDays(now, i * 30);
        const monthStart = startOfMonth(d);
        const monthLogs = allLogs.filter(log => isSameMonth(parseISO(log.date), monthStart));
        const mortality = monthLogs.reduce((sum, log) => sum + (log.health?.mortality || 0), 0);
        
        const monthFlockIds = new Set(monthLogs.map(l => l.flockId));
        const relevantFlocks = allFlocks.filter(f => monthFlockIds.has(f.id) || f.status === 'Active');
        const totalBirds = relevantFlocks.reduce((sum, f) => sum + (f.initialCount || 0), 0);
        
        const rate = totalBirds > 0 ? (mortality / totalBirds) * 100 : 0;
        
        data.push({
          name: format(monthStart, 'MMM'),
          monthStart,
          mortality,
          rate: Number(rate.toFixed(2))
        });
      }
    }
    return data;
  };

  const handleBarClick = (data: any) => {
    if (!data) return;
    let filteredLogs: any[] = [];
    if (timeRange === '7days') {
      filteredLogs = allLogs.filter(log => log.date === data.fullDate && (log.health?.mortality > 0));
    } else if (timeRange === 'weekly') {
      filteredLogs = allLogs.filter(log => isSameWeek(parseISO(log.date), data.weekStart) && (log.health?.mortality > 0));
    } else if (timeRange === 'monthly') {
      filteredLogs = allLogs.filter(log => isSameMonth(parseISO(log.date), data.monthStart) && (log.health?.mortality > 0));
    }
    
    const details = filteredLogs.map(log => {
      const farmer = usersMap[log.userId];
      const flock = allFlocks.find((f: any) => f.id === log.flockId);
      return {
        farmerName: farmer?.name || 'Unknown',
        flockName: flock?.name || 'Unknown',
        mortality: log.health?.mortality || 0,
        date: log.date
      };
    });
    
    setSelectedDayDetails(details);
  };

  const StatCard = ({ title, value, subValue, icon: Icon, trend, color, onClick, isActive, unit }: any) => (
    <Card 
      className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${isActive ? 'ring-2 ring-slate-900 shadow-lg scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-8">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
          <div className={`${color} p-2 rounded-xl text-white`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-4xl font-bold text-slate-900">{value}</h3>
          {unit && <span className="text-sm font-bold text-slate-400">{unit}</span>}
          {trend && (
            <Badge className={`${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} border-none rounded-lg text-[10px] font-bold`}>
              {trend}
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          {onClick ? (
            <span className="flex items-center gap-1 font-bold text-slate-900 uppercase tracking-tighter text-[9px]">
              {isActive ? 'Hide Details' : 'View Details'}
              {isActive ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </span>
          ) : (
            <>
              <MapPin size={12} />
              {subValue}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-500 font-medium">Global Poultry Performance Dashboard</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-bold bg-slate-50">Real-time</Button>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-medium text-slate-500">Last 30 Days</Button>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-medium text-slate-500">Custom</Button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Farmers" 
          value={stats.totalFarmers.toLocaleString()} 
          subValue="Active nationwide network" 
          icon={Users} 
          trend="+4.2%" 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Active Flocks" 
          value={stats.activeFlocks.toLocaleString()} 
          subValue="Across 8 regions" 
          icon={Package} 
          trend="+12" 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="Total Birds" 
          value={stats.totalBirds.toLocaleString()} 
          subValue={`Active birds (${stats.totalBirdsPlaced.toLocaleString()} total placed)`} 
          icon={Activity} 
          trend="Stable" 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Mortality Rate" 
          value={`${stats.mortalityRate.toFixed(2)}%`} 
          subValue={stats.mortalityRate > 5 ? "Above threshold" : "Within safe limits"} 
          icon={AlertTriangle} 
          trend={stats.mortalityRate > 3 ? "+0.4%" : "-0.2%"} 
          color={stats.mortalityRate > 5 ? "bg-red-500" : "bg-emerald-500"} 
        />
        <StatCard 
          title="Logs" 
          value={missingLogsFlocks.length.toString()} 
          unit="Missing Today"
          icon={Activity} 
          color="bg-orange-600" 
          onClick={() => setActiveDetail(activeDetail === 'logs' ? null : 'logs')}
          isActive={activeDetail === 'logs'}
        />
        <StatCard 
          title="Total Feed" 
          value={stockStats.totalFeed.toLocaleString()} 
          unit="kg"
          icon={Package} 
          color="bg-emerald-600" 
          onClick={() => setActiveDetail(activeDetail === 'feed' ? null : 'feed')}
          isActive={activeDetail === 'feed'}
        />
        <StatCard 
          title="Medicine Stock" 
          value={stockStats.totalMedicine.toLocaleString()} 
          unit="Items"
          icon={Activity} 
          color="bg-indigo-600" 
          onClick={() => setActiveDetail(activeDetail === 'medicine' ? null : 'medicine')}
          isActive={activeDetail === 'medicine'}
        />
        <StatCard 
          title="Critical Alerts" 
          value={alerts.length.toString()} 
          unit="Active"
          icon={AlertTriangle} 
          color="bg-red-600" 
          onClick={() => setActiveDetail(activeDetail === 'alerts' ? null : 'alerts')}
          isActive={activeDetail === 'alerts'}
        />
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
                        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                        .map((item) => {
                          const farmer = usersMap[item.userId];
                          return (
                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-2 text-xs text-slate-500">
                                {item.createdAt ? format(new Date(item.createdAt), 'MMM dd, yyyy') : 'N/A'}
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
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
                  No critical alerts detected
                </div>
              ) : (
                alerts.map((alert) => (
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
                      <div className="flex justify-between items-center mt-3">
                        <div className="flex gap-4">
                          <button className="text-[10px] font-bold text-red-600 uppercase tracking-widest hover:underline">Dispatch Vet</button>
                          <button className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900">Contact Farmer</button>
                        </div>
                      </div>
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
    </div>
  );
};

export default AdminPanel;
