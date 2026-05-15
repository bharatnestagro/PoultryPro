import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, addDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
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
  CreditCard,
  Building2,
  Phone,
  Mail,
  Lock,
  MapPin,
  ClipboardList,
  Plus,
  Calendar,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Bird
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
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isManager } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All Types');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

  // Auto-open task if UID is provided in URL
  useEffect(() => {
    const uid = searchParams.get('uid');
    if (uid && farmers.length > 0) {
      if (farmers.some(f => f.id === uid)) {
        setSelectedFarmerId(uid);
        setIsSchedulingTask(true);
      }
    }
  }, [searchParams, farmers]);
  const [selectedFarmerFlocks, setSelectedFarmerFlocks] = useState<any[]>([]);
  const [selectedFarmerLogs, setSelectedFarmerLogs] = useState<any[]>([]);
  const [selectedFarmerStock, setSelectedFarmerStock] = useState<{ feed: any[], medicine: any[] }>({ feed: [], medicine: [] });
  const [selectedFarmerTransactions, setSelectedFarmerTransactions] = useState<any[]>([]);
  const [expandedFlockId, setExpandedFlockId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [isAddingFarmer, setIsAddingFarmer] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [newFarmer, setNewFarmer] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    farmName: '',
    farmType: 'Broiler',
    birdCapacity: '',
    address: '',
    liftingDays: '0'
  });
  const [editingDetails, setEditingDetails] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule'>('overview');
  const [scheduleTemplates, setScheduleTemplates] = useState<any[]>([]);
  const [farmerSchedule, setFarmerSchedule] = useState<any | null>(null);
  const [isSchedulingTask, setIsSchedulingTask] = useState(false);
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    category: 'Vaccination',
    scheduledDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState<{name: string, description: string, days: any[]}>({
    name: '',
    description: '',
    days: []
  });


  const handleScheduleTask = async () => {
    if (!selectedFarmerId || !taskData.title) {
      toast.error('Task title is required');
      return;
    }
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        userId: selectedFarmerId,
        creatorId: user?.uid,
        creatorType: isAdmin ? 'Admin' : 'Manager',
        status: 'Pending',
        createdAt: new Date().toISOString()
      });
      toast.success('Task scheduled for farmer');
      setIsSchedulingTask(false);
      setTaskData({
        title: '',
        description: '',
        category: 'Vaccination',
        scheduledDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
      toast.error('Failed to schedule task');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const allFarmers = list
        .filter((u: any) => u.email !== user?.email && (u.role === 'farmer' || !u.role))
        .filter((u: any) => {
          if (isManager && !isAdmin) {
            return u.managerId === user?.uid || u.assignedManagerId === user?.uid;
          }
          return true;
        });
      
      const allManagers = list
        .filter((u: any) => u.role === 'manager' || u.role === 'sub-admin' || u.role === 'admin');
      
      setManagers(allManagers);

      // Sort manually to avoid index requirements
      const sortedList = [...allFarmers].sort((a: any, b: any) => {
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
  }, [user]);

  const handleAssignManager = async (farmerId: string, managerId: string | null) => {
    try {
      await updateDoc(doc(db, 'users', farmerId), {
        assignedManagerId: managerId || '',
        managerId: managerId || ''
      });
      toast.success('Manager assigned successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      toast.error('Failed to assign manager');
    }
  };

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

    // Fetch Schedule Templates
    const qTemplates = query(collection(db, 'scheduleTemplates'));
    const unsubTemplates = onSnapshot(qTemplates, (snap) => {
      setScheduleTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubFlocks();
      unsubLogs();
      unsubFeed();
      unsubMed();
      unsubTxs();
      unsubTemplates();
    };
  }, [selectedFarmerId]);

  useEffect(() => {
    if (!selectedFarmerId) {
      setFarmerSchedule(null);
      return;
    }

    const qSchedule = query(collection(db, 'schedules'), where('userId', '==', selectedFarmerId));
    const unsubSchedule = onSnapshot(qSchedule, (snap) => {
      if (!snap.empty) {
        setFarmerSchedule({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setFarmerSchedule(null);
      }
    });

    return () => unsubSchedule();
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

  const handleSendResetLink = async (farmer: any) => {
    if (!farmer.email) {
      toast.error('This farmer does not have a registered email address');
      return;
    }
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, farmer.email);
      toast.success(`Password reset link sent to ${farmer.email}`);
    } catch (error: any) {
      console.error('Reset link error:', error);
      toast.error('Failed to send reset link: ' + (error.message || 'Unknown error'));
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

  const handleAddFarmer = async () => {
    if (!newFarmer.email || !newFarmer.password || !newFarmer.name) {
      toast.error('Name, email and password are required');
      return;
    }

    setIsCreating(true);
    try {
      // Create a secondary Firebase app for creating the user to avoid logging out the admin
      const appName = `AddFarmer_${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newFarmer.email, newFarmer.password);
      const newUser = userCredential.user;

      // Add profile info to Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        name: newFarmer.name,
        email: newFarmer.email,
        phone: newFarmer.phone,
        farmName: newFarmer.farmName,
        farmType: newFarmer.farmType,
        birdCapacity: Number(newFarmer.birdCapacity) || 0,
        address: newFarmer.address,
        liftingDays: Number(newFarmer.liftingDays) || 0,
        role: 'farmer',
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      // Cleanup secondary app
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      toast.success('Farmer added successfully');
      setIsAddingFarmer(false);
      setNewFarmer({
        name: '',
        email: '',
        password: '',
        phone: '',
        farmName: '',
        farmType: 'Broiler',
        birdCapacity: '',
        address: '',
        liftingDays: '0'
      });
    } catch (error: any) {
      console.error('Add farmer error:', error);
      toast.error(error.message || 'Failed to add farmer');
    } finally {
      setIsCreating(false);
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

  // Derived stats for selected farmer
  const selectedFarmerStats = {
    totalFlocks: selectedFarmerFlocks.length,
    totalBirds: selectedFarmerFlocks.reduce((sum, f) => sum + (Number(f.currentCount) || 0), 0),
    balance: selectedFarmerTransactions.reduce((sum, t) => sum + (t.type === 'payment' ? -t.amount : t.amount), 0),
    compliance: getLogPercentage(),
    feedStock: selectedFarmerStock.feed.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
    feedValue: selectedFarmerStock.feed.reduce((sum, s) => sum + (Number(s.purchaseCost) || 0), 0)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL FARMERS</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{(stats.totalBirds / 1000).toFixed(1)}k</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL CAPACITY</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{stats.activeEngagement}%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE ENGAGEMENT</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm flex items-center gap-6">
          <div className="bg-rose-50 p-4 rounded-2xl text-rose-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{farmers.filter(f => f.status === 'Inactive').length}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">INACTIVE ACCOUNTS</p>
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
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ASSIGNED MANAGER</TableHead>
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
                        {farmer.name ? farmer.name.split(' ').map((n: any) => n[0]).join('') : '??'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{farmer.name || 'Anonymous'}</p>
                        <p className="text-xs text-slate-400 font-medium">{farmer.farmName || 'No Farm Name'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-[200px]">
                      {farmer.address || 'Not provided'}
                    </p>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-700 p-2 focus:ring-0 w-[150px] ${(!isAdmin && isManager) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      value={farmer.assignedManagerId || ''}
                      onChange={(e) => handleAssignManager(farmer.id, e.target.value)}
                      disabled={!isAdmin && isManager}
                    >
                      <option value="">No Manager</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.uid || m.id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
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
                          onClick={() => {
                            setSelectedFarmerId(farmer.id);
                            setIsSchedulingTask(true);
                          }}
                        >
                          <ClipboardList size={16} />
                          Farmer Task
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium cursor-pointer"
                          onClick={() => handleToggleStatus(farmer)}
                        >
                          <Power size={16} />
                          {farmer.status === 'Inactive' ? 'Activate Account' : 'Deactivate Account'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium cursor-pointer"
                          onClick={() => handleSendResetLink(farmer)}
                        >
                          <Mail size={16} />
                          Send Reset Link
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <Users size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Farmer Insights: {selectedFarmer.name}</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Comprehensive Performance & Inventory Analysis</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
              <Button 
                variant={activeTab === 'overview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('overview')}
                className={`rounded-xl px-6 font-bold text-xs uppercase tracking-widest h-10 ${activeTab === 'overview' ? 'bg-[#122B21] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Overview
              </Button>
              <Button 
                variant={activeTab === 'schedule' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('schedule')}
                className={`rounded-xl px-6 font-bold text-xs uppercase tracking-widest h-10 ${activeTab === 'schedule' ? 'bg-[#122B21] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Schedule
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setSelectedFarmerId(null)} className="text-slate-400 hover:text-slate-900 rounded-xl">
              Close Details
            </Button>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Profile Card */}
              <Card className="lg:col-span-1 border-none shadow-sm bg-white rounded-[2rem] p-8 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 italic font-black text-2xl uppercase">
                    {selectedFarmer.name?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedFarmer.name}</h3>
                    <p className="text-sm font-medium text-slate-500">{selectedFarmer.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold uppercase text-[10px] px-3 py-1">
                      {selectedFarmer.status || 'Active'}
                    </Badge>
                    <Badge className="bg-slate-50 text-slate-500 border-none font-bold uppercase text-[10px] px-3 py-1">
                      {selectedFarmer.farmType || 'Standard'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-50">
                   <div className="flex items-center gap-3 text-slate-600">
                      <Phone size={16} className="text-slate-400" />
                      <span className="text-xs font-bold">{selectedFarmer.phone || 'No phone added'}</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-600">
                      <MapPin size={16} className="text-slate-400" />
                      <span className="text-xs font-bold">{selectedFarmer.farmArea || '0'} Acres Farm</span>
                   </div>
                   <div className="flex items-center gap-3 text-slate-600">
                      <Bird size={16} className="text-slate-400" />
                      <span className="text-xs font-bold">{selectedFarmer.birdCapacity || '0'} Total Capacity</span>
                   </div>
                </div>
              </Card>

              {/* Performance Stats Row */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-min">
                <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
                        <Package size={20} />
                      </div>
                      <TrendingUp size={16} className="text-emerald-500" />
                   </div>
                   <div className="mt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Flocks</p>
                      <h4 className="text-2xl font-black text-slate-900">{selectedFarmerStats.totalFlocks}</h4>
                      <p className="text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">Healthy Growth</p>
                   </div>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="bg-emerald-50 p-2.5 rounded-2xl text-emerald-600">
                        <Users size={20} />
                      </div>
                      <ArrowUpRight size={16} className="text-emerald-500" />
                   </div>
                   <div className="mt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Birds</p>
                      <h4 className="text-2xl font-black text-slate-900">{selectedFarmerStats.totalBirds.toLocaleString()}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 flex gap-2">
                        <span>Max Cap: {selectedFarmer.birdCapacity?.toLocaleString() || 0}</span>
                      </p>
                   </div>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="bg-orange-50 p-2.5 rounded-2xl text-orange-600">
                        <CreditCard size={20} />
                      </div>
                      <ArrowDownRight size={16} className="text-rose-500" />
                   </div>
                   <div className="mt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Balance</p>
                      <h4 className="text-2xl font-black text-slate-900">₹{selectedFarmerStats.balance.toLocaleString()}</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Updated Just Now</p>
                   </div>
                </Card>

                {/* Sub-Detailed Stats */}
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Card className="border-none shadow-sm bg-[#122B21] text-white rounded-[2rem] p-8 overflow-hidden relative group">
                      <div className="relative z-10 flex h-full items-center gap-6">
                         <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <Activity size={32} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-emerald-300/60 uppercase tracking-widest mb-1">Batch Compliance</p>
                            <h4 className="text-3xl font-black">{selectedFarmerStats.compliance}%</h4>
                            <p className="text-xs text-emerald-200/80 font-medium mt-1">Excellent record keeping status</p>
                         </div>
                      </div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                   </Card>

                   <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 border border-slate-50 flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 rounded-[1.5rem] bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                            <Package size={32} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Feed Stock</p>
                            <h4 className="text-2xl font-black text-slate-900">{selectedFarmerStats.feedStock.toLocaleString()} KG</h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">Inventory Value: ₹{selectedFarmerStats.feedValue.toLocaleString()}</p>
                         </div>
                      </div>
                      <Download size={20} className="text-slate-200 group-hover:text-emerald-500 cursor-pointer transition-colors" />
                   </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Schedule Management UI */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Assignment & Configuration */}
                <Card className="lg:col-span-1 border-none shadow-sm bg-white rounded-[2rem] p-8">
                  <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Calendar className="text-emerald-500" size={20} />
                    Active Schedule
                  </h4>
                  
                  {farmerSchedule ? (
                    <div className="space-y-6">
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative overflow-hidden group">
                        <div className="relative z-10">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Template</p>
                          <h5 className="text-lg font-black text-slate-900">{farmerSchedule.templateName}</h5>
                          <p className="text-xs text-slate-500 font-medium mt-2">Started: {format(new Date(farmerSchedule.startDate), 'MMM dd, yyyy')}</p>
                        </div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visible Duration (Days)</Label>
                          <Select 
                            value={String(selectedFarmer.scheduleDisplayDays || 2)} 
                            onValueChange={async (v) => {
                              try {
                                await updateDoc(doc(db, 'users', selectedFarmerId), { scheduleDisplayDays: Number(v) });
                                toast.success('Visibility duration updated');
                              } catch (err) {
                                toast.error('Failed to update visibility');
                              }
                            }}
                          >
                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold">
                              <SelectValue placeholder="Display days" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                              <SelectItem value="1">1 Day</SelectItem>
                              <SelectItem value="2">2 Days (Default)</SelectItem>
                              <SelectItem value="3">3 Days</SelectItem>
                              <SelectItem value="5">5 Days</SelectItem>
                              <SelectItem value="7">1 Week</SelectItem>
                              <SelectItem value="14">2 Weeks</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-400 font-medium ml-1 italic">Farmer will only see tasks for the next {selectedFarmer.scheduleDisplayDays || 2} days</p>
                        </div>

                        <Button 
                          variant="outline" 
                          className="w-full h-14 rounded-2xl font-bold border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200"
                          onClick={async () => {
                            if (!window.confirm('Delete this active schedule?')) return;
                            try {
                              await deleteDoc(doc(db, 'schedules', farmerSchedule.id));
                              toast.success('Schedule removed');
                            } catch (err) {
                              toast.error('Failed to remove schedule');
                            }
                          }}
                        >
                          <Trash2 size={16} className="mr-2" />
                          Remove Schedule
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                      <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="font-bold text-slate-500 text-sm">No active schedule assigned</p>
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="mt-6 rounded-xl bg-emerald-600 font-bold px-6 h-10"
                        onClick={() => setShowApplyTemplateDialog(true)}
                      >
                        Assign Template
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Schedule Timeline / Tasks */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[2rem] p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="font-bold text-slate-900 tracking-tight">Schedule Timeline</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowTemplateDialog(true)}
                      className="rounded-xl border-slate-200 font-bold h-10 px-4 flex items-center gap-2"
                    >
                      <Plus size={16} className="text-emerald-500" />
                      Manage Templates
                    </Button>
                  </div>

                  <div className="space-y-6">
                    {farmerSchedule ? (
                      <div className="relative pl-8 border-l-2 border-slate-100 space-y-8">
                        {/* Calculate and render schedule dates based on template */}
                        {(() => {
                          const template = scheduleTemplates.find(t => t.id === farmerSchedule.templateId);
                          if (!template) return <p className="text-slate-400 italic">Template no longer exists</p>;
                          
                          return template.days.sort((a: any, b: any) => a.day - b.day).map((dayTask: any, idx: number) => {
                            const taskDate = new Date(farmerSchedule.startDate);
                            taskDate.setDate(taskDate.getDate() + (dayTask.day - 1));
                            const isToday = format(new Date(), 'yyyy-MM-dd') === format(taskDate, 'yyyy-MM-dd');
                            const isPast = taskDate < new Date(new Date().setHours(0,0,0,0));
                            
                            return (
                              <div key={idx} className="relative group">
                                <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-colors ${isToday ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : isPast ? 'bg-slate-300' : 'bg-slate-100 group-hover:bg-emerald-200'}`}></div>
                                <div className={`p-5 rounded-2xl border transition-all ${isToday ? 'bg-emerald-50/50 border-emerald-100 ring-1 ring-emerald-100 shadow-sm' : 'bg-slate-50/30 border-slate-50'}`}>
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        Day {dayTask.day} • {format(taskDate, 'MMM dd, yyyy')} {isToday ? '(TODAY)' : ''}
                                      </p>
                                      <h6 className="font-bold text-slate-900 mt-1">{dayTask.title}</h6>
                                      <p className="text-xs text-slate-500 mt-1">{dayTask.description}</p>
                                    </div>
                                    <Badge className={`${
                                      dayTask.category === 'Vaccination' ? 'bg-amber-100 text-amber-700' : 
                                      dayTask.category === 'Medicine Plan' ? 'bg-indigo-100 text-indigo-700' : 
                                      'bg-slate-100 text-slate-600'
                                    } border-none font-bold text-[9px] rounded-lg`}>
                                      {dayTask.category}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <ClipboardList size={32} className="text-slate-200" />
                        </div>
                        <p className="text-slate-400 italic">No tasks to display. Assign a template to start scheduling.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Template Management Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden max-h-[90vh]">
          <div className="bg-slate-900 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic tracking-tight">Schedule Templates</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium">Create batch-wide templates for feed, vaccination, and medicine plans.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 h-[600px]">
            {/* Existing Templates */}
            <div className="p-8 border-r border-slate-50 overflow-y-auto space-y-4">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Saved Templates</h5>
              {scheduleTemplates.map(t => (
                <div key={t.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900">{t.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{t.days?.length} Tasks Defined</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-300 hover:text-red-600 h-8 w-8"
                      onClick={async () => {
                        if (confirm('Delete template?')) await deleteDoc(doc(db, 'scheduleTemplates', t.id));
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
              {scheduleTemplates.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">No templates saved yet</p>}
            </div>

            {/* Create/Edit Template */}
            <div className="p-8 bg-white overflow-y-auto space-y-6">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Create Template</h5>
              <div className="space-y-4">
                <Input 
                  placeholder="Template Name (e.g., 40-Day Broiler Plan)" 
                  className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold"
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                />
                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">Daily Tasks</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-emerald-600 font-bold h-8"
                      onClick={() => setNewTemplate({...newTemplate, days: [...newTemplate.days, { day: 1, title: '', description: '', category: 'Other' }]})}
                    >
                      <Plus size={14} className="mr-1" /> Add Day Task
                    </Button>
                  </div>
                  
                  {newTemplate.days.map((d: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 relative">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-2 top-2 h-6 w-6 text-slate-300 hover:text-red-500"
                        onClick={() => setNewTemplate({...newTemplate, days: newTemplate.days.filter((_: any, idx: number) => idx !== i)})}
                      >
                        <Trash2 size={12} />
                      </Button>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <Label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Day</Label>
                          <Input 
                            type="number" 
                            className="h-10 rounded-lg bg-white border-slate-200 font-bold" 
                            value={d.day}
                            onChange={e => {
                              const updatedDays = [...newTemplate.days];
                              updatedDays[i].day = Number(e.target.value);
                              setNewTemplate({...newTemplate, days: updatedDays});
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-[9px] font-bold uppercase text-slate-400 ml-1">Task Title</Label>
                          <Input 
                            className="h-10 rounded-lg bg-white border-slate-200 font-bold" 
                            value={d.title}
                            onChange={e => {
                              const updatedDays = [...newTemplate.days];
                              updatedDays[i].title = e.target.value;
                              setNewTemplate({...newTemplate, days: updatedDays});
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <Select value={d.category} onValueChange={v => {
                            const updatedDays = [...newTemplate.days];
                            updatedDays[i].category = v;
                            setNewTemplate({...newTemplate, days: updatedDays});
                         }}>
                            <SelectTrigger className="h-10 rounded-lg bg-white border-slate-200 font-bold">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="Vaccination">Vaccination</SelectItem>
                              <SelectItem value="Medicine Plan">Medicine Plan</SelectItem>
                              <SelectItem value="Cleaning">Cleaning</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                         </Select>
                         <Input 
                            className="h-10 rounded-lg bg-white border-slate-200 font-bold placeholder:text-[10px]" 
                            placeholder="Brief Instruction"
                            value={d.description}
                            onChange={e => {
                              const updatedDays = [...newTemplate.days];
                              updatedDays[i].description = e.target.value;
                              setNewTemplate({...newTemplate, days: updatedDays});
                            }}
                          />
                      </div>
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full h-12 rounded-xl bg-emerald-600 font-bold transition-all hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                  onClick={async () => {
                    if (!newTemplate.name) return toast.error('Template name required');
                    try {
                      await addDoc(collection(db, 'scheduleTemplates'), { ...newTemplate, createdAt: new Date().toISOString() });
                      toast.success('Template saved');
                      setNewTemplate({ name: '', description: '', days: [] });
                    } catch (err) { toast.error('Failed to save template'); }
                  }}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Template Dialog */}
      <Dialog open={showApplyTemplateDialog} onOpenChange={setShowApplyTemplateDialog}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic">Assign Batch Schedule</DialogTitle>
            <DialogDescription className="font-medium">Apply a saved template to {selectedFarmer?.name}'s farm operations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Template</Label>
              <Select onValueChange={(v) => {
                const t = scheduleTemplates.find(x => x.id === v);
                setFarmerSchedule(prev => ({ ...prev, templateId: v, templateName: t.name }));
              }}>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold">
                  <SelectValue placeholder="Choose a plan..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {scheduleTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</Label>
              <Input 
                type="date" 
                className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold"
                value={farmerSchedule?.startDate || format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setFarmerSchedule({...farmerSchedule, startDate: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl h-14 px-8 border-slate-100 font-bold" onClick={() => setShowApplyTemplateDialog(false)}>Cancel</Button>
            <Button 
              className="rounded-2xl h-14 bg-emerald-600 font-bold px-10 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
              onClick={async () => {
                if (!farmerSchedule?.templateId || !farmerSchedule?.startDate) return toast.error('Selection required');
                try {
                  const existingSchedules = await addDoc(collection(db, 'schedules'), {
                    userId: selectedFarmerId,
                    templateId: farmerSchedule.templateId,
                    templateName: farmerSchedule.templateName,
                    startDate: farmerSchedule.startDate,
                    assignedBy: user?.uid,
                    createdAt: new Date().toISOString()
                  });
                  toast.success('Schedule assigned successfully');
                  setShowApplyTemplateDialog(false);
                } catch (err) { toast.error('Failed to assign schedule'); }
              }}
            >
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Floating Action Button with Dialog */}
      <Dialog open={isAddingFarmer} onOpenChange={setIsAddingFarmer}>
        <DialogTrigger render={
          <Button className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-[#122B21] hover:bg-[#1a3d2e] shadow-2xl flex items-center justify-center p-0 z-50">
            <UserPlus size={24} className="text-white" />
          </Button>
        } />
        <DialogContent className="rounded-[2.5rem] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <div className="bg-emerald-600 p-10 text-white relative overflow-hidden">
            <div className="relative z-10">
              <DialogHeader>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <UserPlus size={32} className="text-white" />
                </div>
                <DialogTitle className="text-3xl font-black italic tracking-tight">Onboard New Farmer</DialogTitle>
                <DialogDescription className="text-emerald-100 text-lg font-medium opacity-90">
                  Register a new farmer account and initialize their farm profile.
                </DialogDescription>
              </DialogHeader>
            </div>
            {/* Abstract Decorative Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
          </div>

          <div className="p-10 space-y-8 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</Label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Enter farmer's name" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.name}
                    onChange={(e) => setNewFarmer({...newFarmer, name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Contact Number</Label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="+91 00000 00000" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.phone}
                    onChange={(e) => setNewFarmer({...newFarmer, phone: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="email"
                    placeholder="farmer@example.com" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.email}
                    onChange={(e) => setNewFarmer({...newFarmer, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="password"
                    placeholder="Set generic password" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.password}
                    onChange={(e) => setNewFarmer({...newFarmer, password: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Farm Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Enter farm name" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.farmName}
                    onChange={(e) => setNewFarmer({...newFarmer, farmName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Farm Type</Label>
                <Select value={newFarmer.farmType} onValueChange={(v) => setNewFarmer({...newFarmer, farmType: v})}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 font-bold">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    <SelectItem value="Broiler" className="rounded-xl font-medium">Broiler Farm</SelectItem>
                    <SelectItem value="Gavthi" className="rounded-xl font-medium">Gavthi Farm</SelectItem>
                    <SelectItem value="Sonali" className="rounded-xl font-medium">Sonali Farm</SelectItem>
                    <SelectItem value="Layer" className="rounded-xl font-medium">Layer Farm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Lifting Days Plan</Label>
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="number"
                    placeholder="e.g. 40" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.liftingDays}
                    onChange={(e) => setNewFarmer({...newFarmer, liftingDays: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bird Capacity</Label>
                <div className="relative">
                  <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="number"
                    placeholder="e.g. 5000" 
                    className="pl-12 h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                    value={newFarmer.birdCapacity}
                    onChange={(e) => setNewFarmer({...newFarmer, birdCapacity: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Address / Location</Label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                <textarea 
                  placeholder="Enter complete farm address..." 
                  className="w-full min-h-[120px] pl-12 pt-4 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 focus:outline-none transition-all font-bold text-sm resize-none"
                  value={newFarmer.address}
                  onChange={(e) => setNewFarmer({...newFarmer, address: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter className="pt-6">
              <Button 
                variant="outline" 
                className="rounded-2xl h-14 px-8 border-slate-200 font-bold hover:bg-slate-50"
                onClick={() => setIsAddingFarmer(false)}
              >
                Cancel
              </Button>
              <Button 
                className="rounded-2xl h-14 px-12 bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200"
                onClick={handleAddFarmer}
                disabled={isCreating}
              >
                {isCreating ? 'Finalizing...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={isEditingDetails} onOpenChange={setIsEditingDetails}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
            <div className="relative z-10">
              <DialogHeader>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Edit2 size={32} className="text-white" />
                </div>
                <DialogTitle className="text-3xl font-black italic tracking-tight">Manage Details</DialogTitle>
                <DialogDescription className="text-slate-400 text-lg font-medium opacity-90">
                  Update farmer profile and operational parameters.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="p-10 space-y-8 bg-white">
            {editingDetails && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</Label>
                    <Input 
                      className="h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                      value={editingDetails.name}
                      onChange={(e) => setEditingDetails({...editingDetails, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</Label>
                    <Input 
                      className="h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                      value={editingDetails.phone}
                      onChange={(e) => setEditingDetails({...editingDetails, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Lifting Days Plan</Label>
                    <Input 
                      type="number"
                      className="h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                      value={editingDetails.liftingDays || '0'}
                      onChange={(e) => setEditingDetails({...editingDetails, liftingDays: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bird Capacity</Label>
                    <Input 
                      type="number"
                      className="h-14 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold"
                      value={editingDetails.birdCapacity}
                      onChange={(e) => setEditingDetails({...editingDetails, birdCapacity: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Farm Address</Label>
                  <textarea 
                    className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold text-sm resize-none"
                    value={editingDetails.address}
                    onChange={(e) => setEditingDetails({...editingDetails, address: e.target.value})}
                  />
                </div>

                <DialogFooter className="pt-6">
                  <Button 
                    variant="outline" 
                    className="rounded-2xl h-14 px-8 border-slate-200 font-bold"
                    onClick={() => setIsEditingDetails(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="rounded-2xl h-14 px-12 bg-[#122B21] hover:bg-slate-900 font-bold shadow-lg shadow-slate-200"
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'users', editingDetails.id), {
                          name: editingDetails.name,
                          phone: editingDetails.phone,
                          liftingDays: Number(editingDetails.liftingDays) || 0,
                          birdCapacity: Number(editingDetails.birdCapacity) || 0,
                          address: editingDetails.address
                        });
                        toast.success('Farmer details updated successfully');
                        setIsEditingDetails(false);
                      } catch (error) {
                        toast.error('Failed to update details');
                      }
                    }}
                  >
                    Update Details
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Task Scheduling Dialog */}
      <Dialog open={isSchedulingTask} onOpenChange={setIsSchedulingTask}>
        <DialogContent className="rounded-[2.5rem] max-w-lg bg-white p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardList className="text-emerald-500" />
              Schedule Farmer Task
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400">
              Assign a new task, vaccination, or medicine plan to {selectedFarmer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Task Title</Label>
              <Input 
                placeholder="e.g. ND Lasota Vaccination" 
                className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:ring-emerald-500 font-bold"
                value={taskData.title}
                onChange={e => setTaskData({...taskData, title: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</Label>
                <Select value={taskData.category} onValueChange={v => setTaskData({...taskData, category: v})}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-slate-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    <SelectItem value="Vaccination">Vaccination</SelectItem>
                    <SelectItem value="Medicine Plan">Medicine Plan</SelectItem>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Scheduled Date</Label>
                <Input 
                  type="date" 
                  className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:ring-emerald-500 font-bold"
                  value={taskData.scheduledDate}
                  onChange={e => setTaskData({...taskData, scheduledDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description / Instructions</Label>
              <textarea 
                placeholder="Any specific instructions for the farmer..." 
                className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border-slate-100 border-2 focus:ring-emerald-500 transition-all font-bold text-sm resize-none"
                value={taskData.description}
                onChange={e => setTaskData({...taskData, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl h-14 px-8 border-slate-200 font-bold" onClick={() => setIsSchedulingTask(false)}>
              Cancel
            </Button>
            <Button 
              className="rounded-2xl h-14 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-200"
              onClick={handleScheduleTask}
            >
              Schedule Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFarmers;
