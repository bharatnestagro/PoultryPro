import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Bird, Thermometer, Utensils, Scale, Pill, 
  ShieldCheck, IndianRupee, AlertTriangle, Plus, Save,
  Package, Droplets, Edit2, Trash2, ArrowDownRight, FileText, ShoppingBag,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const AddData: React.FC = () => {
  const { user } = useAuth();
  const [flocks, setFlocks] = useState<any[]>([]);
  const [soldFlocks, setSoldFlocks] = useState<any[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [medicineStock, setMedicineStock] = useState<any[]>([]);
  const [feedStock, setFeedStock] = useState<any[]>([]);
  const [editingFlock, setEditingFlock] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [historyFilter, setHistoryFilter] = useState('daily');
  const [reportFlockId, setReportFlockId] = useState<string | null>(null);

  const historyFilters = [
    { id: 'daily', title: 'Daily Data', icon: ClipboardList, color: 'emerald' },
    { id: 'medicine', title: 'Medicine Log', icon: Pill, color: 'blue' },
    { id: 'feed', title: 'Feed Log', icon: Utensils, color: 'amber' },
    { id: 'alerts', title: 'Alerts', icon: AlertTriangle, color: 'red' },
    { id: 'sold', title: 'Sold Flock', icon: ShoppingBag, color: 'purple' },
    { id: 'financial', title: 'Financial Log', icon: IndianRupee, color: 'slate' },
  ];

  const renderSavedTransactions = () => {
    if (transactions.length === 0) return null;

    return (
      <div className="mt-10 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <IndianRupee size={18} className="text-emerald-700" />
          Recent Transactions
        </h3>
        <div className="space-y-3">
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-slate-900">{tx.description || tx.category}</p>
                <p className={`text-xs font-bold ${tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {tx.type === 'Income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500">{format(new Date(tx.date), 'MMM dd, yyyy')}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(tx)} className="h-8 w-8 rounded-full">
                  <Edit2 size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(tx.id)} className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSavedLogs = (category: string) => {
    let categoryLogs = logs.filter(log => log.flockId === selectedFlockId);
    
    if (category === 'Alerts') {
      categoryLogs = categoryLogs.filter(log => 
        log.alerts?.feedDrop || 
        log.alerts?.mortalityIncrease || 
        log.alerts?.eggDrop || 
        (log.alerts?.abnormalBehavior && log.alerts.abnormalBehavior.trim() !== '')
      );
    }

    if (categoryLogs.length === 0) return null;

    return (
      <div className="mt-10 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <Save size={18} className="text-emerald-600" />
          Recent {category} Records
        </h3>
        <div className="space-y-3">
          {categoryLogs.slice(0, 10).map(log => {
            let valueDisplay = '';
            if (category === 'Daily Data') {
              const feed = log.consumption?.feedIntake ? `${log.consumption.feedIntake}kg ${log.consumption.feedType}` : '';
              const eggs = log.production?.eggCount ? `, ${log.production.eggCount} Eggs` : '';
              const mortality = log.health?.mortality ? `, ${log.health.mortality} Deaths` : '';
              valueDisplay = `${feed}${eggs}${mortality}` || 'Daily Record';
            } else if (category === 'Alerts') {
              const activeAlerts = [];
              if (log.alerts?.feedDrop) activeAlerts.push('Feed Drop');
              if (log.alerts?.mortalityIncrease) activeAlerts.push('Mortality Spike');
              if (log.alerts?.eggDrop) activeAlerts.push('Egg Drop');
              if (log.alerts?.abnormalBehavior) activeAlerts.push(log.alerts.abnormalBehavior);
              valueDisplay = activeAlerts.join(', ') || 'No Alerts Detected';
            } else {
              if (category === 'Environment') valueDisplay = `${log.environment?.temperature}°C, ${log.environment?.humidity}% Hum`;
              if (category === 'Feed & Water') valueDisplay = `${log.consumption?.feedIntake}kg Feed, ${log.consumption?.waterIntake}L Water`;
              if (category === 'Production') valueDisplay = `${log.production?.avgWeight}g Avg, ${log.production?.eggCount || 0} Eggs`;
              if (category === 'Health') valueDisplay = `${log.health?.mortality} Deaths, ${log.health?.vaccines || 'No Vaccine'}`;
              if (category === 'Biosecurity') valueDisplay = `Cleaning: ${log.biosecurity?.cleaning ? 'Yes' : 'No'}, Visitors: ${log.biosecurity?.visitors}`;
            }

            return (
              <div key={log.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-emerald-200 transition-colors">
                <div>
                  <p className="text-sm font-bold text-slate-900">{valueDisplay}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{format(new Date(log.date), 'MMM dd, yyyy')} • {log.timestamp ? format(new Date(log.timestamp), 'hh:mm a') : 'No time'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingLog(log)} className="h-8 w-8 rounded-full hover:bg-emerald-50 hover:text-emerald-600">
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id)} className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const categories = [
    { id: 'daily_data', title: 'Add Daily Data', icon: FileText, color: 'bg-emerald-600', desc: 'Daily feed, growth, health & production' },
    { id: 'flock', title: 'Flock Details', icon: Bird, color: 'bg-blue-600', desc: 'Register new batches' },
    { id: 'sold_flock', title: 'Sold Flock', icon: ShoppingBag, color: 'bg-amber-600', desc: 'Record flock sales & closing' },
    { id: 'alerts', title: 'Alerts', icon: AlertTriangle, color: 'bg-red-600', desc: 'Warning signals' },
    { id: 'medicine_stock', title: 'Medicine Stock', icon: Pill, color: 'bg-purple-600', desc: 'Manage medicines' },
    { id: 'feed_stock', title: 'Feed Stock', icon: Package, color: 'bg-orange-600', desc: 'Manage feed inventory' },
    { id: 'finance', title: 'Financials', icon: IndianRupee, color: 'bg-emerald-500', desc: 'Costs & sales' },
    { id: 'logs_history', title: 'Logs History', icon: FileText, color: 'bg-slate-700', desc: 'View, edit & delete records' },
    { id: 'analyze', title: 'Analyze', icon: FileText, color: 'bg-indigo-600', desc: 'Full-fledged analytics' },
  ];

  // Form States
  const [flockData, setFlockData] = useState({
    name: '',
    breed: 'Broiler',
    otherBreed: '',
    placementDate: format(new Date(), 'yyyy-MM-dd'),
    initialCount: '',
    initialAvgWeight: '',
    source: '',
    farmType: '',
    chicksCost: '',
  });

  const [dailyLog, setDailyLog] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    environment: { temperature: '', humidity: '', ventilation: 'Good', lightDuration: '', ammoniaLevel: 'Low' },
    consumption: { feedIntake: '', feedType: 'Starter', waterIntake: '', fcr: '' },
    production: { avgWeight: '', weightGain: '', eggCount: '', eggWeight: '', eggQuality: 'Good', badEggs: '' },
    health: { vaccines: '', vaccineDoses: '', medicines: '', medicineDoses: '', symptoms: '', mortality: '', culling: '' },
    biosecurity: { cleaning: false, disinfection: false, visitors: '0', footbath: false },
    alerts: { feedDrop: false, mortalityIncrease: false, eggDrop: false, abnormalBehavior: '' }
  });

  const [transactionData, setTransactionData] = useState({
    type: 'Expense',
    category: 'Feed',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const [newMedicine, setNewMedicine] = useState({
    name: '',
    type: 'Medicine',
    quantity: '',
    unit: 'ml',
    purchaseCost: '',
    expiryDate: '',
  });

  const [newFeed, setNewFeed] = useState({
    name: '',
    type: 'Starter',
    quantity: '',
    purchaseCost: '',
  });

  const [soldFlockData, setSoldFlockData] = useState({
    saleType: 'Full',
    saleDate: format(new Date(), 'yyyy-MM-dd'),
    birdsSold: '',
    totalWeight: '',
    pricePerKg: '',
    totalPrice: '',
    buyerName: '',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'flocks'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allFlocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeList = allFlocks.filter((f: any) => f.status === 'Active');
      const soldList = allFlocks.filter((f: any) => f.status === 'Sold');
      
      setFlocks(activeList);
      setSoldFlocks(soldList);
      
      if (activeList.length > 0 && !selectedFlockId) {
        setSelectedFlockId(activeList[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'flocks'));

    const qMed = query(collection(db, 'medicineStock'), where('userId', '==', user.uid));
    const unsubMed = onSnapshot(qMed, (snapshot) => {
      setMedicineStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    const qFeed = query(collection(db, 'feedStock'), where('userId', '==', user.uid));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      setFeedStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const qLogs = query(collection(db, 'dailyLogs'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    const qTxs = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTxs = onSnapshot(qTxs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid index requirements for now
      setTransactions(list.sort((a: any, b: any) => new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    return () => {
      unsubscribe();
      unsubMed();
      unsubFeed();
      unsubLogs();
      unsubTxs();
    };
  }, [user]);

  const handleCreateFlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'flocks'), {
        ...flockData,
        userId: user.uid,
        breed: flockData.breed === 'Other' ? flockData.otherBreed : flockData.breed,
        initialCount: Number(flockData.initialCount) || 0,
        currentCount: Number(flockData.initialCount) || 0,
        initialAvgWeight: Number(flockData.initialAvgWeight) || 0,
        chicksCost: Number(flockData.chicksCost) || 0,
        status: 'Active',
        createdAt: new Date().toISOString(),
      });
      toast.success('Flock created successfully');
      setSelectedFlockId(docRef.id);
      setActiveTab('environment');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'flocks');
      toast.error('Failed to create flock');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingFlock) return;
    setLoading(true);
    try {
      const flockRef = doc(db, 'flocks', editingFlock.id);
      await updateDoc(flockRef, {
        ...editingFlock,
        initialCount: Number(editingFlock.initialCount) || 0,
        currentCount: Number(editingFlock.currentCount) || 0,
        initialAvgWeight: Number(editingFlock.initialAvgWeight) || 0,
        chicksCost: Number(editingFlock.chicksCost) || 0,
      });
      toast.success('Flock updated successfully');
      setEditingFlock(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'flocks');
      toast.error('Failed to update flock');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFlock = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'flocks', id));
      toast.success('Flock deleted successfully');
      if (selectedFlockId === id) setSelectedFlockId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'flocks');
      toast.error('Failed to delete flock');
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dailyLogs', id));
      toast.success('Record deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'dailyLogs');
      toast.error('Failed to delete record');
    }
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingLog) return;
    setLoading(true);
    try {
      const logRef = doc(db, 'dailyLogs', editingLog.id);
      const updatedLog = {
        ...editingLog,
        environment: {
          ...editingLog.environment,
          temperature: Number(editingLog.environment?.temperature) || 0,
          humidity: Number(editingLog.environment?.humidity) || 0,
        },
        consumption: {
          ...editingLog.consumption,
          feedIntake: Number(editingLog.consumption?.feedIntake) || 0,
          waterIntake: Number(editingLog.consumption?.waterIntake) || 0,
        },
        production: {
          ...editingLog.production,
          avgWeight: Number(editingLog.production?.avgWeight) || 0,
          eggCount: Number(editingLog.production?.eggCount) || 0,
          eggWeight: Number(editingLog.production?.eggWeight) || 0,
          badEggs: Number(editingLog.production?.badEggs) || 0,
        },
        health: {
          ...editingLog.health,
          mortality: Number(editingLog.health?.mortality) || 0,
          culling: Number(editingLog.health?.culling) || 0,
          vaccineDoses: Number(editingLog.health?.vaccineDoses) || 0,
          medicineDoses: Number(editingLog.health?.medicineDoses) || 0,
        },
        biosecurity: {
          ...editingLog.biosecurity,
          visitors: Number(editingLog.biosecurity?.visitors) || 0,
        }
      };
      await updateDoc(logRef, updatedLog);
      toast.success('Record updated successfully');
      setEditingLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'dailyLogs');
      toast.error('Failed to update record');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      toast.success('Transaction deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
      toast.error('Failed to delete transaction');
    }
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'transactions', editingTransaction.id), editingTransaction);
      toast.success('Transaction updated successfully');
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
      toast.error('Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedicineStock = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'medicineStock', id));
      toast.success('Medicine deleted from stock');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'medicineStock');
      toast.error('Failed to delete medicine');
    }
  };

  const handleDeleteFeedStock = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'feedStock', id));
      toast.success('Feed deleted from stock');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'feedStock');
      toast.error('Failed to delete feed');
    }
  };

  const handleSaveMedicineStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const medQty = Number(newMedicine.quantity) || 0;
      const cost = Number(newMedicine.purchaseCost) || 0;
      const date = new Date().toISOString();

      // 1. Add to Medicine Stock
      await addDoc(collection(db, 'medicineStock'), {
        ...newMedicine,
        userId: user.uid,
        quantity: medQty,
        purchaseCost: cost,
        createdAt: date,
      });

      // 2. Create Transaction if cost is provided
      if (cost > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'Expense',
          category: 'Medicine',
          amount: cost,
          description: `Purchase of ${medQty}${newMedicine.unit} ${newMedicine.name} (${newMedicine.type})`,
          date: format(new Date(), 'yyyy-MM-dd'),
          createdAt: date,
        });
        toast.success('Medicine added and transaction recorded');
      } else {
        toast.success('Medicine added to stock');
      }

      setNewMedicine({ name: '', type: 'Medicine', quantity: '', unit: 'ml', purchaseCost: '', expiryDate: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'medicineStock');
      toast.error('Failed to add medicine');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const feedQty = Number(newFeed.quantity) || 0;
      const cost = Number(newFeed.purchaseCost) || 0;
      const date = new Date().toISOString();

      // 1. Add to Feed Stock
      await addDoc(collection(db, 'feedStock'), {
        ...newFeed,
        userId: user.uid,
        quantity: feedQty,
        purchaseCost: cost,
        createdAt: date,
      });

      // 2. Create Transaction if cost is provided
      if (cost > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'Expense',
          category: 'Feed',
          amount: cost,
          description: `Purchase of ${feedQty}kg ${newFeed.name} (${newFeed.type})`,
          date: format(new Date(), 'yyyy-MM-dd'),
          createdAt: date,
        });
        toast.success('Feed added and transaction recorded');
      } else {
        toast.success('Feed added to stock');
      }

      setNewFeed({ name: '', type: 'Starter', quantity: '', purchaseCost: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'feedStock');
      toast.error('Failed to add feed');
    } finally {
      setLoading(false);
    }
  };

  const handleSoldFlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFlockId) {
      toast.error('Please select a flock first');
      return;
    }
    setLoading(true);
    try {
      const flockRef = doc(db, 'flocks', selectedFlockId);
      const currentFlock = flocks.find(f => f.id === selectedFlockId);
      const birdsSold = Number(soldFlockData.birdsSold) || 0;
      const currentCount = Number(currentFlock?.currentCount) || 0;

      if (soldFlockData.saleType === 'Partial' && birdsSold >= currentCount) {
        toast.error('Birds sold cannot exceed or equal available birds in partial sale. Use "Full Sale" instead.');
        setLoading(false);
        return;
      }

      const updateData: any = {
        saleDetails: {
          ...soldFlockData,
          birdsSold: birdsSold,
          totalWeight: Number(soldFlockData.totalWeight) || 0,
          totalPrice: Number(soldFlockData.totalPrice) || 0,
          pricePerKg: Number(soldFlockData.pricePerKg) || 0,
        },
        lastSaleAt: new Date().toISOString(),
      };

      if (soldFlockData.saleType === 'Full') {
        updateData.status = 'Sold';
        updateData.soldAt = new Date().toISOString();
        updateData.currentCount = 0;
      } else {
        updateData.currentCount = Math.max(0, currentCount - birdsSold);
      }
      
      await updateDoc(flockRef, updateData);
      
      // Also record as a transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        flockId: selectedFlockId,
        type: 'Income',
        category: 'Flock Sale',
        amount: Number(soldFlockData.totalPrice) || 0,
        description: `${soldFlockData.saleType} Sale of flock: ${currentFlock?.name || 'Unknown'}. Birds: ${birdsSold}, Weight: ${soldFlockData.totalWeight}kg. Buyer: ${soldFlockData.buyerName}`,
        date: soldFlockData.saleDate,
        createdAt: new Date().toISOString(),
      });

      toast.success(soldFlockData.saleType === 'Full' ? 'Flock marked as sold and closed' : 'Partial sale recorded');
      if (soldFlockData.saleType === 'Full') setActiveTab(null);
      
      setSoldFlockData({
        saleType: 'Full',
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        birdsSold: '',
        totalWeight: '',
        pricePerKg: '',
        totalPrice: '',
        buyerName: '',
        notes: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'flocks');
      toast.error('Failed to record sale');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDailyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFlockId) {
      toast.error('Please select a flock first');
      return;
    }
    setLoading(true);
    try {
      const currentFlock = flocks.find(f => f.id === selectedFlockId);
      if (!currentFlock) throw new Error('Flock not found');

      const todayFeed = Number(dailyLog.consumption.feedIntake) || 0;
      const feedType = dailyLog.consumption.feedType;
      const vaccineName = dailyLog.health.vaccines;
      const vaccineDoses = Number(dailyLog.health.vaccineDoses) || 0;
      const medicineName = dailyLog.health.medicines;
      const medicineDoses = Number(dailyLog.health.medicineDoses) || 0;

      // --- Stock Validation ---
      if (todayFeed > 0) {
        const stockItem = feedStock.find(s => s.type === feedType);
        const available = Number(stockItem?.quantity) || 0;
        if (!stockItem || available < todayFeed) {
          toast.error(`Insufficient ${feedType} feed in stock. Available: ${available}kg`);
          setLoading(false);
          return;
        }
      }

      if (vaccineName && vaccineName !== 'none' && vaccineDoses > 0) {
        const medItem = medicineStock.find(m => m.name === vaccineName && m.type === 'Vaccine');
        const available = Number(medItem?.quantity) || 0;
        if (!medItem || available < vaccineDoses) {
          toast.error(`Insufficient ${vaccineName} vaccine in stock. Available: ${available} doses`);
          setLoading(false);
          return;
        }
      }

      if (medicineName && medicineName !== 'none' && medicineDoses > 0) {
        const medItem = medicineStock.find(m => m.name === medicineName && m.type === 'Medicine');
        const available = Number(medItem?.quantity) || 0;
        if (!medItem || available < medicineDoses) {
          toast.error(`Insufficient ${medicineName} medicine in stock. Available: ${available} units`);
          setLoading(false);
          return;
        }
      }
      // --- End Stock Validation ---

      const avgWeightG = Number(dailyLog.production.avgWeight) || 0;
      
      // 1. Calculate Total Feed Consumed so far (including today)
      const logsQuery = query(collection(db, 'dailyLogs'), where('userId', '==', user.uid), where('flockId', '==', selectedFlockId));
      const logsSnapshot = await getDocs(logsQuery);
      let totalFeed = logsSnapshot.docs.reduce((sum, doc) => sum + (Number(doc.data().consumption?.feedIntake) || 0), 0);
      totalFeed += todayFeed;

      // 2. Calculate FCR if avgWeight is provided
      // FCR = Total Feed (kg) / Total Biomass (kg)
      // Total Biomass = (Avg Weight in g / 1000) * Current Bird Count
      let calculatedFCR = 0;
      const currentCount = Number(currentFlock.currentCount) || Number(currentFlock.initialCount) || 0;
      if (avgWeightG > 0 && currentCount > 0) {
        const totalBiomassKg = (avgWeightG / 1000) * currentCount;
        calculatedFCR = totalFeed / totalBiomassKg;
      }

      // Convert strings to numbers where necessary
      const formattedLog = {
        ...dailyLog,
        userId: user.uid,
        flockId: selectedFlockId,
        environment: {
          ...dailyLog.environment,
          temperature: Number(dailyLog.environment.temperature) || 0,
          humidity: Number(dailyLog.environment.humidity) || 0,
          lightDuration: Number(dailyLog.environment.lightDuration) || 0,
        },
        consumption: {
          ...dailyLog.consumption,
          feedIntake: todayFeed,
          waterIntake: Number(dailyLog.consumption.waterIntake) || 0,
          fcr: calculatedFCR || Number(dailyLog.consumption.fcr) || 0,
        },
        production: {
          ...dailyLog.production,
          avgWeight: avgWeightG,
          weightGain: Number(dailyLog.production.weightGain) || 0,
          eggCount: Number(dailyLog.production.eggCount) || 0,
          eggWeight: Number(dailyLog.production.eggWeight) || 0,
          badEggs: Number(dailyLog.production.badEggs) || 0,
        },
        health: {
          ...dailyLog.health,
          mortality: Number(dailyLog.health.mortality) || 0,
          culling: Number(dailyLog.health.culling) || 0,
        },
        biosecurity: {
          ...dailyLog.biosecurity,
          visitors: Number(dailyLog.biosecurity.visitors) || 0,
        },
        timestamp: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, 'dailyLogs'), formattedLog);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'dailyLogs');
        throw error;
      }
      
      // 3. Update Feed Stock
      if (todayFeed > 0) {
        const feedType = dailyLog.consumption.feedType;
        const stockItem = feedStock.find(s => s.type === feedType);
        if (stockItem) {
          try {
            const stockRef = doc(db, 'feedStock', stockItem.id);
            const currentStockQty = Number(stockItem.quantity) || 0;
            await updateDoc(stockRef, {
              quantity: Math.max(0, currentStockQty - todayFeed)
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'feedStock');
            // We log but don't throw to allow the rest of the process to continue
            console.error('Failed to update feed stock:', error);
          }
        }
      }

      // 3.1 Update Medicine/Vaccine Stock
      if (dailyLog.health.vaccines && dailyLog.health.vaccines !== 'none') {
        const medItem = medicineStock.find(m => m.name === dailyLog.health.vaccines && m.type === 'Vaccine');
        if (medItem) {
          try {
            const medRef = doc(db, 'medicineStock', medItem.id);
            const doses = Number(dailyLog.health.vaccineDoses) || 1;
            const currentMedQty = Number(medItem.quantity) || 0;
            await updateDoc(medRef, {
              quantity: Math.max(0, currentMedQty - doses)
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'medicineStock');
            console.error('Failed to update vaccine stock:', error);
          }
        }
      }

      if (dailyLog.health.medicines && dailyLog.health.medicines !== 'none') {
        const medItem = medicineStock.find(m => m.name === dailyLog.health.medicines && m.type === 'Medicine');
        if (medItem) {
          try {
            const medRef = doc(db, 'medicineStock', medItem.id);
            const doses = Number(dailyLog.health.medicineDoses) || 1;
            const currentMedQty = Number(medItem.quantity) || 0;
            await updateDoc(medRef, {
              quantity: Math.max(0, currentMedQty - doses)
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, 'medicineStock');
            console.error('Failed to update medicine stock:', error);
          }
        }
      }

      // 4. Update Flock Data (Current Count, FCR, Mortality, Production Rate)
      try {
        const flockRef = doc(db, 'flocks', selectedFlockId);
        const updateData: any = {};
        
        const newMortality = (Number(currentFlock.totalMortality) || 0) + formattedLog.health.mortality + formattedLog.health.culling;
        const newEggs = (Number(currentFlock.totalEggs) || 0) + (formattedLog.production.eggCount || 0);
        const newDays = (Number(currentFlock.daysCount) || 0) + 1;
        
        updateData.totalMortality = newMortality;
        updateData.totalEggs = newEggs;
        updateData.daysCount = newDays;
        updateData.currentCount = currentCount - formattedLog.health.mortality - formattedLog.health.culling;
        
        if (calculatedFCR > 0) {
          updateData.currentFCR = Number(calculatedFCR.toFixed(2));
        }

        // Calculate production rate for layers
        if (currentFlock.breed === 'Layer' && updateData.currentCount > 0) {
          // Daily average production rate
          updateData.productionRate = (newEggs / (updateData.currentCount * newDays)) * 100;
        }

        if (formattedLog.production.avgWeight > 0) {
          updateData.currentWeight = formattedLog.production.avgWeight;
        }

        await updateDoc(flockRef, updateData);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'flocks');
        console.error('Failed to update flock data:', error);
      }

      // Reset form
      setDailyLog({
        date: format(new Date(), 'yyyy-MM-dd'),
        environment: { temperature: '', humidity: '', ventilation: 'Good', lightDuration: '', ammoniaLevel: 'Low' },
        consumption: { feedIntake: '', feedType: 'Starter', waterIntake: '', fcr: '' },
        production: { avgWeight: '', weightGain: '', eggCount: '', eggWeight: '', eggQuality: 'Good', badEggs: '' },
        health: { vaccines: '', vaccineDoses: '', medicines: '', medicineDoses: '', symptoms: '', mortality: '', culling: '' },
        biosecurity: { cleaning: false, disinfection: false, visitors: '0', footbath: false },
        alerts: { feedDrop: false, mortalityIncrease: false, eggDrop: false, abnormalBehavior: '' }
      });

      toast.success('Daily log saved successfully');
    } catch (error) {
      // This catch block handles the initial dailyLog creation failure
      if (!(error instanceof Error && error.message.includes('authInfo'))) {
        handleFirestoreError(error, OperationType.WRITE, 'dailyLogs');
      }
      toast.error('Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        ...transactionData,
        userId: user.uid,
        flockId: selectedFlockId,
        amount: Number(transactionData.amount) || 0,
        timestamp: new Date().toISOString(),
      });
      toast.success('Transaction saved successfully');
      setTransactionData({ ...transactionData, amount: '', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
      toast.error('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {activeTab && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveTab(null)}
              className="rounded-full hover:bg-slate-200"
            >
              <Plus className="rotate-45" size={24} />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab ? categories.find(c => c.id === activeTab)?.title : 'Add Farm Data'}
            </h1>
            <p className="text-slate-500">
              {activeTab ? 'Fill in the details below' : 'Select a category to record data'}
            </p>
          </div>
        </div>
        {activeTab && activeTab !== 'flock' && activeTab !== 'logs_history' && flocks.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Select Flock</Label>
              <Select value={selectedFlockId} onValueChange={setSelectedFlockId}>
                <SelectTrigger className="rounded-xl border-emerald-100 bg-emerald-50/50">
                  <SelectValue placeholder="Choose a flock" />
                </SelectTrigger>
                <SelectContent>
                  {flocks.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} ({f.breed})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {['environment', 'consumption', 'production', 'health', 'biosecurity', 'alerts'].includes(activeTab) && (
              <div className="w-full sm:w-48">
                <Label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Log Date</Label>
                <Input 
                  type="date" 
                  value={dailyLog.date} 
                  onChange={e => setDailyLog({...dailyLog, date: e.target.value})}
                  className="rounded-xl border-emerald-100 bg-emerald-50/50"
                />
              </div>
            )}
          </div>
        )}
      </header>

      {!activeTab ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Card 
              key={cat.id} 
              className="border-none shadow-md hover:shadow-xl transition-all cursor-pointer group rounded-3xl overflow-hidden"
              onClick={() => setActiveTab(cat.id)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className={`${cat.color} p-5 rounded-2xl text-white shadow-xl group-hover:scale-110 transition-transform shadow-slate-200`}>
                  <cat.icon size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{cat.title}</h3>
                  <p className="text-xs text-slate-600 font-medium mt-1">{cat.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* Tab: Daily Data (Comprehensive) */}
          {activeTab === 'daily_data' && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="text-emerald-600" />
                    Daily Farm Data Entry
                  </CardTitle>
                  <CardDescription>Record all daily activities for the selected flock</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveDailyLog} className="space-y-8">
                    {/* Selection Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Select Batch / Flock</Label>
                        <Select value={selectedFlockId} onValueChange={setSelectedFlockId}>
                          <SelectTrigger className="rounded-xl border-emerald-100 bg-white">
                            <SelectValue placeholder="Choose a flock" />
                          </SelectTrigger>
                          <SelectContent>
                            {flocks.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.name} ({f.breed})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Entry Date</Label>
                        <Input 
                          type="date" 
                          value={dailyLog.date} 
                          onChange={e => setDailyLog({...dailyLog, date: e.target.value})}
                          className="rounded-xl border-emerald-100 bg-white"
                        />
                      </div>
                    </div>

                    {/* Feed Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Utensils size={20} className="text-orange-500" />
                        Feed Section
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="feedIntake">Daily Feed Given (KG)</Label>
                          <Input 
                            id="feedIntake" 
                            type="number" 
                            value={dailyLog.consumption.feedIntake} 
                            onChange={e => setDailyLog({...dailyLog, consumption: {...dailyLog.consumption, feedIntake: e.target.value}})}
                            placeholder="0.00"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="feedType">Feed Type</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select value={dailyLog.consumption.feedType} onValueChange={v => setDailyLog({...dailyLog, consumption: {...dailyLog.consumption, feedType: v}})}>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue placeholder="Select feed type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {['Pre-Starter', 'Starter', 'Finisher', 'Layer', 'Counter'].map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32 flex flex-col justify-center px-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Available</span>
                              <span className="text-sm font-bold text-emerald-600">
                                {feedStock.find(s => s.type === dailyLog.consumption.feedType)?.quantity || 0} kg
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Water Consumption Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Droplets size={20} className="text-blue-500" />
                        Water Consumption Section
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="waterIntake">Daily Water Intake (Liters)</Label>
                          <Input 
                            id="waterIntake" 
                            type="number" 
                            value={dailyLog.consumption.waterIntake} 
                            onChange={e => setDailyLog({...dailyLog, consumption: {...dailyLog.consumption, waterIntake: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Growth Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Scale size={20} className="text-purple-500" />
                        Growth Section
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="avgWeight">Avg Body Weight (Grams) - Weekly Entry</Label>
                          <Input 
                            id="avgWeight" 
                            type="number" 
                            value={dailyLog.production.avgWeight} 
                            onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, avgWeight: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Eggs Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Plus size={20} className="text-emerald-500" />
                        Eggs Section
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="eggCount">Daily Egg Count</Label>
                          <Input 
                            id="eggCount" 
                            type="number" 
                            value={dailyLog.production.eggCount} 
                            onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, eggCount: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eggWeight">Avg Egg Weight (Grams)</Label>
                          <Input 
                            id="eggWeight" 
                            type="number" 
                            value={dailyLog.production.eggWeight} 
                            onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, eggWeight: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="badEggs">Bad Eggs</Label>
                          <Input 
                            id="badEggs" 
                            type="number" 
                            value={dailyLog.production.badEggs} 
                            onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, badEggs: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eggQuality">Egg Quality</Label>
                          <Select value={dailyLog.production.eggQuality} onValueChange={v => setDailyLog({...dailyLog, production: {...dailyLog.production, eggQuality: v}})}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Excellent">Excellent</SelectItem>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Health & Medication Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Pill size={20} className="text-red-500" />
                        Health & Medication
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vaccines">Vaccination Given</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select 
                                value={dailyLog.health.vaccines} 
                                onValueChange={v => setDailyLog({...dailyLog, health: {...dailyLog.health, vaccines: v}})}
                              >
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue placeholder="Select vaccine" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {medicineStock.filter(m => m.type === 'Vaccine' && m.quantity > 0).map(m => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32 flex flex-col justify-center px-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Available</span>
                              <span className="text-sm font-bold text-emerald-600">
                                {(() => {
                                  const med = medicineStock.find(m => m.name === dailyLog.health.vaccines && m.type === 'Vaccine');
                                  return med ? `${med.quantity} ${med.unit || 'doses'}` : '0 doses';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vaccineDoses">Vaccine Doses</Label>
                          <Input 
                            id="vaccineDoses" 
                            type="number"
                            value={dailyLog.health.vaccineDoses} 
                            onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, vaccineDoses: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="medicines">Medicines Given</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Select 
                                value={dailyLog.health.medicines} 
                                onValueChange={v => setDailyLog({...dailyLog, health: {...dailyLog.health, medicines: v}})}
                              >
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue placeholder="Select medicine" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {medicineStock.filter(m => m.type === 'Medicine' && m.quantity > 0).map(m => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32 flex flex-col justify-center px-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Available</span>
                              <span className="text-sm font-bold text-emerald-600">
                                {(() => {
                                  const med = medicineStock.find(m => m.name === dailyLog.health.medicines && m.type === 'Medicine');
                                  return med ? `${med.quantity} ${med.unit || 'ml'}` : '0 ml';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="medicineDoses">Medicine Doses</Label>
                          <Input 
                            id="medicineDoses" 
                            type="number"
                            value={dailyLog.health.medicineDoses} 
                            onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, medicineDoses: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Disease Observation Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <AlertTriangle size={20} className="text-amber-500" />
                        Disease Observation
                      </h3>
                      <div className="space-y-2">
                        <Label htmlFor="symptoms">Observations / Symptoms (Flock Uncertainty)</Label>
                        <textarea 
                          id="symptoms" 
                          value={dailyLog.health.symptoms} 
                          onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, symptoms: e.target.value}})}
                          placeholder="Describe any unusual behavior or symptoms observed..."
                          className="w-full min-h-[100px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Mortality Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Trash2 size={20} className="text-slate-500" />
                        Mortality & Culling
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mortality">Mortality Entry (Birds)</Label>
                          <Input 
                            id="mortality" 
                            type="number" 
                            value={dailyLog.health.mortality} 
                            onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, mortality: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="culling">Culling Records (Birds)</Label>
                          <Input 
                            id="culling" 
                            type="number" 
                            value={dailyLog.health.culling} 
                            onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, culling: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Biosecurity Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <ShieldCheck size={20} className="text-emerald-600" />
                        Biosecurity Section
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <input 
                            type="checkbox" 
                            id="cleaning" 
                            checked={dailyLog.biosecurity.cleaning} 
                            onChange={e => setDailyLog({...dailyLog, biosecurity: {...dailyLog.biosecurity, cleaning: e.target.checked}})}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <Label htmlFor="cleaning" className="text-xs font-bold cursor-pointer">Cleaning</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <input 
                            type="checkbox" 
                            id="disinfection" 
                            checked={dailyLog.biosecurity.disinfection} 
                            onChange={e => setDailyLog({...dailyLog, biosecurity: {...dailyLog.biosecurity, disinfection: e.target.checked}})}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <Label htmlFor="disinfection" className="text-xs font-bold cursor-pointer">Disinfection</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <input 
                            type="checkbox" 
                            id="footbath" 
                            checked={dailyLog.biosecurity.footbath} 
                            onChange={e => setDailyLog({...dailyLog, biosecurity: {...dailyLog.biosecurity, footbath: e.target.checked}})}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <Label htmlFor="footbath" className="text-xs font-bold cursor-pointer">Footbath</Label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="visitors" className="text-xs">Visitors Count</Label>
                          <Input 
                            id="visitors" 
                            type="number" 
                            value={dailyLog.biosecurity.visitors} 
                            onChange={e => setDailyLog({...dailyLog, biosecurity: {...dailyLog.biosecurity, visitors: e.target.value}})}
                            placeholder="0"
                            className="rounded-xl h-8"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 text-lg font-bold shadow-lg shadow-emerald-900/10" disabled={loading}>
                      <Save className="mr-2" size={24} />
                      Save Daily Data
                    </Button>
                  </form>

                  {renderSavedLogs('Daily Data')}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: Logs History */}
          {activeTab === 'logs_history' && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="text-slate-700" />
                    Logs History
                  </CardTitle>
                  <CardDescription>View and manage all your previous farm records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <Label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Filter by Flock</Label>
                        <Select value={selectedFlockId} onValueChange={setSelectedFlockId}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="All Flocks">
                              {selectedFlockId === 'all' || selectedFlockId === '' 
                                ? 'All Flocks' 
                                : [...flocks, ...soldFlocks].find(f => f.id === selectedFlockId)?.name || 'All Flocks'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Flocks</SelectItem>
                            {[...flocks, ...soldFlocks].map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name} {f.status === 'Sold' ? '(Sold)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Mini Cards for History Types */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {historyFilters.map((filter) => {
                        const Icon = filter.icon;
                        const isActive = historyFilter === filter.id;
                        
                        // Explicit color mapping to avoid dynamic class issues
                        const colorClasses: Record<string, string> = {
                          emerald: isActive ? 'bg-emerald-50 border-emerald-200 ring-emerald-500/20 text-emerald-600' : 'text-slate-500',
                          blue: isActive ? 'bg-blue-50 border-blue-200 ring-blue-500/20 text-blue-600' : 'text-slate-500',
                          amber: isActive ? 'bg-amber-50 border-amber-200 ring-amber-500/20 text-amber-600' : 'text-slate-500',
                          red: isActive ? 'bg-red-50 border-red-200 ring-red-500/20 text-red-600' : 'text-slate-500',
                          purple: isActive ? 'bg-purple-50 border-purple-200 ring-purple-500/20 text-purple-600' : 'text-slate-500',
                          slate: isActive ? 'bg-slate-50 border-slate-200 ring-slate-500/20 text-slate-600' : 'text-slate-500',
                        };

                        const iconBgClasses: Record<string, string> = {
                          emerald: isActive ? 'bg-emerald-100' : 'bg-slate-100',
                          blue: isActive ? 'bg-blue-100' : 'bg-slate-100',
                          amber: isActive ? 'bg-amber-100' : 'bg-slate-100',
                          red: isActive ? 'bg-red-100' : 'bg-slate-100',
                          purple: isActive ? 'bg-purple-100' : 'bg-slate-100',
                          slate: isActive ? 'bg-slate-100' : 'bg-slate-100',
                        };

                        return (
                          <button
                            key={filter.id}
                            onClick={() => setHistoryFilter(filter.id)}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                              isActive 
                                ? `${colorClasses[filter.color]} shadow-sm ring-2` 
                                : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className={`p-2 rounded-xl mb-2 ${iconBgClasses[filter.color]}`}>
                              <Icon size={20} />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${
                              isActive ? `text-${filter.color}-700` : 'text-slate-500'
                            }`}>
                              {filter.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-4">
                      {(() => {
                        const flockFilter = (item: any) => selectedFlockId === 'all' || selectedFlockId === '' || item.flockId === selectedFlockId;
                        let displayItems = [];

                        switch (historyFilter) {
                          case 'daily':
                            displayItems = logs.filter(flockFilter).map(log => ({ 
                              id: log.id, 
                              date: log.date, 
                              flockId: log.flockId,
                              title: 'Daily Record',
                              details: (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Utensils size={12} className="text-amber-500" />
                                    <span className="text-slate-600">Feed: <b>{log.consumption?.feedIntake || 0}kg</b></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Droplets size={12} className="text-blue-500" />
                                    <span className="text-slate-600">Water: <b>{log.consumption?.waterIntake || 0}L</b></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Scale size={12} className="text-emerald-500" />
                                    <span className="text-slate-600">Weight: <b>{log.production?.avgWeight || 0}g</b></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Trash2 size={12} className="text-red-500" />
                                    <span className="text-slate-600">Mortality: <b>{log.health?.mortality || 0}</b></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Thermometer size={12} className="text-orange-500" />
                                    <span className="text-slate-600">Temp: <b>{log.environment?.temperature || '--'}°C</b></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <Package size={12} className="text-purple-500" />
                                    <span className="text-slate-600">Eggs: <b>{log.production?.eggCount || 0}</b></span>
                                  </div>
                                </div>
                              ),
                              raw: log,
                              type: 'daily'
                            }));
                            break;
                          case 'medicine':
                            displayItems = logs.filter(log => flockFilter(log) && (log.health?.medicines !== 'none' && log.health?.medicines !== '' || log.health?.vaccines !== 'none' && log.health?.vaccines !== '')).map(log => ({
                              id: log.id,
                              date: log.date,
                              flockId: log.flockId,
                              title: 'Medicine/Vaccine Log',
                              details: (
                                <div className="space-y-1 mt-2">
                                  {log.health?.vaccines && log.health.vaccines !== 'none' && (
                                    <div className="flex items-center gap-2 text-[11px] bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                                      <ShieldCheck size={12} className="text-blue-600" />
                                      <span className="text-blue-800 font-medium">Vaccine: <b>{log.health.vaccines}</b> ({log.health.vaccineDoses || 0} doses)</span>
                                    </div>
                                  )}
                                  {log.health?.medicines && log.health.medicines !== 'none' && (
                                    <div className="flex items-center gap-2 text-[11px] bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                                      <Pill size={12} className="text-emerald-600" />
                                      <span className="text-emerald-800 font-medium">Medicine: <b>{log.health.medicines}</b> ({log.health.medicineDoses || 0} doses)</span>
                                    </div>
                                  )}
                                </div>
                              ),
                              raw: log,
                              type: 'medicine'
                            }));
                            break;
                          case 'feed':
                            displayItems = logs.filter(log => flockFilter(log) && log.consumption?.feedIntake).map(log => ({
                              id: log.id,
                              date: log.date,
                              flockId: log.flockId,
                              title: 'Feed Intake Record',
                              details: (
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100 text-[11px]">
                                    <span className="text-amber-800 font-bold">{log.consumption.feedIntake}kg</span>
                                    <span className="text-amber-600 ml-1">of {log.consumption.feedType || 'Feed'}</span>
                                  </div>
                                  {log.consumption.fcr && (
                                    <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                      <span className="text-slate-400 font-medium uppercase text-[9px] mr-1">FCR:</span>
                                      <span className="text-slate-700 font-bold">{log.consumption.fcr}</span>
                                    </div>
                                  )}
                                </div>
                              ),
                              raw: log,
                              type: 'feed'
                            }));
                            break;
                          case 'alerts':
                            displayItems = logs.filter(log => flockFilter(log) && (log.alerts?.feedDrop || log.alerts?.mortalityIncrease || log.alerts?.eggDrop || log.health?.symptoms)).map(log => ({
                              id: log.id,
                              date: log.date,
                              flockId: log.flockId,
                              title: 'Alert / Observation',
                              details: (
                                <div className="space-y-2 mt-2">
                                  <div className="flex flex-wrap gap-2">
                                    {log.alerts?.feedDrop && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold">Feed Drop</span>}
                                    {log.alerts?.mortalityIncrease && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold">Mortality Spike</span>}
                                    {log.alerts?.eggDrop && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold">Egg Drop</span>}
                                  </div>
                                  {log.health?.symptoms && (
                                    <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                                      "{log.health.symptoms}"
                                    </p>
                                  )}
                                </div>
                              ),
                              raw: log,
                              type: 'alert'
                            }));
                            break;
                          case 'sold':
                            displayItems = transactions.filter(tx => flockFilter(tx) && tx.category === 'Flock Sale').map(tx => ({
                              id: tx.id,
                              date: tx.date,
                              flockId: tx.flockId,
                              title: 'Flock Sale Record',
                              details: (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <div className="p-2 bg-amber-50 rounded-xl border border-amber-100 text-center">
                                    <p className="text-[9px] font-bold text-amber-600 uppercase">Birds</p>
                                    <p className="text-xs font-bold text-amber-900">{tx.description?.match(/Birds: (\d+)/)?.[1] || 'N/A'}</p>
                                  </div>
                                  <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-center">
                                    <p className="text-[9px] font-bold text-blue-600 uppercase">Weight</p>
                                    <p className="text-xs font-bold text-blue-900">{tx.description?.match(/Weight: ([\d.]+)kg/)?.[1] || 'N/A'}kg</p>
                                  </div>
                                </div>
                              ),
                              amount: tx.amount,
                              raw: tx,
                              type: 'sold'
                            }));
                            break;
                          case 'financial':
                            displayItems = transactions.filter(flockFilter).map(tx => ({
                              id: tx.id,
                              date: tx.date,
                              flockId: tx.flockId,
                              title: `${tx.type}: ${tx.category}`,
                              details: (
                                <div className="mt-1">
                                  <p className="text-[11px] text-slate-600">{tx.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                      tx.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {tx.type}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">{tx.category}</span>
                                  </div>
                                </div>
                              ),
                              amount: tx.amount,
                              raw: tx,
                              type: 'financial'
                            }));
                            break;
                        }

                        if (displayItems.length === 0) {
                          return (
                            <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                              No {historyFilters.find(f => f.id === historyFilter)?.title} found
                            </div>
                          );
                        }

                        return displayItems.map(item => {
                          const flock = [...flocks, ...soldFlocks].find(f => f.id === item.flockId);
                          return (
                            <div key={item.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-slate-300 transition-colors">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{flock?.name || 'Unknown Flock'}</span>
                                  <span className="text-[10px] text-slate-300">•</span>
                                  <span className="text-xs font-medium text-slate-500">{item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                                {item.amount && <span className="text-xs font-bold text-emerald-600">₹{Number(item.amount).toLocaleString()}</span>}
                                {item.details}
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="rounded-xl h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                                  onClick={() => setReportFlockId(item.flockId)}
                                >
                                  <FileText size={14} className="mr-2" />
                                  View Report
                                </Button>
                                {item.type === 'daily' || item.type === 'medicine' || item.type === 'feed' || item.type === 'alert' ? (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => setEditingLog(item.raw)} className="h-9 w-9 rounded-full hover:bg-slate-100">
                                      <Edit2 size={16} />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(item.id)} className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                                      <Trash2 size={16} />
                                    </Button>
                                  </>
                                ) : (
                                  <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(item.raw)} className="h-9 w-9 rounded-full hover:bg-slate-100">
                                    <Edit2 size={16} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab: Sold Flock */}
          {activeTab === 'sold_flock' && (
            <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="text-amber-600" />
                  Record Flock Sale
                </CardTitle>
                <CardDescription>Record partial or full sale of your birds</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSoldFlock} className="space-y-6">
                  {/* Flock Stats Summary */}
                  {selectedFlockId && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      {(() => {
                        const flock = flocks.find(f => f.id === selectedFlockId);
                        const avgWeight = flock?.currentWeight || flock?.initialAvgWeight || 0;
                        const birds = flock?.currentCount || 0;
                        const estTotalWeight = (avgWeight * birds) / 1000;
                        return (
                          <>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Current Avg Weight</p>
                              <p className="text-xl font-bold text-slate-900">{avgWeight}g</p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Birds Available</p>
                              <p className="text-xl font-bold text-slate-900">{birds}</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Est. Total Weight</p>
                              <p className="text-xl font-bold text-slate-900">{estTotalWeight.toFixed(2)}kg</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-500">Select Flock</Label>
                      <Select value={selectedFlockId} onValueChange={setSelectedFlockId}>
                        <SelectTrigger className="rounded-xl border-amber-100 bg-white">
                          <SelectValue placeholder="Choose a flock" />
                        </SelectTrigger>
                        <SelectContent>
                          {flocks.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name} ({f.breed})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-500">Sale Type</Label>
                      <Select 
                        value={soldFlockData.saleType} 
                        onValueChange={v => setSoldFlockData({...soldFlockData, saleType: v})}
                      >
                        <SelectTrigger className="rounded-xl border-amber-100 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full">Full Sale (Close Batch)</SelectItem>
                          <SelectItem value="Partial">Partial Sale (Keep Active)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-slate-500">Sale Date</Label>
                      <Input 
                        type="date" 
                        value={soldFlockData.saleDate} 
                        onChange={e => setSoldFlockData({...soldFlockData, saleDate: e.target.value})}
                        className="rounded-xl border-amber-100 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="birdsSold">Birds Sold (Count)</Label>
                      <Input 
                        id="birdsSold" 
                        type="number" 
                        required 
                        value={soldFlockData.birdsSold} 
                        onChange={e => {
                          const val = e.target.value;
                          setSoldFlockData(prev => ({...prev, birdsSold: val}));
                        }}
                        placeholder="0"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalWeight">Total Weight Sold (KG)</Label>
                      <Input 
                        id="totalWeight" 
                        type="number" 
                        required 
                        value={soldFlockData.totalWeight} 
                        onChange={e => {
                          const val = e.target.value;
                          const price = Number(soldFlockData.pricePerKg) || 0;
                          setSoldFlockData(prev => ({
                            ...prev, 
                            totalWeight: val,
                            totalPrice: (Number(val) * price).toFixed(2)
                          }));
                        }}
                        placeholder="0.00"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pricePerKg">Sale Price (₹ per KG)</Label>
                      <Input 
                        id="pricePerKg" 
                        type="number" 
                        required 
                        value={soldFlockData.pricePerKg} 
                        onChange={e => {
                          const val = e.target.value;
                          const weight = Number(soldFlockData.totalWeight) || 0;
                          setSoldFlockData(prev => ({
                            ...prev, 
                            pricePerKg: val,
                            totalPrice: (Number(val) * weight).toFixed(2)
                          }));
                        }}
                        placeholder="0.00"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalPrice">Total Sale Price (₹)</Label>
                      <div className="relative">
                        <Input 
                          id="totalPrice" 
                          type="number" 
                          required 
                          value={soldFlockData.totalPrice} 
                          onChange={e => setSoldFlockData({...soldFlockData, totalPrice: e.target.value})}
                          placeholder="0.00"
                          className="rounded-xl pr-10 font-bold text-emerald-600 bg-emerald-50/30"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                          <IndianRupee size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyerName">Buyer Name / Company</Label>
                      <Input 
                        id="buyerName" 
                        value={soldFlockData.buyerName} 
                        onChange={e => setSoldFlockData({...soldFlockData, buyerName: e.target.value})}
                        placeholder="e.g. Local Market, ABC Poultry"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="saleNotes">Notes</Label>
                      <Input 
                        id="saleNotes" 
                        value={soldFlockData.notes} 
                        onChange={e => setSoldFlockData({...soldFlockData, notes: e.target.value})}
                        placeholder="Any additional details..."
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Live Calculation Result */}
                  {(Number(soldFlockData.totalWeight) > 0 && Number(soldFlockData.pricePerKg) > 0) && (
                    <div className="p-6 bg-[#122B21] rounded-3xl text-white shadow-xl shadow-emerald-900/20 animate-in zoom-in duration-300">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Live Calculation</p>
                          <h4 className="text-lg font-bold">Total Revenue</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 text-xs font-medium">{soldFlockData.totalWeight}kg × ₹{soldFlockData.pricePerKg}/kg</p>
                          <p className="text-3xl font-black">₹{Number(soldFlockData.totalPrice).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Important Note</p>
                        <p className="text-xs text-amber-700 mt-1">
                          {soldFlockData.saleType === 'Full' 
                            ? 'Full Sale will mark this flock as inactive and close the batch.' 
                            : 'Partial Sale will keep the flock active but reduce the current bird count.'}
                          This action will automatically record an income transaction in your financials.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 rounded-xl py-6 text-lg font-bold shadow-lg shadow-amber-900/10" disabled={loading}>
                    <ShoppingBag className="mr-2" size={24} />
                    {soldFlockData.saleType === 'Full' ? 'Record Sale & Close Batch' : 'Record Partial Sale'}
                  </Button>
                </form>

                {/* Sale History Section */}
                <div className="mt-12 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <ShoppingBag size={20} className="text-amber-600" />
                      Recent Sales History
                    </h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {transactions.filter(tx => tx.category === 'Flock Sale').length + soldFlocks.length} Records
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(() => {
                      const saleTransactions = transactions.filter(tx => tx.category === 'Flock Sale');
                      const soldFlockIdsWithTransactions = new Set(saleTransactions.map(tx => tx.flockId));
                      
                      const historyItems = [
                        ...saleTransactions.map(tx => ({
                          id: tx.id,
                          flockId: tx.flockId,
                          type: 'transaction',
                          name: tx.description?.split('flock: ')[1]?.split('.')[0] || 'Flock Sale',
                          date: tx.date,
                          amount: tx.amount,
                          description: tx.description,
                          isFull: tx.description?.includes('Full Sale'),
                          birds: tx.description?.match(/Birds: (\d+)/)?.[1] || 'N/A',
                          weight: tx.description?.match(/Weight: ([\d.]+)kg/)?.[1] || 'N/A'
                        })),
                        ...soldFlocks
                          .filter(f => !soldFlockIdsWithTransactions.has(f.id))
                          .map(f => ({
                            id: f.id,
                            flockId: f.id,
                            type: 'flock',
                            name: f.name,
                            date: f.soldAt || f.placementDate,
                            amount: f.saleDetails?.totalPrice || 0,
                            description: `Full Sale of flock: ${f.name}. Birds: ${f.initialCount}, Weight: ${f.saleDetails?.totalWeight || 0}kg. Buyer: ${f.saleDetails?.buyerName || 'N/A'}`,
                            isFull: true,
                            birds: f.initialCount,
                            weight: f.saleDetails?.totalWeight || 0
                          }))
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      if (historyItems.length === 0) {
                        return (
                          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <ShoppingBag className="mx-auto text-slate-300 mb-3" size={32} />
                            <p className="text-slate-400 font-medium">No sale history available yet</p>
                          </div>
                        );
                      }

                      return historyItems.map(item => (
                        <div key={item.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all group">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900">{item.name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  item.isFull ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {item.isFull ? 'Full Sale' : 'Partial Sale'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">
                                Sold on {item.date ? format(new Date(item.date), 'MMM dd, yyyy') : 'N/A'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl h-10 border-amber-200 text-amber-700 hover:bg-amber-50"
                                onClick={() => setReportFlockId(item.flockId)}
                              >
                                <FileText size={14} className="mr-2" />
                                Full Report
                              </Button>
                              <div className="px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[80px]">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Birds</p>
                                <p className="text-sm font-bold text-slate-700">{item.birds}</p>
                              </div>
                              <div className="px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[80px]">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Weight</p>
                                <p className="text-sm font-bold text-slate-700">{item.weight}kg</p>
                              </div>
                              <div className="px-3 py-2 bg-emerald-50 rounded-2xl border border-emerald-100 text-center min-w-[100px]">
                                <p className="text-[9px] font-bold text-emerald-600 uppercase">Revenue</p>
                                <p className="text-sm font-bold text-emerald-700">₹{Number(item.amount).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-slate-400">Details:</span>
                            <span className="font-medium">{item.description}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab 1: Flock Basic Details */}
          {activeTab === 'flock' && (
            <Card className="border-none shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bird className="text-emerald-600" />
                Flock Basic Details
              </CardTitle>
              <CardDescription>Register a new batch of birds in your farm</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateFlock} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Flock Name / Batch ID</Label>
                    <Input id="name" required value={flockData.name} onChange={e => setFlockData({...flockData, name: e.target.value})} placeholder="e.g. Batch-2024-01" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="breed">Breed</Label>
                    <Select value={flockData.breed} onValueChange={v => setFlockData({...flockData, breed: v})}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Broiler">Broiler</SelectItem>
                        <SelectItem value="Layer">Layer</SelectItem>
                        <SelectItem value="Sonali">Sonali</SelectItem>
                        <SelectItem value="Gavthi">Gavthi</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {flockData.breed === 'Other' && (
                    <div className="space-y-2">
                      <Label htmlFor="otherBreed">Custom Breed Name</Label>
                      <Input id="otherBreed" required value={flockData.otherBreed} onChange={e => setFlockData({...flockData, otherBreed: e.target.value})} placeholder="Type breed name" className="rounded-xl" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="placementDate">Placement Date</Label>
                    <Input id="placementDate" type="date" required value={flockData.placementDate} onChange={e => setFlockData({...flockData, placementDate: e.target.value})} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initialCount">Number of Birds (Initial)</Label>
                    <Input id="initialCount" type="number" required value={flockData.initialCount} onChange={e => setFlockData({...flockData, initialCount: e.target.value})} placeholder="0" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initialAvgWeight">Initial Avg Weight (g)</Label>
                    <Input id="initialAvgWeight" type="number" value={flockData.initialAvgWeight} onChange={e => setFlockData({...flockData, initialAvgWeight: e.target.value})} placeholder="e.g. 40" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chicksCost">Total Chicks Cost (₹)</Label>
                    <Input id="chicksCost" type="number" value={flockData.chicksCost} onChange={e => setFlockData({...flockData, chicksCost: e.target.value})} placeholder="e.g. 12000" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source (Hatchery)</Label>
                    <Input id="source" value={flockData.source} onChange={e => setFlockData({...flockData, source: e.target.value})} placeholder="e.g. Venky's" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="farmType">Farm Type</Label>
                    <Input id="farmType" value={flockData.farmType} onChange={e => setFlockData({...flockData, farmType: e.target.value})} placeholder="e.g. Environment Controlled" className="rounded-xl" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6" disabled={loading}>
                  <Plus className="mr-2" size={20} />
                  Create New Flock
                </Button>
              </form>

              <div className="mt-10 space-y-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Bird size={18} className="text-emerald-600" />
                  Existing Flocks
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {flocks.map(flock => (
                    <div key={flock.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900">{flock.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            flock.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {flock.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {flock.breed} • {flock.currentCount} Birds • {flock.currentWeight || flock.initialAvgWeight || 0}g Avg • Placed: {flock.placementDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 sm:flex-none rounded-xl h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => setReportFlockId(flock.id)}
                        >
                          <FileText size={14} className="mr-2" />
                          Report
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 sm:flex-none rounded-xl h-9"
                          onClick={() => setEditingFlock(flock)}
                        >
                          <Edit2 size={14} className="mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 sm:flex-none rounded-xl h-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteFlock(flock.id)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {flocks.length === 0 && (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                      No flocks registered yet
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Batch Performance Report Dialog */}
          <Dialog open={!!reportFlockId} onOpenChange={(open) => !open && setReportFlockId(null)}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none">
              {(() => {
                if (!reportFlockId) return null;
                const flock = [...flocks, ...soldFlocks].find(f => f.id === reportFlockId);
                if (!flock) return <div className="p-8 text-center">Flock not found</div>;

                const flockLogs = logs.filter(l => l.flockId === reportFlockId);
                const flockTxs = transactions.filter(t => t.flockId === reportFlockId);

                // Calculations
                const totalFeed = flockLogs.reduce((sum, l) => sum + (Number(l.consumption?.feedIntake) || 0), 0);
                const totalWater = flockLogs.reduce((sum, l) => sum + (Number(l.consumption?.waterIntake) || 0), 0);
                const totalMortality = flockLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
                const mortalityRate = ((totalMortality / flock.initialCount) * 100).toFixed(2);
                
                const saleTx = transactions.find(t => t.flockId === reportFlockId && t.category === 'Flock Sale');
                const totalRevenue = flockTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                
                const chicksCost = Number(flock.chicksCost) || 0;
                const feedCost = flockTxs.filter(t => t.category === 'Feed').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const medCost = flockTxs.filter(t => t.category === 'Medicine' || t.category === 'Vaccine').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                const otherCost = flockTxs.filter(t => t.type === 'Expense' && !['Feed', 'Medicine', 'Vaccine'].includes(t.category)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                
                const totalExpenses = chicksCost + feedCost + medCost + otherCost;
                const netProfit = totalRevenue - totalExpenses;
                const isProfit = netProfit >= 0;

                const totalWeightSold = saleTx?.description?.match(/Weight: ([\d.]+)kg/)?.[1] || flock.saleDetails?.totalWeight || 0;
                const fcr = totalWeightSold > 0 ? (totalFeed / Number(totalWeightSold)).toFixed(2) : 'N/A';

                const duration = flock.soldAt && flock.placementDate 
                  ? Math.ceil((new Date(flock.soldAt).getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24))
                  : flockLogs.length > 0 
                    ? Math.ceil((new Date(flockLogs[0].date).getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 'N/A';

                return (
                  <div className="bg-slate-50">
                    <div className="p-6 bg-white border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <ClipboardList className="text-amber-600" />
                          Batch Performance Report
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">{flock.name} • {flock.breed}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setReportFlockId(null)} className="rounded-full">
                        <Plus className="rotate-45" size={24} />
                      </Button>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Birds</p>
                          <p className="text-lg font-bold text-slate-900">{flock.initialCount}</p>
                          <p className="text-[10px] text-red-500 font-medium mt-1">{totalMortality} Deaths ({mortalityRate}%)</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Feed</p>
                          <p className="text-lg font-bold text-slate-900">{totalFeed.toLocaleString()} kg</p>
                          <p className="text-[10px] text-amber-600 font-medium mt-1">FCR: {fcr}</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sale Weight</p>
                          <p className="text-lg font-bold text-slate-900">{totalWeightSold} kg</p>
                          <p className="text-[10px] text-blue-600 font-medium mt-1">Duration: {duration} Days</p>
                        </div>
                        <div className={`p-4 rounded-2xl border shadow-sm ${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>Net Profit/Loss</p>
                          <p className={`text-lg font-bold ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>₹{Math.abs(netProfit).toLocaleString()}</p>
                          <p className={`text-[10px] font-medium mt-1 ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>{isProfit ? 'Profit' : 'Loss'}</p>
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                          <CardHeader className="bg-white border-b border-slate-50 py-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <IndianRupee size={16} className="text-red-500" />
                              Expense Breakdown
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Chicks Cost</span>
                              <span className="font-bold text-slate-700">₹{chicksCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Feed Cost</span>
                              <span className="font-bold text-slate-700">₹{feedCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Medicine & Vaccines</span>
                              <span className="font-bold text-slate-700">₹{medCost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Other Expenses</span>
                              <span className="font-bold text-slate-700">₹{otherCost.toLocaleString()}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="font-bold text-slate-900">Total Expenses</span>
                              <span className="font-bold text-red-600">₹{totalExpenses.toLocaleString()}</span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                          <CardHeader className="bg-white border-b border-slate-50 py-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <IndianRupee size={16} className="text-emerald-500" />
                              Revenue Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Main Sale Revenue</span>
                              <span className="font-bold text-slate-700">₹{totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Other Income</span>
                              <span className="font-bold text-slate-700">₹0</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="font-bold text-slate-900">Total Revenue</span>
                              <span className="font-bold text-emerald-600">₹{totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className={`mt-4 p-3 rounded-xl flex justify-between items-center ${isProfit ? 'bg-emerald-50' : 'bg-red-50'}`}>
                              <span className="font-bold text-slate-700">Net {isProfit ? 'Profit' : 'Loss'}</span>
                              <span className={`font-bold text-lg ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>₹{Math.abs(netProfit).toLocaleString()}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Performance Metrics */}
                      <Card className="border-none shadow-sm rounded-2xl">
                        <CardHeader className="py-4">
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Scale size={16} className="text-blue-500" />
                            Key Performance Indicators (KPIs)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Feed Conversion Ratio</p>
                            <p className="text-2xl font-bold text-slate-900">{fcr}</p>
                            <p className="text-[10px] text-slate-500">Kg feed per kg meat</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Livability Rate</p>
                            <p className="text-2xl font-bold text-slate-900">{(100 - Number(mortalityRate)).toFixed(2)}%</p>
                            <p className="text-[10px] text-slate-500">Birds survived to sale</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Daily Intake</p>
                            <p className="text-2xl font-bold text-slate-900">
                              {duration !== 'N/A' ? ((totalFeed / Number(duration)) / flock.initialCount * 1000).toFixed(1) : '0'}g
                            </p>
                            <p className="text-[10px] text-slate-500">Per bird per day</p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex justify-center pb-6">
                        <Button 
                          variant="outline" 
                          className="rounded-xl border-slate-200 text-slate-600"
                          onClick={() => window.print()}
                        >
                          <FileText size={16} className="mr-2" />
                          Download PDF Report
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Edit Flock Dialog */}
          <Dialog open={!!editingFlock} onOpenChange={(open) => !open && setEditingFlock(null)}>
            <DialogContent className="sm:max-w-[500px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Edit Flock Details</DialogTitle>
              </DialogHeader>
              {editingFlock && (
                <form onSubmit={handleUpdateFlock} className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Flock Name</Label>
                      <Input id="edit-name" value={editingFlock.name} onChange={e => setEditingFlock({...editingFlock, name: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-breed">Breed</Label>
                      <Select value={editingFlock.breed} onValueChange={v => setEditingFlock({...editingFlock, breed: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Broiler">Broiler</SelectItem>
                          <SelectItem value="Layer">Layer</SelectItem>
                          <SelectItem value="Sonali">Sonali</SelectItem>
                          <SelectItem value="Gavthi">Gavthi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-count">Current Count</Label>
                      <Input id="edit-count" type="number" value={editingFlock.currentCount} onChange={e => setEditingFlock({...editingFlock, currentCount: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select value={editingFlock.status} onValueChange={v => setEditingFlock({...editingFlock, status: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Sold">Sold</SelectItem>
                          <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-chicksCost">Chicks Cost (₹)</Label>
                      <Input id="edit-chicksCost" type="number" value={editingFlock.chicksCost} onChange={e => setEditingFlock({...editingFlock, chicksCost: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-avgWeight">Initial Avg Weight (g)</Label>
                      <Input id="edit-avgWeight" type="number" value={editingFlock.initialAvgWeight} onChange={e => setEditingFlock({...editingFlock, initialAvgWeight: e.target.value})} className="rounded-xl" />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setEditingFlock(null)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={loading}>Save Changes</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Tab: Medicine Stock */}
          {activeTab === 'medicine_stock' && (
            <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="text-indigo-600" />
                  Medicine Stock Management
                </CardTitle>
                <CardDescription>Add medicines and vaccines to your inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveMedicineStock} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="medName">Medicine/Vaccine Name</Label>
                      <Input id="medName" required value={newMedicine.name} onChange={e => setNewMedicine({...newMedicine, name: e.target.value})} placeholder="e.g. Lasota" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medType">Type</Label>
                      <Select value={newMedicine.type} onValueChange={v => setNewMedicine({...newMedicine, type: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Medicine">Medicine</SelectItem>
                          <SelectItem value="Vaccine">Vaccine</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medQty">Quantity</Label>
                      <Input id="medQty" type="number" required value={newMedicine.quantity} onChange={e => setNewMedicine({...newMedicine, quantity: e.target.value})} placeholder="0" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medUnit">Unit</Label>
                      <Select value={newMedicine.unit} onValueChange={v => setNewMedicine({...newMedicine, unit: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="vial">vial</SelectItem>
                          <SelectItem value="tablet">tablet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medExpiry">Expiry Date</Label>
                      <Input id="medExpiry" type="date" value={newMedicine.expiryDate} onChange={e => setNewMedicine({...newMedicine, expiryDate: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medCost">Purchase Cost (Optional)</Label>
                      <Input id="medCost" type="number" value={newMedicine.purchaseCost} onChange={e => setNewMedicine({...newMedicine, purchaseCost: e.target.value})} placeholder="0" className="rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6" disabled={loading}>
                    <Plus className="mr-2" size={20} />
                    Add to Medicine Stock
                  </Button>
                </form>

                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-700 mb-4">Current Medicine Stock</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {medicineStock.map(item => (
                        <div key={item.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                          <div>
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">{item.type}</p>
                              <span className="text-[10px] text-slate-400">•</span>
                              <p className="text-[10px] text-slate-400">{item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy') : 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-indigo-600">{item.quantity} {item.unit}</p>
                              {item.purchaseCost > 0 && <p className="text-[10px] text-slate-500">₹{item.purchaseCost}</p>}
                              {item.expiryDate && <p className="text-[10px] text-red-500">Exp: {item.expiryDate}</p>}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteMedicineStock(item.id)} className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {medicineStock.length === 0 && <p className="text-sm text-slate-400">No stock recorded</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-700 mb-4">Recent Medicine Use Data</h3>
                    <div className="space-y-2">
                      {logs
                        .filter(log => log.health?.medicines || log.health?.vaccines)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 10)
                        .map(log => {
                          const flock = flocks.find(f => f.id === log.flockId);
                          return (
                            <div key={log.id} className="p-3 bg-indigo-50/50 rounded-xl flex justify-between items-center border border-indigo-100/50">
                              <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                  <Pill className="text-indigo-600" size={16} />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {log.health.medicines || log.health.vaccines}
                                    {(log.health.medicineDoses || log.health.vaccineDoses) && (
                                      <span className="ml-2 text-xs font-normal text-slate-500">
                                        ({log.health.medicineDoses || log.health.vaccineDoses} doses)
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {format(new Date(log.date), 'dd MMM yyyy')} • {flock?.name || 'Unknown Batch'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium text-indigo-600">Applied</p>
                                <p className="text-[10px] text-slate-400">Daily Health Record</p>
                              </div>
                            </div>
                          );
                        })}
                      {logs.filter(log => log.health?.medicines || log.health?.vaccines).length === 0 && (
                        <p className="text-sm text-slate-400">No medicine usage recorded yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Feed Stock */}
          {activeTab === 'feed_stock' && (
            <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="text-amber-600" />
                  Feed Stock Management
                </CardTitle>
                <CardDescription>Manage your poultry feed inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveFeedStock} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="feedName">Feed Name/Brand</Label>
                      <Input id="feedName" required value={newFeed.name} onChange={e => setNewFeed({...newFeed, name: e.target.value})} placeholder="e.g. Godrej Starter" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedType">Feed Type</Label>
                      <Select value={newFeed.type} onValueChange={v => setNewFeed({...newFeed, type: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pre-Starter">Pre-Starter</SelectItem>
                          <SelectItem value="Starter">Starter</SelectItem>
                          <SelectItem value="Grower">Grower</SelectItem>
                          <SelectItem value="Finisher">Finisher</SelectItem>
                          <SelectItem value="Layer Mash">Layer Mash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedQty">Quantity (kg)</Label>
                      <Input id="feedQty" type="number" required value={newFeed.quantity} onChange={e => setNewFeed({...newFeed, quantity: e.target.value})} placeholder="0" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchaseCost">Purchase Cost (Optional)</Label>
                      <Input id="purchaseCost" type="number" value={newFeed.purchaseCost} onChange={e => setNewFeed({...newFeed, purchaseCost: e.target.value})} placeholder="0" className="rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 rounded-xl py-6" disabled={loading}>
                    <Plus className="mr-2" size={20} />
                    Add to Feed Stock
                  </Button>
                </form>

                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-700 mb-4">Current Feed Stock</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.values(feedStock.reduce((acc: any, item) => {
                        const key = `${item.name}-${item.type}`;
                        if (!acc[key]) {
                          acc[key] = { ...item, quantity: 0, ids: [], lastEntry: item.createdAt };
                        }
                        acc[key].quantity += Number(item.quantity) || 0;
                        acc[key].ids.push(item.id);
                        if (item.createdAt && (!acc[key].lastEntry || new Date(item.createdAt) > new Date(acc[key].lastEntry))) {
                          acc[key].lastEntry = item.createdAt;
                        }
                        return acc;
                      }, {})).map((item: any) => (
                        <div key={`${item.name}-${item.type}`} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                          <div>
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">{item.type}</p>
                              {item.lastEntry && (
                                <>
                                  <span className="text-[10px] text-slate-400">•</span>
                                  <p className="text-[10px] text-slate-400">Last: {format(new Date(item.lastEntry), 'dd MMM')}</p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-amber-600">{item.quantity} kg</p>
                              <p className="text-[10px] text-slate-400">Total Available</p>
                            </div>
                            <div className="flex gap-1">
                              {item.ids.map((id: string) => (
                                <Button key={id} variant="ghost" size="icon" onClick={() => handleDeleteFeedStock(id)} className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 size={14} />
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {feedStock.length === 0 && <p className="text-sm text-slate-400">No stock recorded</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-700 mb-4">Feed Stock History (Additions & Deductions)</h3>
                    <div className="space-y-2">
                      {[
                        ...feedStock.map(item => ({
                          id: item.id,
                          type: 'addition',
                          name: item.name,
                          feedType: item.type,
                          quantity: item.quantity,
                          date: item.createdAt || new Date().toISOString(),
                          flockName: 'Stock Entry'
                        })),
                        ...logs
                          .filter(log => Number(log.consumption?.feedIntake) > 0)
                          .map(log => {
                            const flock = flocks.find(f => f.id === log.flockId);
                            return {
                              id: log.id,
                              type: 'deduction',
                              name: log.consumption.feedType,
                              feedType: log.consumption.feedType,
                              quantity: log.consumption.feedIntake,
                              date: log.date,
                              flockName: flock?.name || 'Unknown Batch'
                            };
                          })
                      ]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 15)
                        .map((entry, idx) => (
                          <div key={`${entry.id}-${idx}`} className={`p-3 rounded-xl flex justify-between items-center border ${entry.type === 'addition' ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-red-50/50 border-red-100/50'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${entry.type === 'addition' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                {entry.type === 'addition' ? (
                                  <Plus className="text-emerald-600" size={16} />
                                ) : (
                                  <ArrowDownRight className="text-red-600" size={16} />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{entry.name}</p>
                                <p className="text-xs text-slate-500">
                                  {format(new Date(entry.date), 'dd MMM yyyy')} • {entry.flockName}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${entry.type === 'addition' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {entry.type === 'addition' ? '+' : '-'}{entry.quantity} kg
                              </p>
                              <p className="text-[10px] text-slate-400">{entry.type === 'addition' ? 'Added' : 'Deducted'}</p>
                            </div>
                          </div>
                        ))}
                      {feedStock.length === 0 && logs.filter(log => Number(log.consumption?.feedIntake) > 0).length === 0 && (
                        <p className="text-sm text-slate-400">No history recorded yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Financial & Transaction Data */}
          {activeTab === 'finance' && (
            <Card className="border-none shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="text-emerald-700" />
                Financial & Transaction Data
              </CardTitle>
              <CardDescription>Track costs and sales for business analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="txType">Transaction Type</Label>
                    <Select value={transactionData.type} onValueChange={v => setTransactionData({...transactionData, type: v})}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Income">Income (Sales)</SelectItem>
                        <SelectItem value="Expense">Expense (Costs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={transactionData.category} onValueChange={v => setTransactionData({...transactionData, category: v})}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Feed">Feed Cost</SelectItem>
                        <SelectItem value="Medicine">Medicine Cost</SelectItem>
                        <SelectItem value="Labor">Labor Cost</SelectItem>
                        <SelectItem value="Electricity">Electricity & Maintenance</SelectItem>
                        <SelectItem value="Sales">Sales (Birds/Eggs)</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" type="number" required value={transactionData.amount} onChange={e => setTransactionData({...transactionData, amount: e.target.value})} placeholder="0.00" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="txDate">Date</Label>
                    <Input id="txDate" type="date" required value={transactionData.date} onChange={e => setTransactionData({...transactionData, date: e.target.value})} className="rounded-xl" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" required value={transactionData.description} onChange={e => setTransactionData({...transactionData, description: e.target.value})} placeholder="e.g. Bought 50 bags of starter feed" className="rounded-xl" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6" disabled={loading}>
                  <Save className="mr-2" size={20} />
                  Save Transaction
                </Button>
              </form>
              {renderSavedTransactions()}
            </CardContent>
          </Card>
          )}

          {/* Tab 8: Alert Indicators */}
          {activeTab === 'alerts' && (
            <Card className="border-none shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-red-600" />
                Alert Indicators
              </CardTitle>
              <CardDescription>Monitor early warning signals of disease</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDailyLog} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                    <Label htmlFor="feedDrop" className="cursor-pointer font-semibold text-red-900">Sudden drop in feed intake?</Label>
                    <input type="checkbox" id="feedDrop" checked={dailyLog.alerts.feedDrop} onChange={e => setDailyLog({...dailyLog, alerts: {...dailyLog.alerts, feedDrop: e.target.checked}})} className="w-6 h-6 rounded-lg accent-red-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                    <Label htmlFor="mortalityIncrease" className="cursor-pointer font-semibold text-red-900">Increase in mortality?</Label>
                    <input type="checkbox" id="mortalityIncrease" checked={dailyLog.alerts.mortalityIncrease} onChange={e => setDailyLog({...dailyLog, alerts: {...dailyLog.alerts, mortalityIncrease: e.target.checked}})} className="w-6 h-6 rounded-lg accent-red-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                    <Label htmlFor="eggDrop" className="cursor-pointer font-semibold text-red-900">Drop in egg production?</Label>
                    <input type="checkbox" id="eggDrop" checked={dailyLog.alerts.eggDrop} onChange={e => setDailyLog({...dailyLog, alerts: {...dailyLog.alerts, eggDrop: e.target.checked}})} className="w-6 h-6 rounded-lg accent-red-600" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="behavior">Abnormal Behavior</Label>
                    <Input id="behavior" value={dailyLog.alerts.abnormalBehavior} onChange={e => setDailyLog({...dailyLog, alerts: {...dailyLog.alerts, abnormalBehavior: e.target.value}})} placeholder="e.g. Lethargy, coughing, huddling" className="rounded-xl" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-6" disabled={loading || !selectedFlockId}>
                  <Save className="mr-2" size={20} />
                  Save Alert Status
                </Button>
              </form>
              {renderSavedLogs('Alerts')}
            </CardContent>
          </Card>
          )}
          
          {/* Tab: Analyze (Full Analytics) */}
          {activeTab === 'analyze' && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="text-indigo-600" />
                    Farm Analytics & Insights
                  </CardTitle>
                  <CardDescription>Comprehensive view of your farm's performance and data</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Live Insights Section */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {(() => {
                      const flockLogs = logs.filter(l => l.flockId === selectedFlockId);
                      const currentFlock = flocks.find(f => f.id === selectedFlockId);
                      const totalMortality = flockLogs.reduce((acc, l) => acc + (Number(l.health?.mortality) || 0), 0);
                      const latestWeight = flockLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.production?.avgWeight || 0;
                      const totalFeed = flockLogs.reduce((acc, l) => acc + (Number(l.consumption?.feedIntake) || 0), 0);
                      const mortalityRate = currentFlock?.initialCount ? ((totalMortality / currentFlock.initialCount) * 100).toFixed(1) : 0;

                      return (
                        <>
                          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-[10px] font-bold text-red-600 uppercase">Total Mortality</p>
                            <p className="text-2xl font-bold text-red-900">{totalMortality}</p>
                            <p className="text-[10px] text-red-500 mt-1">{mortalityRate}% Rate</p>
                          </div>
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Current Weight</p>
                            <p className="text-2xl font-bold text-emerald-900">{latestWeight}g</p>
                            <p className="text-[10px] text-emerald-500 mt-1">Latest Entry</p>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Total Feed</p>
                            <p className="text-2xl font-bold text-blue-900">{totalFeed}kg</p>
                            <p className="text-[10px] text-blue-500 mt-1">Consumed</p>
                          </div>
                          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                            <p className="text-[10px] font-bold text-purple-600 uppercase">Live Birds</p>
                            <p className="text-2xl font-bold text-purple-900">{currentFlock?.currentCount || 0}</p>
                            <p className="text-[10px] text-purple-500 mt-1">Remaining</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* FCR Trend Chart */}
                    <Card className="border border-slate-100 shadow-none rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-700">FCR Trend (Selected Flock)</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={logs
                            .filter(l => l.flockId === selectedFlockId)
                            .sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime())
                            .map(l => ({
                              time: new Date(l.timestamp || l.date).getTime(),
                              fcr: Number(l.consumption?.fcr) || 0
                            }))
                          }>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              type="number"
                              domain={['auto', 'auto']}
                              tickFormatter={(time) => format(new Date(time), 'dd MMM')} 
                              tick={{fontSize: 10}} 
                              minTickGap={30}
                            />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip />
                            <Line type="monotone" dataKey="fcr" stroke="#4f46e5" strokeWidth={2} dot={false} name="FCR" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Mortality Bar Chart */}
                    <Card className="border border-slate-100 shadow-none rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-700">Daily Mortality</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={logs
                            .filter(l => l.flockId === selectedFlockId)
                            .sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime())
                            .slice(-14)
                            .map(l => ({
                              time: new Date(l.timestamp || l.date).getTime(),
                              mortality: Number(l.health?.mortality) || 0
                            }))
                          }>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              type="number"
                              domain={['auto', 'auto']}
                              tickFormatter={(time) => format(new Date(time), 'dd MMM')} 
                              tick={{fontSize: 10}} 
                              minTickGap={30}
                            />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip />
                            <Bar dataKey="mortality" fill="#ef4444" radius={[4, 4, 0, 0]} name="Deaths" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Weight Gain Chart */}
                    <Card className="border border-slate-100 shadow-none rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-700">Average Weight (g)</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={logs
                            .filter(l => l.flockId === selectedFlockId)
                            .sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime())
                            .map(l => ({
                              time: new Date(l.timestamp || l.date).getTime(),
                              weight: Number(l.production?.avgWeight) || 0
                            }))
                          }>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="time" 
                              type="number"
                              domain={['auto', 'auto']}
                              tickFormatter={(time) => format(new Date(time), 'dd MMM')} 
                              tick={{fontSize: 10}} 
                              minTickGap={30}
                            />
                            <YAxis tick={{fontSize: 10}} />
                            <Tooltip />
                            <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={false} name="Weight (g)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Financial Summary Pie */}
                    <Card className="border border-slate-100 shadow-none rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-700">Expense Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.values(transactions.filter(t => t.type === 'Expense').reduce((acc: any, t) => {
                                acc[t.category] = (acc[t.category] || 0) + t.amount;
                                return acc;
                              }, {})).map((val, idx) => ({ name: Object.keys(transactions.filter(t => t.type === 'Expense').reduce((acc: any, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {}))[idx], value: val }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Data Table View */}
                  <div className="mt-10 space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" />
                        Detailed Logs Table
                      </h3>
                      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Flock</TableHead>
                              <TableHead>Feed (kg)</TableHead>
                              <TableHead>Weight (g)</TableHead>
                              <TableHead>Mortality</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logs.filter(l => !selectedFlockId || l.flockId === selectedFlockId).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-400">No logs found</TableCell>
                              </TableRow>
                            ) : (
                              logs.filter(l => !selectedFlockId || l.flockId === selectedFlockId).slice(0, 10).map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="font-medium">{format(new Date(log.date), 'MMM dd, yyyy')}</TableCell>
                                  <TableCell>{flocks.find(f => f.id === log.flockId)?.name || 'Unknown'}</TableCell>
                                  <TableCell>{log.consumption?.feedIntake || 0}</TableCell>
                                  <TableCell>{log.production?.avgWeight || 0}</TableCell>
                                  <TableCell className="text-red-600 font-medium">{log.health?.mortality || 0}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="icon" onClick={() => setEditingLog(log)} className="rounded-full h-8 w-8">
                                        <Edit2 size={14} />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id)} className="rounded-full h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                        <Trash2 size={14} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <IndianRupee size={18} className="text-emerald-700" />
                        Recent Transactions Table
                      </h3>
                      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-400">No transactions found</TableCell>
                              </TableRow>
                            ) : (
                              transactions.slice(0, 10).map((tx) => (
                                <TableRow key={tx.id}>
                                  <TableCell className="font-medium">{format(new Date(tx.date), 'MMM dd, yyyy')}</TableCell>
                                  <TableCell>{tx.description}</TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                      tx.type === 'Income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                    }`}>
                                      {tx.type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="font-bold">₹{tx.amount.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="icon" onClick={() => setEditingTransaction(tx)} className="rounded-full h-8 w-8">
                                        <Edit2 size={14} />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(tx.id)} className="rounded-full h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                        <Trash2 size={14} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-900">Edit Daily Record</DialogTitle>
              </DialogHeader>
              {editingLog && (
                <form onSubmit={handleUpdateLog} className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-date" className="font-bold">Date</Label>
                      <Input id="edit-date" type="date" value={editingLog.date} onChange={e => setEditingLog({...editingLog, date: e.target.value})} className="rounded-xl border-slate-200" />
                    </div>

                    {/* Feed & Water */}
                    <div className="space-y-4 md:col-span-2 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                      <h4 className="font-bold text-orange-700 flex items-center gap-2">
                        <Utensils size={16} /> Feed & Water
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Feed Intake (kg)</Label>
                          <Input type="number" value={editingLog.consumption.feedIntake} onChange={e => setEditingLog({...editingLog, consumption: {...editingLog.consumption, feedIntake: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Feed Type</Label>
                          <Select value={editingLog.consumption.feedType} onValueChange={v => setEditingLog({...editingLog, consumption: {...editingLog.consumption, feedType: v}})}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['Pre-Starter', 'Starter', 'Finisher', 'Layer', 'Counter'].map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Water Intake (L)</Label>
                          <Input type="number" value={editingLog.consumption.waterIntake} onChange={e => setEditingLog({...editingLog, consumption: {...editingLog.consumption, waterIntake: e.target.value}})} className="rounded-xl" />
                        </div>
                      </div>
                    </div>

                    {/* Production */}
                    <div className="space-y-4 md:col-span-2 p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                      <h4 className="font-bold text-purple-700 flex items-center gap-2">
                        <Scale size={16} /> Growth Section
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Avg Weight (g)</Label>
                          <Input type="number" value={editingLog.production.avgWeight} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, avgWeight: e.target.value}})} className="rounded-xl" />
                        </div>
                      </div>
                    </div>

                    {/* Eggs Section */}
                    <div className="space-y-4 md:col-span-2 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <h4 className="font-bold text-emerald-700 flex items-center gap-2">
                        <Plus size={16} /> Eggs Section
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Egg Count</Label>
                          <Input type="number" value={editingLog.production.eggCount} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, eggCount: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bad Eggs</Label>
                          <Input type="number" value={editingLog.production.badEggs} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, badEggs: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Egg Weight (g)</Label>
                          <Input type="number" value={editingLog.production.eggWeight} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, eggWeight: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Egg Quality</Label>
                          <Select value={editingLog.production.eggQuality} onValueChange={v => setEditingLog({...editingLog, production: {...editingLog.production, eggQuality: v}})}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Excellent">Excellent</SelectItem>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Health */}
                    <div className="space-y-4 md:col-span-2 p-4 bg-red-50/50 rounded-2xl border border-red-100">
                      <h4 className="font-bold text-red-700 flex items-center gap-2">
                        <Pill size={16} /> Health & Medication
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Vaccines</Label>
                          <Input value={editingLog.health.vaccines} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, vaccines: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Vaccine Doses</Label>
                          <Input type="number" value={editingLog.health.vaccineDoses} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, vaccineDoses: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Medicines</Label>
                          <Input value={editingLog.health.medicines} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, medicines: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Medicine Doses</Label>
                          <Input type="number" value={editingLog.health.medicineDoses} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, medicineDoses: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Mortality</Label>
                          <Input type="number" value={editingLog.health.mortality} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, mortality: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Culling</Label>
                          <Input type="number" value={editingLog.health.culling} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, culling: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Symptoms</Label>
                          <Input value={editingLog.health.symptoms} onChange={e => setEditingLog({...editingLog, health: {...editingLog.health, symptoms: e.target.value}})} className="rounded-xl" />
                        </div>
                      </div>
                    </div>

                    {/* Biosecurity */}
                    <div className="space-y-4 md:col-span-2 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <h4 className="font-bold text-emerald-700 flex items-center gap-2">
                        <ShieldCheck size={16} /> Biosecurity
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editingLog.biosecurity.cleaning} onChange={e => setEditingLog({...editingLog, biosecurity: {...editingLog.biosecurity, cleaning: e.target.checked}})} />
                          <Label>Cleaning</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editingLog.biosecurity.disinfection} onChange={e => setEditingLog({...editingLog, biosecurity: {...editingLog.biosecurity, disinfection: e.target.checked}})} />
                          <Label>Disinfection</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editingLog.biosecurity.footbath} onChange={e => setEditingLog({...editingLog, biosecurity: {...editingLog.biosecurity, footbath: e.target.checked}})} />
                          <Label>Footbath</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>Visitors</Label>
                          <Input type="number" value={editingLog.biosecurity.visitors} onChange={e => setEditingLog({...editingLog, biosecurity: {...editingLog.biosecurity, visitors: e.target.value}})} className="rounded-xl" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setEditingLog(null)} className="rounded-xl py-6 flex-1">Cancel</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 flex-1" disabled={loading}>Save Changes</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Transaction Dialog */}
          <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
            <DialogContent className="sm:max-w-[500px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
              </DialogHeader>
              {editingTransaction && (
                <form onSubmit={handleUpdateTransaction} className="space-y-4 py-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-tx-desc">Description</Label>
                      <Input id="edit-tx-desc" value={editingTransaction.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-tx-amount">Amount (₹)</Label>
                        <Input id="edit-tx-amount" type="number" value={editingTransaction.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: Number(e.target.value)})} className="rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-tx-date">Date</Label>
                        <Input id="edit-tx-date" type="date" value={editingTransaction.date} onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})} className="rounded-xl" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setEditingTransaction(null)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={loading}>Save Changes</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default AddData;
