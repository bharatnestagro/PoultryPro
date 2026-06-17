import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, query, where, getDoc, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  Bird,
  Activity,
  XCircle,
  Package,
  Pill,
  ClipboardList,
  Download,
  Calendar,
  AlertCircle,
  Egg,
  Plus,
  Trash2,
  CheckSquare,
  Info,
  Layers,
  TrendingUp,
  Coins
} from 'lucide-react';

const FarmerDetails: React.FC = () => {
  const { id: farmerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [farmer, setFarmer] = useState<any | null>(null);
  const [loadingFarmer, setLoadingFarmer] = useState(true);
  
  const [selectedFarmerFlocks, setSelectedFarmerFlocks] = useState<any[]>([]);
  const [selectedFarmerLogs, setSelectedFarmerLogs] = useState<any[]>([]);
  const [selectedFarmerStock, setSelectedFarmerStock] = useState<{ feed: any[], medicine: any[] }>({ feed: [], medicine: [] });
  const [selectedFarmerTransactions, setSelectedFarmerTransactions] = useState<any[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<string | null>(null);

  // New states for real-time collections
  const [schedules, setSchedules] = useState<any[]>([]);
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [eggSales, setEggSales] = useState<any[]>([]);
  
  // Interactive UI configurations
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showEggDetails, setShowEggDetails] = useState(false);
  const [showRecordEggModal, setShowRecordEggModal] = useState(false);

  // New Schedule form state
  const [schedType, setSchedType] = useState<'Medicine' | 'Vaccination'>('Vaccination');
  const [schedItemName, setSchedItemName] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedAge, setSchedAge] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);

  // New Egg record form state
  const [eggRecordDate, setEggRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [eggRecordGood, setEggRecordGood] = useState('');
  const [eggRecordBad, setEggRecordBad] = useState('');
  const [eggRecordWeight, setEggRecordWeight] = useState('');
  const [eggRecordCost, setEggRecordCost] = useState('');
  const [eggRecordQuality, setEggRecordQuality] = useState('Standard A');
  const [eggRecordLoading, setEggRecordLoading] = useState(false);

  const isManagerView = location.pathname.startsWith('/manager');
  const backPath = isManagerView ? '/manager/farmers' : '/admin/farmers';

  // 1. Fetch Farmer Profile Details
  useEffect(() => {
    if (!farmerId) return;

    setLoadingFarmer(true);
    const docRef = doc(db, 'users', farmerId);
    
    // Listen to real-time changes of the profile
    const unsubFarmer = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setFarmer({ id: docSnap.id, ...docSnap.data() });
      } else {
        setFarmer(null);
      }
      setLoadingFarmer(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
      setLoadingFarmer(false);
    });

    return () => unsubFarmer();
  }, [farmerId]);

  // 2. Fetch related data for this specific farmer
  useEffect(() => {
    if (!farmerId) return;

    setSelectedFarmerFlocks([]);
    setSelectedFarmerLogs([]);
    setSelectedFlockId(null);

    // Fetch flocks for selected farmer
    const qFlocks = query(collection(db, 'flocks'));
    const unsubFlocks = onSnapshot(qFlocks, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((f: any) => f.userId === farmerId)
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
        .filter((l: any) => l.userId === farmerId)
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setSelectedFarmerLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    // Fetch stock for selected farmer
    const unsubFeed = onSnapshot(collection(db, 'feedStock'), (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === farmerId);
      setSelectedFarmerStock(prev => ({ ...prev, feed: list }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const unsubMed = onSnapshot(collection(db, 'medicineStock'), (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === farmerId);
      setSelectedFarmerStock(prev => ({ ...prev, medicine: list }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    // Fetch transactions for selected farmer
    const qTxs = query(collection(db, 'transactions'));
    const unsubTxs = onSnapshot(qTxs, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((t: any) => t.userId === farmerId)
        .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setSelectedFarmerTransactions(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    // Fetch schedules for selected farmer
    const qSchedules = query(collection(db, 'schedules'));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((s: any) => s.userId === farmerId);
      setSchedules(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'schedules'));

    // Fetch eggLogs for selected farmer
    const qEggLogs = query(collection(db, 'eggLogs'));
    const unsubEggLogs = onSnapshot(qEggLogs, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => e.userId === farmerId);
      setEggLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggLogs'));

    // Fetch eggSales for selected farmer
    const qEggSales = query(collection(db, 'eggSales'));
    const unsubEggSales = onSnapshot(qEggSales, (snap) => {
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((e: any) => e.userId === farmerId);
      setEggSales(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggSales'));

    return () => {
      unsubFlocks();
      unsubLogs();
      unsubFeed();
      unsubMed();
      unsubTxs();
      unsubSchedules();
      unsubEggLogs();
      unsubEggSales();
    };
  }, [farmerId]);

  // Derived computations
  const activeFlocks = selectedFarmerFlocks.filter(f => f.status === 'Active' || !f.status);
  
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

  const selectedFarmerStats = {
    totalFlocks: selectedFarmerFlocks.length,
    totalBirds: selectedFarmerFlocks.reduce((sum, f) => sum + (Number(f.currentCount) || 0), 0),
    balance: selectedFarmerTransactions.reduce((sum, t) => sum + (t.type === 'payment' ? -t.amount : t.amount), 0),
    compliance: getLogPercentage(),
    feedStock: selectedFarmerStock.feed.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
    feedValue: selectedFarmerStock.feed.reduce((sum, s) => sum + (Number(s.purchaseCost) || 0), 0)
  };

  const currentFlockId = selectedFlockId || (selectedFarmerFlocks[0]?.id || null);
  const selectedFlock = selectedFarmerFlocks.find(f => f.id === currentFlockId);
  const selectedFlockLogs = selectedFarmerLogs.filter(log => log.flockId === currentFlockId);

  // NEW COMPUTED PARAMETERS & UTILITIES FOR SELECTED FLOCK
  const selectedFlockSchedules = schedules.filter(s => s.flockId === currentFlockId);
  const selectedFlockEggLogs = eggLogs.filter(e => e.flockId === currentFlockId);
  const selectedFlockEggSales = eggSales.filter(e => e.flockId === currentFlockId);

  // Current Live Count
  const currentLiveCountFlock = selectedFlock?.currentCount !== undefined 
    ? Number(selectedFlock.currentCount) 
    : (Number(selectedFlock?.initialCount) || 0);

  // 1. Current Weight (Grams)
  const latestWeightLogFlock = [...selectedFlockLogs]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .find(log => log.production?.avgWeight);
  const currentWeightGramsFlock = Number(latestWeightLogFlock?.production?.avgWeight) || 0;
  const currentWeightKgFlock = currentWeightGramsFlock / 1000;

  // 2. FCR (Feed Conversion Ratio)
  const totalFeedConsumedKgFlock = selectedFlockLogs.reduce((sum, log) => sum + (Number(log.consumption?.feedIntake) || 0), 0);
  const totalBiomassKgFlock = currentLiveCountFlock * currentWeightKgFlock;
  const calculatedFCRFlock = (totalBiomassKgFlock > 0 && totalFeedConsumedKgFlock > 0) 
    ? Number((totalFeedConsumedKgFlock / totalBiomassKgFlock).toFixed(2)) 
    : 1.62; // Standard average baseline fallback if no weights logged

  // 3. Per Bird Cost (₹)
  const chicksCostTotalFlock = Number(selectedFlock?.chicksCost) || (Number(selectedFlock?.initialCount || 0) * 38);
  const averageFeedCostPerKgFlock = 42; // ₹42 per KG standard benchmark
  const cumulativeFeedCostFlock = totalFeedConsumedKgFlock * averageFeedCostPerKgFlock;
  const staticMedCostPerBirdFlock = 12; // average medicine cost per bird standard
  const cumulativeMedicineCostFlock = currentLiveCountFlock * staticMedCostPerBirdFlock;
  const totalExpensesSoFarFlock = chicksCostTotalFlock + cumulativeFeedCostFlock + cumulativeMedicineCostFlock;
  const perBirdCostValFlock = currentLiveCountFlock > 0 ? (totalExpensesSoFarFlock / currentLiveCountFlock) : 0;

  // 4. Per KG Cost (₹)
  const perKgCostValFlock = currentWeightKgFlock > 0 ? (perBirdCostValFlock / currentWeightKgFlock) : (perBirdCostValFlock / 1.8);

  // 5. Livability Rate (%)
  const initialBirdCountFlock = Number(selectedFlock?.initialCount) || 1;
  const livabilityRateFlock = Math.min(100, Math.max(0, (currentLiveCountFlock / initialBirdCountFlock) * 100));

  // 6. Total Feed Used with Amount
  const displayTotalFeedAmountFlock = cumulativeFeedCostFlock;

  // 7. Total Medicine Used with Amount
  const totalMedicineLogsCountFlock = selectedFlockLogs.filter(log => log.health?.medicines && log.health.medicines !== 'None' && log.health.medicines !== 'none').length;
  const medicineAmountTotalFlock = totalMedicineLogsCountFlock * 180 + (currentLiveCountFlock * 4.5); 

  // Parse Completed Vaccines for "how Many Vaccine done"
  const completedVaccinesListFlock = selectedFlockLogs
    .filter(log => log.health?.vaccines && log.health.vaccines !== 'None' && log.health.vaccines !== 'none')
    .map(log => {
      const placementDate = selectedFlock?.placementDate ? new Date(selectedFlock.placementDate) : null;
      let calculatedAge = log.age;
      if (!calculatedAge && placementDate && log.date) {
        calculatedAge = Math.floor((new Date(log.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      const vaccineDate = log.date ? new Date(log.date) : new Date();
      const daysSinceVaccination = Math.floor((new Date().getTime() - vaccineDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        name: log.health.vaccines,
        date: log.date || 'N/A',
        age: calculatedAge !== undefined ? `${calculatedAge} Days` : 'N/A',
        daysSince: daysSinceVaccination >= 0 ? `${daysSinceVaccination} days ago` : 'Today'
      };
    });

  // Egg production calculations & Daily Collections data merge
  const layerLogsMergedFlock = [
    ...selectedFlockEggLogs.map(l => ({
      id: l.id,
      date: l.date,
      goodEggs: Number(l.goodEggs) || 0,
      badEggs: Number(l.badEggs) || 0,
      totalEggs: Number(l.totalEggs) || (Number(l.goodEggs) || 0) + (Number(l.badEggs) || 0),
      dailyCost: Number(l.dailyCost) || 0,
      costPerEgg: Number(l.costPerEgg) || 0,
      source: 'egg_log'
    })),
    ...selectedFlockLogs
      .filter(l => Number(l.production?.eggCount) > 0 || Number(l.production?.goodEggs) > 0)
      .map(l => {
        const good = Number(l.production?.goodEggs) || Number(l.production?.eggCount) || 0;
        const bad = Number(l.production?.badEggs) || 0;
        const total = good + bad;
        const dailyEstCost = (Number(l.consumption?.feedIntake) || 0) * averageFeedCostPerKgFlock + 220;
        return {
          id: l.id,
          date: l.date,
          goodEggs: good,
          badEggs: bad,
          totalEggs: total,
          dailyCost: dailyEstCost,
          costPerEgg: good > 0 ? dailyEstCost / good : 0,
          source: 'daily_log'
        };
      })
  ].sort((a, b) => b.date.localeCompare(a.date));

  const last7DaysLogsFlock = layerLogsMergedFlock.slice(0, 7);
  const avg7DayEggsFlock = last7DaysLogsFlock.length > 0 
    ? Math.round(last7DaysLogsFlock.reduce((sum, l) => sum + l.totalEggs, 0) / last7DaysLogsFlock.length) 
    : 0;

  const avgCostPerEggFlock = last7DaysLogsFlock.length > 0
    ? (last7DaysLogsFlock.reduce((sum, l) => sum + l.costPerEgg, 0) / last7DaysLogsFlock.length)
    : 0;

  const latestLayerLogFlock = layerLogsMergedFlock[0];
  const latestDailyEggsCountFlock = latestLayerLogFlock?.totalEggs || 0;
  const layingRatePercentFlock = currentLiveCountFlock > 0 
    ? Math.min(100, Math.round((latestDailyEggsCountFlock / currentLiveCountFlock) * 100)) 
    : 0;

  const totalGoodEggsCollectedFlock = layerLogsMergedFlock.reduce((sum, l) => sum + l.goodEggs, 0);
  const totalEggsSoldFlock = selectedFlockEggSales.reduce((sum, sale) => sum + (Number(sale.eggCount) || 0), 0);
  const availableEggsOnHandFlock = Math.max(0, totalGoodEggsCollectedFlock - totalEggsSoldFlock);

  // SCHEDULING ACTION HANDLERS
  const handleCreateSchedAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedItemName || !schedDate) {
      alert("Please fill all required schedule details.");
      return;
    }
    setSchedLoading(true);
    try {
      await addDoc(collection(db, 'schedules'), {
        userId: farmerId,
        flockId: currentFlockId,
        title: `${schedType}: ${schedItemName}`,
        itemName: schedItemName,
        type: schedType,
        startDate: schedDate,
        age: schedAge || 'Auto',
        description: schedNotes || 'Scheduled for operational optimal routine',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      setSchedItemName('');
      setSchedDate('');
      setSchedAge('');
      setSchedNotes('');
      setShowScheduleForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'schedules');
    } finally {
      setSchedLoading(false);
    }
  };

  const handleDeleteSched = async (schedId: string) => {
    if (window.confirm("Are you sure you want to cancel this scheduled item?")) {
      try {
        await deleteDoc(doc(db, 'schedules', schedId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'schedules');
      }
    }
  };

  const handleCompleteSched = async (schedId: string) => {
    try {
      await updateDoc(doc(db, 'schedules', schedId), {
        status: 'Completed',
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'schedules');
    }
  };

  // EGG RECORD HANDLER
  const handleAddEggRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eggRecordGood) {
      alert("Please specify Good Eggs count");
      return;
    }
    setEggRecordLoading(true);
    try {
      const goodCount = Number(eggRecordGood) || 0;
      const badCount = Number(eggRecordBad) || 0;
      const totalCount = goodCount + badCount;
      const costEst = Number(eggRecordCost) || 0;
      const eggWt = Number(eggRecordWeight) || 58;

      await addDoc(collection(db, 'eggLogs'), {
        userId: farmerId,
        flockId: currentFlockId,
        date: eggRecordDate,
        goodEggs: goodCount,
        badEggs: badCount,
        totalEggs: totalCount,
        dailyCost: costEst,
        eggWeight: eggWt,
        eggQuality: eggRecordQuality,
        costPerEgg: goodCount > 0 ? costEst / goodCount : 0,
        createdAt: new Date().toISOString()
      });

      setEggRecordGood('');
      setEggRecordBad('');
      setEggRecordCost('');
      setEggRecordWeight('');
      setShowRecordEggModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'eggLogs');
    } finally {
      setEggRecordLoading(false);
    }
  };

  const handleDownloadLogs = () => {
    if (selectedFlockLogs.length === 0) {
      alert('No logs available to export');
      return;
    }
    const logsToExport = selectedFlockLogs.map(log => ({
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
      ...logsToExport.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flock_logs_${farmer?.name || 'farmer'}_${selectedFlock?.name || 'batch'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loadingFarmer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
        <p className="text-sm text-slate-500 font-bold tracking-wider uppercase animate-pulse">Loading Farmer Insights...</p>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Farmer Not Found</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            The requested farmer profile could not be loaded, or you may lack permissions to view it.
          </p>
        </div>
        <Button 
          onClick={() => navigate(backPath)}
          className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg text-white font-bold h-12 px-6"
        >
          Return to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16 select-none pt-4 text-left px-4">
      
      {/* Upper Back Nav Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => navigate(backPath)}
            variant="outline" 
            size="icon" 
            className="rounded-2xl border-slate-200 hover:bg-slate-50 hover:border-slate-300 w-11 h-11 shrink-0"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Farmer details Center
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Comprehensive operational profile and batch analytics
            </p>
          </div>
        </div>
        <div className="bg-emerald-50 px-4 py-2 border border-emerald-100/40 rounded-2xl shrink-0 text-right">
          <p className="text-[10px] text-emerald-600 uppercase font-black tracking-widest leading-none">Record compliance</p>
          <p className="text-sm font-mono font-black text-emerald-800 mt-1">{selectedFarmerStats.compliance}% Compliance</p>
        </div>
      </div>

      {/* Upper 2 Columns Grid: Left & Right components */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Col - Profile Info & Demographics */}
        <Card className="lg:col-span-5 border-none shadow-md bg-white rounded-[2.5rem] p-8 space-y-8 border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-505/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <div className="flex items-center gap-5 pb-6 border-b border-slate-100">
            <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center text-emerald-700 font-black text-2xl border border-emerald-100/30 shadow-inner">
              {farmer.name ? farmer.name.split(' ').map((n: any) => n[0]).join('') : '??'}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Farmer Profile</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{farmer.name || 'Anonymous Farmer'}</h3>
              <p className="text-xs font-mono font-bold text-slate-500">{farmer.farmName || 'Unregistered Farm Name'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                <Phone size={11} className="text-emerald-500" /> Contact Number
              </p>
              <p className="text-sm font-bold text-slate-800">{farmer.phone || 'No phone added'}</p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                <Mail size={11} className="text-emerald-500" /> Email Address
              </p>
              <p className="text-sm font-bold text-slate-800 break-all">{farmer.email || 'No email registered'}</p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                <MapPin size={11} className="text-emerald-500" /> Farm Area Size
              </p>
              <p className="text-sm font-black text-slate-800">{farmer.farmArea || '0'} Acres</p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                <Bird size={11} className="text-emerald-500" /> Total Capacity
              </p>
              <p className="text-sm font-black text-slate-800">{(Number(farmer.birdCapacity) || 0).toLocaleString()} Birds</p>
            </div>

            <div className="space-y-1.5 p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/20">
              <p className="text-[10px] uppercase font-black text-emerald-600 tracking-wider flex items-center gap-1.5">
                <Activity size={11} className="text-emerald-500" /> Active Batches
              </p>
              <p className="text-sm font-black text-emerald-800">{selectedFarmerFlocks.filter(f => f.status === 'Active' || !f.status).length} Batches</p>
            </div>

            <div className="space-y-1.5 p-4 bg-slate-100/30 rounded-2xl border border-slate-200/20">
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider flex items-center gap-1.5">
                <XCircle size={11} className="text-slate-400" /> Inactive Batches
              </p>
              <p className="text-sm font-black text-slate-600">{selectedFarmerFlocks.filter(f => f.status === 'Inactive' || f.status === 'Closed' || f.status === 'Lifted').length} Batches</p>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-1.5 p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/20">
              <p className="text-[10px] uppercase font-black text-indigo-600 tracking-wider flex items-center gap-1.5">
                <Package size={11} className="text-indigo-500" /> Farm Type Batch
              </p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-indigo-900">{farmer.farmType || 'Broiler Breeding'}</p>
                <Badge className="bg-indigo-100 text-indigo-805 hover:bg-indigo-200 border-none rounded-lg text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider">
                  Standard Quality
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Side Col - Cards for Active Batch, Total Bird Count, Feed Stock, and Medicine Stock */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
          
          {/* Active Batch Card */}
          <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-6 flex flex-col justify-between border border-slate-100 group relative overflow-hidden transition-all duration-300 hover:shadow-lg text-left">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-555/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <div className="flex justify-between items-center">
              <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 shrink-0">
                <Activity size={22} className="animate-pulse" />
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-none rounded-lg font-bold uppercase text-[9px] px-2 py-0.5">
                In Progress
              </Badge>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Batches</p>
              <h4 className="text-xl font-black text-slate-900 mt-1 truncate">
                {selectedFarmerFlocks.filter(f => f.status === 'Active' || !f.status).map(f => f.name || f.flockName || 'Unnamed Batch').join(', ') || 'No Active Batches'}
              </h4>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-50/50 px-2.5 py-1 rounded-xl inline-block">
                Healthy Mortality Threshold
              </p>
            </div>
          </Card>

          {/* Total Bird Card */}
          <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-6 flex flex-col justify-between border border-slate-100 group relative overflow-hidden transition-all duration-300 hover:shadow-lg text-left">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-555/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <div className="flex justify-between items-center">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 shrink-0">
                <Bird size={22} />
              </div>
              <span className="text-[10px] text-slate-400 font-bold">Live Status</span>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Live Birds</p>
              <h4 className="text-3xl font-black text-slate-900 mt-1">{selectedFarmerStats.totalBirds.toLocaleString()}</h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">
                Max Capacity limit: {Number(farmer.birdCapacity || 0).toLocaleString()}
              </p>
            </div>
          </Card>

          {/* Feed Stock Card */}
          <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-6 flex flex-col justify-between border border-slate-100 group relative overflow-hidden transition-all duration-300 hover:shadow-lg text-left">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-555/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <div className="flex justify-between items-center">
              <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 shrink-0">
                <Package size={22} />
              </div>
              <Badge className="bg-amber-50 text-amber-700 border-none rounded-lg font-bold text-[9px] px-2 py-0.5">
                Stock
              </Badge>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feed Stock On hand</p>
              <h4 className="text-3xl font-black text-slate-900 mt-1">{selectedFarmerStats.feedStock.toLocaleString()} KG</h4>
              <p className="text-xs text-slate-500 font-medium mt-2">
                Inventory value: <span className="font-bold text-slate-700">₹{selectedFarmerStats.feedValue.toLocaleString()}</span>
              </p>
            </div>
          </Card>

          {/* Medicine Stock Card */}
          <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-6 flex flex-col justify-between border border-slate-100 group relative overflow-hidden transition-all duration-300 hover:shadow-lg text-left">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-555/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <div className="flex justify-between items-center">
              <div className="bg-purple-50 p-3 rounded-2xl text-purple-600 shrink-0">
                <Pill size={22} />
              </div>
              <span className="text-[10px] text-violet-500 font-bold uppercase tracking-wider">Pharmacy</span>
            </div>
            <div className="mt-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicine & Vaccine Stock</p>
              <h4 className="text-3xl font-black text-slate-900 mt-1">
                {selectedFarmerStock.medicine.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0).toLocaleString()} Items
              </h4>
              <p className="text-[10px] text-slate-505 font-bold mt-2">
                {selectedFarmerStock.medicine.length} medical items cataloged
              </p>
            </div>
          </Card>

        </div>
      </div>

      {/* Middle Side - Show Batches List (Full Width) */}
      <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-8 border border-slate-100 text-left">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h4 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="text-emerald-555" size={20} />
              Farmer Batches & Flocks Menu
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Select or click on any batch/flock card below to load daily entries, metrics, and logs in the section below
            </p>
          </div>
          <div className="bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
            Total {selectedFarmerFlocks.length} batches
          </div>
        </div>

        {selectedFarmerFlocks.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
            <Package size={48} className="mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-600 text-sm">No batches managed for this farmer yet</p>
            <p className="text-xs text-slate-400 mt-1">Onboard batches under manager console or farm registration</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {selectedFarmerFlocks.map((flock) => {
              const isActive = flock.status === 'Active' || !flock.status;
              const isSelected = flock.id === currentFlockId;
              
              return (
                <div
                  key={flock.id}
                  onClick={() => setSelectedFlockId(flock.id)}
                  className={`relative cursor-pointer select-none rounded-[2rem] p-6 transition-all duration-300 border-2 text-left ${
                    isSelected 
                      ? 'bg-gradient-to-br from-emerald-50/40 to-emerald-50/20 border-emerald-505 shadow-lg shadow-emerald-50/50' 
                      : 'bg-white hover:bg-slate-50/50 border-slate-100 hover:border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <Badge className={`${
                      isActive ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-300 text-slate-700'
                    } border-none font-black text-[9px] rounded-lg tracking-wider px-2 py-0.5 uppercase`}>
                      {isActive ? 'Active' : 'Closed'}
                    </Badge>
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>
                    )}
                  </div>

                  <h5 className="font-black text-slate-900 mt-4 text-base tracking-tight leading-tight">
                    {flock.name || flock.flockName || 'Unnamed Batch'}
                  </h5>
                  
                  <div className="mt-4 space-y-2 text-xs font-medium text-slate-500">
                    <div className="flex justify-between">
                      <span>Initial Birds:</span>
                      <span className="font-bold text-slate-800">{(flock.initialCount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chicks Cost:</span>
                      <span className="font-bold text-slate-800">₹{(flock.chicksCost || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Breed:</span>
                      <span className="font-bold text-slate-800">{flock.breed || 'Cobb 500'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Placed</span>
                    <span className="font-mono text-slate-700">
                      {flock.placementDate ? format(new Date(flock.placementDate), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bottom Side - Selected Batch Full Details and Logs */}
      {selectedFlock && (
        <Card className="border-none shadow-md bg-white rounded-[2.5rem] p-8 border border-slate-100 space-y-8 animate-in fade-in duration-300 text-left">
          
          {/* Header with selected Flock stats */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                  {selectedFlock.name || selectedFlock.flockName || 'Selected Batch'} Details Analysis
                </h4>
                <Badge className="bg-indigo-50 text-indigo-750 font-bold border-none uppercase text-[9px] tracking-widest px-2.5 py-0.5">
                  Batch Records
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Consolidated daily entries, mortality records, feed, water intake, and health check-ins for {selectedFlock.name || 'this flock'}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleDownloadLogs}
                variant="outline" 
                size="sm" 
                className="rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 h-10 px-4"
              >
                <Download size={15} />
                Export CSV Records
              </Button>
            </div>
          </div>

          {/* Dynamic Batch Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            
            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Chicks Placed</p>
              <h6 className="text-lg font-black text-slate-800 mt-1">{(selectedFlock.initialCount || 0).toLocaleString()}</h6>
              <p className="text-[10px] text-slate-500 font-mono mt-1">Placed Live</p>
            </div>

            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Current LiveCount</p>
              <h6 className="text-lg font-black text-slate-800 mt-1">
                {selectedFlock.currentCount !== undefined ? selectedFlock.currentCount.toLocaleString() : (selectedFlock.initialCount || 0).toLocaleString()}
              </h6>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">In Shed</p>
            </div>

            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Mortality</p>
              <h6 className="text-lg font-black text-rose-600 mt-1">
                {(() => {
                  const totalChicks = Number(selectedFlock.initialCount) || 0;
                  const currentLive = Number(selectedFlock.currentCount) || totalChicks;
                  const mortCount = Math.max(0, totalChicks - currentLive);
                  const mortPct = totalChicks > 0 ? ((mortCount / totalChicks) * 100).toFixed(1) : '0';
                  return `${mortCount} (${mortPct}%)`;
                })()}
              </h6>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Total Deaths</p>
            </div>

            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Current Age</p>
              <h6 className="text-lg font-black text-indigo-700 mt-1">
                {(() => {
                  if (!selectedFlock.placementDate) return 'N/A';
                  const pDate = new Date(selectedFlock.placementDate);
                  const diff = new Date().getTime() - pDate.getTime();
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  return days > 0 ? `${days} Days` : '1 Day (Placed)';
                })()}
              </h6>
              <p className="text-[10px] text-slate-400 font-medium mt-1">Growth progression</p>
            </div>

            <div className="p-5 col-span-2 md:col-span-1 bg-[#122B21] text-white rounded-2xl">
              <p className="text-[10px] uppercase font-black text-emerald-300 tracking-wider">Breed Hatchery</p>
              <h6 className="text-sm font-black text-white mt-1.5 truncate">{selectedFlock.breed || 'Cobb 500 Breed'}</h6>
              <p className="text-[9px] text-emerald-100/70 font-medium mt-1.5">Elite Performance</p>
            </div>

          </div>

          {/* SEC 2: EXTENDED operational, financial & healthcare KPI cards */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h5 className="font-bold text-slate-800 tracking-tight text-xs uppercase flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" /> Operational & Financial Analytics KPIs
            </h5>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card 1: Current Weight */}
              <div className="p-5 bg-gradient-to-br from-emerald-50/20 to-slate-50/50 rounded-2xl border border-slate-100/80 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Current Weight</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <h6 className="text-xl font-black text-slate-900">
                    {currentWeightGramsFlock > 0 ? `${currentWeightGramsFlock.toLocaleString()} g` : 'N/A'}
                  </h6>
                  {currentWeightGramsFlock > 0 && (
                    <span className="text-[10px] text-slate-500 font-bold">({currentWeightKgFlock.toFixed(2)} kg)</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  {currentWeightGramsFlock > 0 ? 'From latest logged weight' : 'No weights reported yet'}
                </p>
              </div>

              {/* Card 2: FCR */}
              <div className="p-5 bg-gradient-to-br from-indigo-50/20 to-slate-50/50 rounded-2xl border border-slate-100/80 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Feed Conversion Ratio (FCR)</p>
                <h6 className="text-xl font-black text-indigo-705 text-indigo-600 mt-1">
                  {calculatedFCRFlock.toFixed(2)}
                </h6>
                <p className="text-[10px] text-slate-400 mt-1">
                  {totalFeedConsumedKgFlock > 0 ? 'Dynamic calculation' : 'Standard Cobb fallback'}
                </p>
              </div>

              {/* Card 3: Per Bird Cost */}
              <div className="p-5 bg-gradient-to-br from-amber-50/20 to-slate-50/50 rounded-2xl border border-slate-100/80 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Per Bird Cost</p>
                <h6 className="text-xl font-black text-amber-705 text-amber-600 mt-1">
                  ₹{perBirdCostValFlock.toFixed(2)}
                </h6>
                <p className="text-[10px] text-slate-400 mt-1">
                  Chicks, feed & Booster costs
                </p>
              </div>

              {/* Card 4: Per KG Cost */}
              <div className="p-5 bg-gradient-to-br from-teal-50/20 to-slate-50/50 rounded-2xl border border-slate-100/80 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Per KG Live Cost</p>
                <h6 className="text-xl font-black text-teal-600 mt-1">
                  ₹{perKgCostValFlock.toFixed(2)} / KG
                </h6>
                <p className="text-[10px] text-slate-400 mt-1">
                  Based on current flock biomass
                </p>
              </div>

              {/* Card 5: Livability Rate */}
              <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Livability Rate</p>
                <h6 className="text-xl font-black text-emerald-805 text-emerald-700 mt-1">
                  {livabilityRateFlock.toFixed(1)}%
                </h6>
                <p className="text-[10px] text-slate-400 mt-1">
                  Target threshold &gt; 95%
                </p>
              </div>

              {/* Card 6: Total Feed Used */}
              <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Feed Used</p>
                <h6 className="text-xl font-black text-slate-800 mt-1">
                  {totalFeedConsumedKgFlock.toLocaleString()} KG
                </h6>
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  Est. Cost: ₹{displayTotalFeedAmountFlock.toLocaleString()}
                </p>
              </div>

              {/* Card 7: Total Medicine Used */}
              <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100/60 font-medium text-left">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Med (Amount)</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <h6 className="text-lg font-black text-slate-800">
                    {totalMedicineLogsCountFlock} items
                  </h6>
                  <span className="text-[10.5px] text-teal-700 font-black">(₹{Math.round(medicineAmountTotalFlock).toLocaleString()})</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Administered medical boost
                </p>
              </div>

              {/* Card 8: Vaccinations Done (Clickable) */}
              <div 
                onClick={() => setShowVaccineModal(true)}
                className="p-5 bg-purple-50/50 hover:bg-purple-100/50 transition-all duration-300 rounded-2xl border border-purple-100 cursor-pointer shadow-inner relative group font-medium text-left animate-in"
              >
                <div className="absolute right-3 top-3 text-purple-600 animate-bounce">
                  <Info size={13} />
                </div>
                <p className="text-[10px] uppercase font-black text-purple-700 tracking-wider">Vaccinations Done</p>
                <h6 className="text-lg font-black text-purple-900 mt-1">
                  {completedVaccinesListFlock.length} Completed
                </h6>
                <p className="text-[9px] text-purple-600 font-bold mt-1.5 group-hover:underline">
                  Click to inspect timelines
                </p>
              </div>

            </div>
          </div>

          {/* SEC 3: Egg Production section ("Available Egg") */}
          <div className="pt-4 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* Egg KPI highlight card trigger */}
              <div 
                onClick={() => setShowEggDetails(!showEggDetails)}
                className={`md:col-span-4 p-6 rounded-3xl border cursor-pointer transition-all duration-300 select-none text-left ${
                  showEggDetails 
                    ? 'bg-gradient-to-br from-amber-50 to-amber-100/30 border-amber-300 shadow-md' 
                    : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                    <Egg size={22} />
                  </div>
                  <Badge className="bg-amber-100 text-amber-850 hover:bg-amber-200 text-amber-900 border-none font-bold text-[9px] uppercase tracking-wider">
                    {showEggDetails ? 'Close Details' : 'Click layout details'}
                  </Badge>
                </div>
                <div className="mt-5">
                  <p className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest">Available Eggs on hand</p>
                  <h4 className="text-3xl font-black text-slate-900 mt-1">
                    {availableEggsOnHandFlock.toLocaleString()} Eggs
                  </h4>
                  <p className="text-xs text-amber-700 font-bold mt-2 flex items-center gap-1.5">
                    <TrendingUp size={12} /> Laying Rate: {layingRatePercentFlock}%
                  </p>
                </div>
              </div>

              {/* Summary details or placeholder when egg details is collapsed */}
              <div className="md:col-span-8 space-y-4 text-left">
                {showEggDetails ? (
                  <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    <div className="flex justify-between items-center pb-4 border-b border-slate-200/60">
                      <div>
                        <h6 className="font-black text-slate-800 text-sm uppercase">Egg Production Metrics</h6>
                        <p className="text-[10px] text-slate-400 font-medium">Detailed 7-day average metrics and direct recording</p>
                      </div>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRecordEggModal(true);
                        }}
                        size="sm"
                        className="bg-amber-650 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4 flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus size={14} />
                        Record Egg Collection
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 text-left">
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Avg 7-day Eggs</p>
                        <p className="text-lg font-black text-slate-805 text-slate-800 mt-0.5">{avg7DayEggsFlock.toLocaleString()}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 text-left">
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Cost Per Egg (7d Avg)</p>
                        <p className="text-lg font-black text-amber-700 mt-0.5">₹{avgCostPerEggFlock.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 text-left">
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Laying Efficiency</p>
                        <p className="text-lg font-black text-emerald-700 mt-0.5">{layingRatePercentFlock}%</p>
                      </div>
                    </div>

                    {/* Daily collection spreadsheet */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Daily Eggs Collection Records</p>
                      {layerLogsMergedFlock.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-100 text-xs text-slate-400 italic font-bold">
                          No layer eggs collection registered for this batch yet
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto rounded-xl border border-slate-200/50 bg-white">
                          <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="text-[9px] font-black text-slate-500 py-3 uppercase text-left pl-4">Date</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 py-3 uppercase text-center">Eggs (G/B)</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 py-3 uppercase text-right">Daily Cost</TableHead>
                                <TableHead className="text-[9px] font-black text-slate-500 py-3 uppercase text-right pr-4">Cost / Egg</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {layerLogsMergedFlock.map((log, idx) => (
                                <TableRow key={log.id || idx} className="hover:bg-slate-50/40">
                                  <TableCell className="font-mono text-xs font-bold text-slate-650 text-slate-700 pl-4 text-left">
                                    {log.date ? format(new Date(log.date), 'yyyy-MM-dd') : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-xs text-center font-bold text-slate-800">
                                    {log.totalEggs} <span className="text-[10px] text-slate-400 font-medium">({log.goodEggs}G / {log.badEggs}B)</span>
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-medium text-slate-705 text-slate-600">
                                    ₹{log.dailyCost ? log.dailyCost.toLocaleString() : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-black text-emerald-700 pr-4">
                                    ₹{log.costPerEgg ? log.costPerEgg.toFixed(2) : '0.00'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 h-full flex flex-col justify-center text-left">
                    <p className="text-sm font-black text-slate-700 flex items-center gap-1.5 leading-none">
                      <Egg size={15} className="text-amber-500" /> Layer Production Monitor
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed font-semibold">
                      Click the <span className="font-black text-slate-700">Available Eggs</span> card to reveal dynamic daily statistics, collection diaries (healthy eggs vs damages), cost analysis metrics per egg, and average laying rates.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* SEC 4: Scheduling section */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-center text-left">
              <div>
                <h5 className="font-bold text-slate-800 tracking-tight text-xs uppercase flex items-center gap-1.5">
                  <Calendar size={14} className="text-indigo-500" /> Flock Medication & Vaccination Roadmap
                </h5>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Setup active healthcare reminders, vaccines, booster routines</p>
              </div>
              <Button 
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs h-9 px-4 flex items-center gap-1 shadow-sm"
              >
                <Plus size={14} />
                {showScheduleForm ? 'Close Scheduler' : 'Schedule Option'}
              </Button>
            </div>

            {/* Schedule new action form */}
            {showScheduleForm && (
              <form onSubmit={handleCreateSchedAction} className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-6 space-y-4 animate-in md:scale-95 duration-200 text-left">
                <div className="flex items-center gap-2 pb-2 border-b border-indigo-100/50">
                  <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest leading-none">Schedule medicine & immunization</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Type</label>
                    <select 
                      value={schedType} 
                      onChange={e => setSchedType(e.target.value as any)}
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs font-bold text-slate-850 text-slate-800"
                    >
                      <option value="Vaccination">Vaccination</option>
                      <option value="Medicine">Medicine</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Booster / Vaccine Name</label>
                    <input 
                      type="text" 
                      required 
                      value={schedItemName} 
                      onChange={e => setSchedItemName(e.target.value)}
                      placeholder="e.g. Lasota F1, Vitamin-B Complex"
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Target Date</label>
                    <input 
                      type="date" 
                      required 
                      value={schedDate} 
                      onChange={e => setSchedDate(e.target.value)}
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 font-sans">Target Bird Age (Days)</label>
                    <input 
                      type="number" 
                      value={schedAge} 
                      onChange={e => setSchedAge(e.target.value)}
                      placeholder="e.g. 14"
                      className="w-full h-10 rounded-xl bg-white border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                    />
                  </div>

                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Administration instructions / notes</label>
                  <textarea 
                    value={schedNotes} 
                    onChange={e => setSchedNotes(e.target.value)}
                    placeholder="Mix with water, restrict morning feed..."
                    className="w-full rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-800 font-bold min-h-[60px]"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <Button 
                    type="submit" 
                    disabled={schedLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs h-10 px-6 cursor-pointer"
                  >
                    {schedLoading ? "Scheduling..." : "Save Scheduled Task"}
                  </Button>
                </div>
              </form>
            )}

            {/* List active and completed schedules */}
            {selectedFlockSchedules.length === 0 ? (
              <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150 text-xs italic text-slate-400 font-semibold">
                No active schedules or routines set for this flock yet
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedFlockSchedules.map((item) => {
                  const isCompleted = item.status === 'Completed' || item.status === 'Done';
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl border flex justify-between items-start text-left ${
                        isCompleted 
                          ? 'bg-slate-50/40 border-slate-100/80 grayscale opacity-60' 
                          : 'bg-indigo-50/10 border-indigo-150 border-indigo-100'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-slate-400' : 'bg-indigo-500 animate-pulse'}`}></span>
                          <span className="text-[9px] uppercase font-black text-slate-400">{item.type}</span>
                          <Badge className={`${isCompleted ? 'bg-slate-100 text-slate-650' : 'bg-indigo-50 text-indigo-700'} border-none text-[8px] font-black px-1.5 py-0.2 ml-1`}>
                            {item.status ? item.status : 'Active'}
                          </Badge>
                        </div>
                        <h6 className="font-bold text-slate-805 text-slate-850 text-slate-900 text-sm leading-tight">{item.itemName || item.title || 'Booster'}</h6>
                        <p className="text-[10px] text-slate-505 text-slate-500 leading-normal font-medium">{item.description}</p>
                        
                        <div className="flex gap-4 pt-1 text-[9px] font-bold text-slate-400 leading-none">
                          <span>Target: {item.startDate}</span>
                          <span>Age: {item.age} Days</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {!isCompleted && (
                          <button 
                            type="button" 
                            onClick={() => handleCompleteSched(item.id)}
                            className="bg-emerald-50 text-emerald-650 text-emerald-600 font-bold p-1 px-1.5 hover:bg-emerald-100/80 rounded-lg text-[9px] uppercase border-none cursor-pointer tracking-wider"
                          >
                            Mark Complete
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleDeleteSched(item.id)}
                          className="text-slate-400 p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border-none"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Batch Daily Logs Excel Spreadsheet */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center text-left">
              <h5 className="font-bold text-slate-800 tracking-tight text-sm uppercase">Batch Daily Intake & Health Logs</h5>
              <Badge className="bg-slate-100 text-slate-600 border-none rounded-lg text-[10px] font-bold">
                {selectedFlockLogs.length} Entries Available
              </Badge>
            </div>

            {selectedFlockLogs.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                <Package size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="font-bold text-slate-400 text-xs italic">No daily logs reported for this batch yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Once the farmer enters log records, they will reflect here instantly.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 pl-6 text-left">Date</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Age</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Mortality</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Feed Intake (KG)</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Feed Type</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Water Intake (L)</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Avg Weight (G)</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-left">Medicine</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-4 text-right pr-6">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFlockLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/40 border-stone-100">
                        <TableCell className="font-mono text-slate-700 font-bold text-xs py-4 pl-6 text-left">
                          {log.date ? format(new Date(log.date), 'yyyy-MM-dd') : 'N/A'}
                        </TableCell>
                        <TableCell className="font-bold text-slate-800 text-xs text-left">
                          {log.age !== undefined ? `${log.age} Days` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs text-left">
                          {log.health?.mortality > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                              +{log.health.mortality} birds
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">0</span>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-slate-700 text-xs text-left">
                          {log.consumption?.feedIntake ? `${log.consumption.feedIntake} KG` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium text-slate-500 text-left">
                          {log.consumption?.feedType || 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-600 text-left">
                          {log.consumption?.waterIntake ? `${log.consumption.waterIntake} L` : 'N/A'}
                        </TableCell>
                        <TableCell className="font-bold text-indigo-700 text-xs text-left">
                          {log.production?.avgWeight ? `${log.production.avgWeight}g` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs text-left font-sans">
                          {(() => {
                            const meds = log.health?.medicines;
                            const vacs = log.health?.vaccines;
                            let items: string[] = [];
                            if (Array.isArray(meds)) {
                              meds.forEach((m: any) => { if (m.name && m.name !== 'none' && m.name !== 'None') items.push(`${m.name} (${m.doses || 0})`); });
                            } else if (meds && meds !== 'none' && meds !== 'None' && meds !== '') {
                              items.push(`${meds} (${log.health?.medicineDoses || 0})`);
                            }
                            if (Array.isArray(vacs)) {
                              vacs.forEach((v: any) => { if (v.name && v.name !== 'none' && v.name !== 'None') items.push(`${v.name} (${v.doses || 0})`); });
                            } else if (vacs && vacs !== 'none' && vacs !== 'None' && vacs !== '') {
                              items.push(`${vacs} (${log.health?.vaccineDoses || 0})`);
                            }
                            
                            if (items.length === 0) return <span className="text-slate-400">-</span>;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {items.map((it, idx) => (
                                  <Badge key={idx} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none rounded-lg text-[9px] font-bold">
                                    {it}
                                  </Badge>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-slate-505 max-w-[180px] truncate text-right pr-6" title={log.notes}>
                          {log.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

        </Card>
      )}

      {/* MODAL 1: Click to inspect Vaccination Timeline Records */}
      {showVaccineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative text-left space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <div>
                <h4 className="text-lg font-black text-slate-900 tracking-tight">Active & Historical Vaccination timeline</h4>
                <p className="text-[11px] text-slate-400 font-medium">Timestamps, developmental bird age, and duration calculations</p>
              </div>
              <button 
                onClick={() => setShowVaccineModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {completedVaccinesListFlock.length === 0 ? (
              <div className="py-12 text-center text-xs italic text-slate-400 font-bold">
                No vaccinations recorded in the daily health logs for this batch yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100 max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold text-slate-400 py-3 uppercase text-left pl-4">Vaccine Name</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 py-3 uppercase text-left">Date Performed</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 py-3 uppercase text-left">Bird Age</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 py-3 uppercase text-right pr-4">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedVaccinesListFlock.map((v, i) => (
                      <TableRow key={i} className="hover:bg-slate-50/40">
                        <TableCell className="font-bold text-slate-900 text-xs pl-4 text-left py-3.5">
                          {v.name}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 text-left">
                          {v.date}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-indigo-700 text-left">
                          {v.age}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold text-emerald-700 text-right pr-4">
                          {v.daysSince}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button 
                onClick={() => setShowVaccineModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold h-10 px-6 rounded-xl text-xs cursor-pointer"
              >
                Close Records
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Layer Egg Collection */}
      {showRecordEggModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleAddEggRecord}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-left space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <div>
                <h4 className="text-lg font-black text-slate-905 text-slate-900 tracking-tight">Record Layer Egg Collection</h4>
                <p className="text-[11px] text-slate-400 font-medium">Input good/damaged eggs collection rates for active laying session</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowRecordEggModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Collection Date</label>
                <input 
                  type="date" 
                  required
                  value={eggRecordDate}
                  onChange={e => setEggRecordDate(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50/50 border border-slate-200 px-3 text-xs text-slate-805 text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Good Eggs Collected</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="e.g. 500"
                  value={eggRecordGood}
                  onChange={e => setEggRecordGood(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50/50 border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Bad / Cracked Eggs</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder="e.g. 12"
                  value={eggRecordBad}
                  onChange={e => setEggRecordBad(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50/50 border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Average Weight per Egg (grams)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 58"
                  value={eggRecordWeight}
                  onChange={e => setEggRecordWeight(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50/50 border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Estimated Cost (₹ Feed/Labor)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 1500"
                  value={eggRecordCost}
                  onChange={e => setEggRecordCost(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50/50 border border-slate-200 px-3 text-xs text-slate-800 font-bold"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Laying Batch Quality Grade</label>
                <select 
                  value={eggRecordQuality}
                  onChange={e => setEggRecordQuality(e.target.value)}
                  className="w-full h-10 bg-slate-50/50 text-slate-800 text-xs font-bold px-3 rounded-xl border border-slate-200"
                >
                  <option value="Premium Grade A">Premium Grade A</option>
                  <option value="Standard Grade B">Standard Grade B</option>
                  <option value="Sub-standard / Defective">Sub-standard / Defective</option>
                </select>
              </div>

            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowRecordEggModal(false)}
                className="rounded-xl font-bold h-10 px-5 text-xs text-slate-600 cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={eggRecordLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 px-6 rounded-xl text-xs cursor-pointer shadow-md"
              >
                {eggRecordLoading ? 'Saving Entry...' : 'Save Egg Record'}
              </Button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default FarmerDetails;
