import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc, orderBy, limit } from 'firebase/firestore';
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
  ClipboardList, Egg, TrendingUp, Download, ChevronDown, ChevronUp, ClipboardCheck,
  Users, Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { jsPDF } from 'jspdf';
import domtoimage from 'dom-to-image';
import html2canvas from 'html2canvas';
import LicenseGuard from '@/src/components/LicenseGuard';
import { runAutoAlertEngine, fetchWeather } from '@/src/lib/alertEngine';

const AddData: React.FC = () => {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [soldFlocks, setSoldFlocks] = useState<any[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(searchParams.get('tab'));
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [redirectToAlerts, setRedirectToAlerts] = useState(false);
  const toggleSection = (sectionId: string) => {
    // Exclusive expansion: set only the selected one to true, others false
    setExpandedSections(prev => ({
      [sectionId]: !prev[sectionId]
    }));
  };
  const [medicineStock, setMedicineStock] = useState<any[]>([]);
  const [feedStock, setFeedStock] = useState<any[]>([]);
  const [editingFlock, setEditingFlock] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [hatcheryBatches, setHatcheryBatches] = useState<any[]>([]);
  const [incubatorLogs, setIncubatorLogs] = useState<any[]>([]);
  const [editingHatcheryBatch, setEditingHatcheryBatch] = useState<any>(null);
  const [hatcheryData, setHatcheryData] = useState({
    batchName: '',
    eggsSet: '',
    setDate: format(new Date(), 'yyyy-MM-dd'),
    expectedHatchDate: format(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    actualHatchDate: '',
    chicksHatched: '',
    gradeA: '',
    gradeB: '',
    mortality: '',
    cost: '',
    status: 'Incubating',
    notes: ''
  });
  const [incubatorLog, setIncubatorLog] = useState({
    batchId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    temperature: '',
    humidity: '',
    ventilation: 'Normal',
    turning: true,
    waterLevel: 'Full',
    notes: ''
  });

  const handleSaveIncubatorLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'incubatorLogs'), {
        ...incubatorLog,
        userId: user.uid,
        temperature: Number(incubatorLog.temperature) || 0,
        humidity: Number(incubatorLog.humidity) || 0,
        timestamp: new Date().toISOString()
      });
      toast.success('Incubator reading saved');
      setIncubatorLog({ ...incubatorLog, temperature: '', humidity: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'incubatorLogs');
      toast.error('Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  const [historyFilter, setHistoryFilter] = useState('daily');
  const [reportFlockId, setReportFlockId] = useState<string | null>(null);
  const [farmerSchedule, setFarmerSchedule] = useState<any>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch Farmer's Active Schedule (Roadmap)
    const qSchedule = query(
      collection(db, 'schedules'),
      where('userId', '==', user.uid),
      where('status', '==', 'active'),
      limit(1)
    );

    const unsubSchedule = onSnapshot(qSchedule, async (snapshot) => {
      if (!snapshot.empty) {
        const scheduleDoc = snapshot.docs[0];
        const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as any;
        
        // Load template to get steps
        if (scheduleData.templateId) {
          const templateDoc = await getDoc(doc(db, 'scheduleTemplates', scheduleData.templateId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data() as any;
            setFarmerSchedule({ ...scheduleData, steps: templateData.days || templateData.steps || [] });
          } else {
            setFarmerSchedule(scheduleData);
          }
        } else {
          setFarmerSchedule(scheduleData);
        }
      } else {
        setFarmerSchedule(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'schedules'));

    // Fetch Farmer's Independent Tasks
    const qTasks = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      where('status', '==', 'Pending'),
      orderBy('scheduledDate', 'asc')
    );

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setUpcomingTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tasks'));

    return () => {
      unsubSchedule();
      unsubTasks();
    };
  }, [user]);

  const getRemainingDaysLabel = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'DUE TODAY';
    if (diffDays === 1) return 'DUE TOMORROW';
    if (diffDays < 0) return `${Math.abs(diffDays)} DAYS AGO`;
    return `DUE IN ${diffDays} DAYS`;
  };

  const isFutureTask = (targetDate: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    return target > today;
  };

  const handleWatchVideo = async (task: any) => {
    if (!farmerSchedule || !task.videoUrl) return;
    window.open(task.videoUrl, '_blank', 'referrerpolicy=no-referrer');
    
    try {
      const watchedVideos = farmerSchedule.watchedVideos || [];
      const videoWatchLogs = farmerSchedule.videoWatchLogs || [];
      
      if (!watchedVideos.includes(task.day)) {
        await updateDoc(doc(db, 'schedules', farmerSchedule.id), {
          watchedVideos: [...watchedVideos, task.day],
          videoWatchLogs: [...videoWatchLogs, { day: task.day, timestamp: new Date().toISOString() }],
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to track video watch:', err);
    }
  };

  const handleMarkRoadmapDone = async (day: number) => {
    if (!farmerSchedule) return;
    try {
      const completedDays = farmerSchedule.completedDays || [];
      const completionLogs = farmerSchedule.completionLogs || [];
      
      if (!completedDays.includes(day)) {
        await updateDoc(doc(db, 'schedules', farmerSchedule.id), {
          completedDays: [...completedDays, day],
          completionLogs: [...completionLogs, { day, timestamp: new Date().toISOString() }],
          updatedAt: new Date().toISOString()
        });
        toast.success('Task marked as completed');
        if (selectedTaskDetails && selectedTaskDetails.day === day) {
           setSelectedTaskDetails(prev => ({ ...prev, isCompleted: true }));
        }
      }
    } catch (err) {
      toast.error('Failed to update schedule');
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
    const filter = searchParams.get('filter');
    if (filter) {
      setHistoryFilter(filter);
    }
  }, [searchParams]);

  // Handle direct edit from query params
  useEffect(() => {
    const editId = searchParams.get('edit');
    const source = searchParams.get('source'); // 'daily' or 'egg'
    
    if (editId && (source === 'daily' || source === 'egg')) {
      const fetchLog = async () => {
        try {
          const docRef = doc(db, source === 'daily' ? 'dailyLogs' : 'eggLogs', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setEditingLog({ id: docSnap.id, ...docSnap.data() });
            // If it's a daily log, also expand the daily logs section
            if (source === 'daily') {
              setActiveTab('logs');
              setHistoryFilter('daily');
            } else {
              setActiveTab('history');
              setHistoryFilter('eggs_prod');
            }
          }
        } catch (error) {
          console.error("Error fetching log for edit:", error);
        }
      };
      fetchLog();
    }
  }, [searchParams]);

  const handleDownloadPDF = async (flockName: string) => {
    if (!reportRef.current) return;
    
    const toastId = toast.loading('Brewing your report...');
    
    try {
      // 1. Create a clone and sanitize colors to avoid html2canvas parser crash
      const reportClone = reportRef.current.cloneNode(true) as HTMLElement;
      
      // Clean up buttons and unwanted UI
      reportClone.querySelectorAll('button, .pdf-ignore').forEach(el => el.remove());
      
      // EXTREME Color Sanitization: html2canvas CRASHES on oklch()
      const sanitizeOklch = (element: HTMLElement) => {
        try {
          const computed = window.getComputedStyle(element);
          const styles = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'];
          
          styles.forEach(prop => {
            const val = (element.style as any)[prop] || computed.getPropertyValue(prop);
            if (val && val.includes('oklch')) {
              if (prop === 'backgroundColor') (element.style as any)[prop] = '#ffffff';
              else if (prop === 'color') (element.style as any)[prop] = '#1e293b';
              else (element.style as any)[prop] = '#e2e8f0';
            }
          });
        } catch (e) {
          // Fallback if computed style fails
        }
        
        Array.from(element.children).forEach(child => sanitizeOklch(child as HTMLElement));
      };
      
      sanitizeOklch(reportClone);

      // Wrapper to ensure proper rendering context
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.width = '800px';
      wrapper.style.background = '#f8fafc';
      
      const header = document.createElement('div');
      header.style.padding = '40px';
      header.style.textAlign = 'center';
      header.style.backgroundColor = '#122B21';
      header.style.color = '#ffffff';
      header.innerHTML = `
        <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; font-family: sans-serif;">PoultryPro <span style="font-weight: 400; opacity: 0.7; font-size: 20px;">by GavthiWallah</span></h1>
        <p style="margin-top: 8px; margin-bottom: 0; opacity: 0.6; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Batch Performance Report • ${new Date().toLocaleDateString()}</p>
      `;
      
      wrapper.appendChild(header);
      wrapper.appendChild(reportClone);
      document.body.appendChild(wrapper);

      // 2. Capture using html2canvas
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8fafc',
        logging: false,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styles.length; i++) {
            styles[i].innerHTML = styles[i].innerHTML.replace(/oklch\([^)]+\)/g, '#64748b');
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${flockName}_Report.pdf`);
      
      document.body.removeChild(wrapper);
      toast.success('Report downloaded!', { id: toastId });
    } catch (error: any) {
      console.error('PDF Error:', error);
      toast.error('PDF Generation failed.', { id: toastId });
    }
  };

  const historyFilters = [
    { id: 'daily', title: 'Daily Data', icon: ClipboardList, color: 'emerald' },
    { id: 'medicine', title: 'Medicine Log', icon: Pill, color: 'blue' },
    { id: 'feed', title: 'Feed Log', icon: Utensils, color: 'amber' },
    { id: 'alerts', title: 'Alerts', icon: AlertTriangle, color: 'red' },
    { id: 'eggs_prod', title: 'Egg Produced', icon: Egg, color: 'emerald' },
    { id: 'eggs_sold', title: 'Egg Sold', icon: ShoppingBag, color: 'emerald' },
    { id: 'sold', title: 'Sold Flock', icon: ShoppingBag, color: 'purple' },
    { id: 'financial', title: 'Financial Log', icon: IndianRupee, color: 'slate' },
  ];

  const renderSavedTransactions = () => {
    if (transactions.length === 0) return null;

    return (
      <div className="mt-10 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <IndianRupee size={18} className="text-emerald-700" />
            Financial Transactions
          </h3>
          <Badge variant="outline" className="text-[10px]">{transactions.length} total</Badge>
        </div>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
          {transactions.map(tx => {
            const amount = Number(tx.amount) || 0;
            const dateStr = tx.date || tx.timestamp;
            let formattedDate = 'N/A';
            if (dateStr) {
              try {
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                  formattedDate = format(dateObj, 'MMM dd, yyyy');
                }
              } catch (e) {
                console.error("Date formatting error", e);
              }
            }

            return (
              <div key={tx.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-bold text-slate-900 truncate">{tx.description || tx.category || 'No Description'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-xs font-bold ${tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'Income' ? '+' : '-'} ₹{amount.toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-300">•</span>
                    <p className="text-[10px] text-slate-400">{formattedDate}</p>
                  </div>
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
            );
          })}
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
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                    {[...flocks, ...soldFlocks].find(f => f.id === log.flockId)?.name || 'Unknown Batch'}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{valueDisplay}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-500 font-medium">
                      {(() => {
                        try {
                          return format(new Date(log.date), 'MMM dd, yyyy');
                        } catch (e) {
                          return 'N/A';
                        }
                      })()}
                    </p>
                    <span className="text-[10px] text-slate-300">•</span>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {(() => {
                        try {
                          const date = log.timestamp ? new Date(log.timestamp) : new Date(log.date);
                          return format(date, 'hh:mm a');
                        } catch (e) {
                          return 'No time';
                        }
                      })()}
                    </p>
                  </div>
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
    { id: 'task', title: 'Farmer Task', icon: ClipboardCheck, color: 'bg-blue-500', desc: 'Schedule vaccination or medicine' },
    { id: 'flock', title: 'Flock Details', icon: Bird, color: 'bg-blue-600', desc: 'Register new batches' },
    { id: 'feed_stock', title: 'Feed Stock', icon: Package, color: 'bg-orange-600', desc: 'Manage feed inventory' },
    { id: 'medicine_stock', title: 'Medicine Stock', icon: Pill, color: 'bg-purple-600', desc: 'Manage medicines' },
    { id: 'sold_flock', title: 'Selling Entry', icon: ShoppingBag, color: 'bg-amber-600', desc: 'Record flock & egg sales' },
    { id: 'contacts', title: 'Contact', icon: Users, color: 'bg-teal-600', desc: 'Buyers, Suppliers & Vets' },
    { id: 'alerts', title: 'Alerts', icon: AlertTriangle, color: 'bg-red-600', desc: 'Warning signals' },
    { id: 'finance', title: 'Financials', icon: IndianRupee, color: 'bg-emerald-500', desc: 'Costs & sales' },
    { id: 'logs_history', title: 'Log history', icon: FileText, color: 'bg-slate-700', desc: 'View, edit & delete records' },
    { id: 'analyze', title: 'Analyze', icon: TrendingUp, color: 'bg-indigo-600', desc: 'Full-fledged analytics' },
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
    production: { avgWeight: '', weightGain: '', eggCount: '', goodEggs: '', eggWeight: '', eggQuality: 'Good', badEggs: '', labourCost: '', birdCount: '' },
    health: { 
      vaccines: [] as { name: string, doses: string }[], 
      medicines: [] as { name: string, doses: string }[], 
      symptoms: '', mortality: '', culling: '' 
    },
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

  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    category: 'Vaccination',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pending' as 'Pending' | 'Completed'
  });

  const [eggLogData, setEggLogData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    totalEggs: '',
    goodEggs: '',
    badEggs: '',
    feedConsumptionKg: '',
    feedCostPerKg: '',
    medicineCost: '',
    labourCost: '',
    birdCount: ''
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

  const [eggSaleData, setEggSaleData] = useState({
    saleDate: format(new Date(), 'yyyy-MM-dd'),
    eggCount: '',
    sellingRate: '',
    costPerEgg: '',
    buyerName: '',
    buyerContact: '',
    notes: ''
  });
  const [sellMode, setSellMode] = useState<'batch' | 'egg'>('batch');

  const [contactData, setContactData] = useState({
    name: '',
    phone: '',
    role: 'Buyer' as 'Buyer' | 'Supplier' | 'Labor' | 'Vet' | 'Other',
    notes: ''
  });

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'contacts'), {
        ...contactData,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Contact added successfully');
      setContactData({ name: '', phone: '', role: 'Buyer', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'contacts');
      toast.error('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await deleteDoc(doc(db, 'contacts', id));
      toast.success('Contact deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'contacts');
      toast.error('Failed to delete contact');
    }
  };

  const calculateDailyCosts = () => {
    // Feed Cost
    const currentFeedType = dailyLog.consumption.feedType;
    const currentFeedIntake = Number(dailyLog.consumption.feedIntake) || 0;
    const feed = feedStock.find(s => s.type === currentFeedType);
    
    // Calculate unit price if not explicitly stored
    const getUnitPrice = (item: any) => {
        if (item?.unitPrice) return item.unitPrice;
        if (item?.purchaseCost && item?.initialQuantity) return Number(item.purchaseCost) / Number(item.initialQuantity);
        if (item?.purchaseCost && Number(item?.quantity) > 0) return Number(item.purchaseCost) / Number(item.quantity);
        return 0;
    };

    const feedUnitPrice = getUnitPrice(feed);
    const feedCost = currentFeedIntake * feedUnitPrice;

    // Medicine Cost
    let medicineCost = 0;
    dailyLog.health.medicines.forEach(m => {
        const stockItem = medicineStock.find(item => item.name === m.name && item.type === 'Medicine');
        const unitPrice = getUnitPrice(stockItem);
        medicineCost += (Number(m.doses) || 0) * unitPrice;
    });

    // Vaccine Cost
    let vaccineCost = 0;
    dailyLog.health.vaccines.forEach(v => {
        const stockItem = medicineStock.find(item => item.name === v.name && item.type === 'Vaccine');
        const unitPrice = getUnitPrice(stockItem);
        vaccineCost += (Number(v.doses) || 0) * unitPrice;
    });

    const labourCost = Number(dailyLog.production.labourCost) || 0;

    return {
      feedCost,
      medicineCost: medicineCost + vaccineCost,
      labourCost,
      totalCost: feedCost + medicineCost + vaccineCost + labourCost
    };
  };

  useEffect(() => {
    if (!selectedFlockId) return;
    const currentFlock = flocks.find(f => f.id === selectedFlockId);
    if (currentFlock) {
      const mortality = Number(dailyLog.health.mortality) || 0;
      const culling = Number(dailyLog.health.culling) || 0;
      const aliveBirds = (Number(currentFlock.currentCount) || 0) - (mortality + culling);
      setDailyLog(prev => ({
        ...prev,
        production: {
          ...prev.production,
          birdCount: aliveBirds > 0 ? aliveBirds.toString() : '0'
        }
      }));
    }
  }, [selectedFlockId, dailyLog.health.mortality, dailyLog.health.culling, flocks]);

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
      setTransactions(list.sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.timestamp).getTime();
        const dateB = new Date(b.date || b.timestamp).getTime();
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const qHatchery = query(collection(db, 'hatcheryBatches'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubHatchery = onSnapshot(qHatchery, (snapshot) => {
      setHatcheryBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'hatcheryBatches'));

    const qIncubator = query(collection(db, 'incubatorLogs'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50));
    const unsubIncubator = onSnapshot(qIncubator, (snapshot) => {
      setIncubatorLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'incubatorLogs'));

    const qEggSales = query(collection(db, 'eggSales'), where('userId', '==', user.uid));
    const unsubEggSales = onSnapshot(qEggSales, (snapshot) => {
      setEggSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggSales'));

    const qEggLogs = query(collection(db, 'eggLogs'), where('userId', '==', user.uid));
    const unsubEggLogs = onSnapshot(qEggLogs, (snapshot) => {
      setEggLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggLogs'));

    const qContacts = query(collection(db, 'contacts'), where('userId', '==', user.uid), orderBy('name', 'asc'));
    const unsubContacts = onSnapshot(qContacts, (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'contacts'));

    return () => {
      unsubscribe();
      unsubMed();
      unsubFeed();
      unsubLogs();
      unsubTxs();
      unsubHatchery();
      unsubIncubator();
      unsubEggSales();
      unsubEggLogs();
      unsubContacts();
      unsubHatchery();
      unsubIncubator();
    };
  }, [user]);

  const handleCreateHatcheryBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const eggsSet = Number(hatcheryData.eggsSet) || 0;
      const chicksHatched = Number(hatcheryData.chicksHatched) || 0;
      const hatchability = eggsSet > 0 ? (chicksHatched / eggsSet) * 100 : 0;
      
      const docRef = await addDoc(collection(db, 'hatcheryBatches'), {
        ...hatcheryData,
        userId: user.uid,
        eggsSet,
        chicksHatched: chicksHatched,
        gradeA: Number(hatcheryData.gradeA) || 0,
        gradeB: Number(hatcheryData.gradeB) || 0,
        mortality: Number(hatcheryData.mortality) || 0,
        cost: Number(hatcheryData.cost) || 0,
        hatchability: Number(hatchability.toFixed(2)),
        createdAt: new Date().toISOString(),
      });

      if (Number(hatcheryData.cost) > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'Expense',
          category: 'Hatchery',
          amount: Number(hatcheryData.cost) || 0,
          description: `Total expenses for hatchery batch: ${hatcheryData.batchName}`,
          date: hatcheryData.setDate,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Hatchery batch recorded successfully');
      setHatcheryData({
        batchName: '',
        eggsSet: '',
        setDate: format(new Date(), 'yyyy-MM-dd'),
        expectedHatchDate: format(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        actualHatchDate: '',
        chicksHatched: '',
        gradeA: '',
        gradeB: '',
        mortality: '',
        cost: '',
        status: 'Incubating',
        notes: ''
      });
      setActiveTab(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'hatcheryBatches');
      toast.error('Failed to create hatchery batch');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHatcheryBatch = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'hatcheryBatches', id));
      toast.success('Hatchery batch deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'hatcheryBatches');
      toast.error('Failed to delete hatchery batch');
    }
  };

  const handleUpdateHatcheryBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHatcheryBatch) return;
    setLoading(true);
    try {
      const eggsSet = Number(editingHatcheryBatch.eggsSet) || 0;
      const chicksHatched = Number(editingHatcheryBatch.chicksHatched) || 0;
      const hatchability = eggsSet > 0 ? (chicksHatched / eggsSet) * 100 : 0;

      await updateDoc(doc(db, 'hatcheryBatches', editingHatcheryBatch.id), {
        ...editingHatcheryBatch,
        eggsSet,
        chicksHatched,
        gradeA: Number(editingHatcheryBatch.gradeA) || 0,
        gradeB: Number(editingHatcheryBatch.gradeB) || 0,
        mortality: Number(editingHatcheryBatch.mortality) || 0,
        cost: Number(editingHatcheryBatch.cost) || 0,
        hatchability: Number(hatchability.toFixed(2)),
      });
      toast.success('Hatchery batch updated successfully');
      setEditingHatcheryBatch(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hatcheryBatches');
      toast.error('Failed to update hatchery batch');
    } finally {
      setLoading(false);
    }
  };

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

      // Record chicks purchase as a transaction if cost > 0
      if (Number(flockData.chicksCost) > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          flockId: docRef.id,
          type: 'Expense',
          category: 'Chicks',
          amount: Number(flockData.chicksCost) || 0,
          description: `Purchase of ${flockData.initialCount} birds - ${flockData.name}`,
          date: flockData.placementDate,
          createdAt: new Date().toISOString(),
        });
      }

      toast.success('Flock created and chicks cost recorded');
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
      // 1. Fetch Log First to know what to revert
      const logSnap = await getDoc(doc(db, 'dailyLogs', id));
      if (!logSnap.exists()) return;
      const logData = logSnap.data();
      const flockId = logData.flockId;

      // 2. Revert Feed Stock
      const feedIntake = Number(logData.consumption?.feedIntake) || 0;
      const feedType = logData.consumption?.feedType;
      if (feedIntake > 0 && feedType) {
        const q = query(collection(db, 'feedStock'), where('userId', '==', user?.uid), where('type', '==', feedType));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const stockDoc = snap.docs[0];
          await updateDoc(doc(db, 'feedStock', stockDoc.id), {
            quantity: (Number(stockDoc.data().quantity) || 0) + feedIntake
          });
        }
      }

      // 3. Revert Medicine/Vaccine Stock
      const medicines = Array.isArray(logData.health?.medicines) ? logData.health.medicines : [];
      const vaccines = Array.isArray(logData.health?.vaccines) ? logData.health.vaccines : [];

      for (const med of medicines) {
        if (med.name && Number(med.doses) > 0) {
          const q = query(collection(db, 'medicineStock'), where('userId', '==', user?.uid), where('name', '==', med.name), where('type', '==', 'Medicine'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const stockDoc = snap.docs[0];
            await updateDoc(doc(db, 'medicineStock', stockDoc.id), {
              quantity: (Number(stockDoc.data().quantity) || 0) + Number(med.doses)
            });
          }
        }
      }

      for (const vac of vaccines) {
        if (vac.name && Number(vac.doses) > 0) {
          const q = query(collection(db, 'medicineStock'), where('userId', '==', user?.uid), where('name', '==', vac.name), where('type', '==', 'Vaccine'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const stockDoc = snap.docs[0];
            await updateDoc(doc(db, 'medicineStock', stockDoc.id), {
              quantity: (Number(stockDoc.data().quantity) || 0) + Number(vac.doses)
            });
          }
        }
      }

      // 4. Revert Flock Totals
      if (flockId) {
        const flockSnap = await getDoc(doc(db, 'flocks', flockId));
        if (flockSnap.exists()) {
          const flock = flockSnap.data();
          const mortality = Number(logData.health?.mortality) || 0;
          const culling = Number(logData.health?.culling) || 0;
          const eggs = Number(logData.production?.eggCount) || 0;

          await updateDoc(doc(db, 'flocks', flockId), {
            totalMortality: Math.max(0, (Number(flock.totalMortality) || 0) - (mortality + culling)),
            totalEggs: Math.max(0, (Number(flock.totalEggs) || 0) - eggs),
            currentCount: (Number(flock.currentCount) || 0) + (mortality + culling),
            daysCount: Math.max(0, (Number(flock.daysCount) || 0) - 1)
          });
        }
      }

      // 5. Final Delete
      await deleteDoc(doc(db, 'dailyLogs', id));
      toast.success('Record deleted and inventory reverted successfully');
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
      // 1. Fetch ORIGINAL log to calculate delta
      const originalLogSnap = await getDoc(doc(db, 'dailyLogs', editingLog.id));
      if (!originalLogSnap.exists()) throw new Error('Original record not found');
      const originalLog = originalLogSnap.data();

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
          goodEggs: Number(editingLog.production?.goodEggs) || 0,
          eggWeight: Number(editingLog.production?.eggWeight) || 0,
          badEggs: Number(editingLog.production?.badEggs) || 0,
          labourCost: Number(editingLog.production?.labourCost) || 0,
          birdCount: Number(editingLog.production?.birdCount) || 0,
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

      // 2. Adjust Stock Deltas
      // Feed
      const oldFeed = Number(originalLog.consumption?.feedIntake) || 0;
      const newFeed = updatedLog.consumption?.feedIntake || 0;
      const feedType = originalLog.consumption?.feedType; // Assume type doesn't change for simple edit
      if (oldFeed !== newFeed && feedType) {
        const q = query(collection(db, 'feedStock'), where('userId', '==', user.uid), where('type', '==', feedType));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const stockDoc = snap.docs[0];
          await updateDoc(doc(db, 'feedStock', stockDoc.id), {
            quantity: (Number(stockDoc.data().quantity) || 0) + (oldFeed - newFeed)
          });
        }
      }

      // 3. Update Flock Totals if birds/eggs changed
      const oldMortality = (Number(originalLog.health?.mortality) || 0) + (Number(originalLog.health?.culling) || 0);
      const newMortality = (Number(updatedLog.health?.mortality) || 0) + (Number(updatedLog.health?.culling) || 0);
      const oldEggs = Number(originalLog.production?.eggCount) || 0;
      const newEggs = Number(updatedLog.production?.eggCount) || 0;

      if (oldMortality !== newMortality || oldEggs !== newEggs) {
        const flockRef = doc(db, 'flocks', editingLog.flockId);
        const flockSnap = await getDoc(flockRef);
        if (flockSnap.exists()) {
          const flock = flockSnap.data();
          await updateDoc(flockRef, {
            totalMortality: (Number(flock.totalMortality) || 0) - oldMortality + newMortality,
            totalEggs: (Number(flock.totalEggs) || 0) - oldEggs + newEggs,
            currentCount: (Number(flock.currentCount) || 0) + oldMortality - newMortality
          });
        }
      }

      await updateDoc(logRef, updatedLog);
      toast.success('Record and inventory adjusted successfully');
      setEditingLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'dailyLogs');
      toast.error('Failed to update record');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEggLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this egg production record?')) return;
    try {
      const logSnap = await getDoc(doc(db, 'eggLogs', id));
      if (logSnap.exists()) {
        const logData = logSnap.data();
        if (logData.flockId) {
          const flockRef = doc(db, 'flocks', logData.flockId);
          const flockSnap = await getDoc(flockRef);
          if (flockSnap.exists()) {
            await updateDoc(flockRef, {
              totalEggs: Math.max(0, (Number(flockSnap.data().totalEggs) || 0) - (Number(logData.totalEggs) || 0))
            });
          }
        }
      }
      await deleteDoc(doc(db, 'eggLogs', id));
      toast.success('Egg production record deleted');
    } catch (error) {
      toast.error('Failed to delete egg production record');
      handleFirestoreError(error, OperationType.DELETE, 'eggLogs');
    }
  };

  const handleDeleteEggSale = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this egg sale record?')) return;
    try {
      await deleteDoc(doc(db, 'eggSales', id));
      // Optionally find and delete the associated transaction if we gave it a searchable ID
      toast.success('Egg sale record deleted');
    } catch (error) {
      toast.error('Failed to delete egg sale');
      handleFirestoreError(error, OperationType.DELETE, 'eggSales');
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
      const unitPrice = medQty > 0 ? (cost / medQty) : 0;

      // 1. Add to Medicine Stock
      await addDoc(collection(db, 'medicineStock'), {
        ...newMedicine,
        userId: user.uid,
        quantity: medQty, // remaining
        initialQuantity: medQty, // initial
        unitPrice: unitPrice,
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
      const unitPrice = feedQty > 0 ? (cost / feedQty) : 0;

      // 1. Add to Feed Stock
      await addDoc(collection(db, 'feedStock'), {
        ...newFeed,
        userId: user.uid,
        quantity: feedQty, // This will act as remaining quantity
        initialQuantity: feedQty, // Persistent original quantity
        unitPrice: unitPrice, // Persistent unit price
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

  const handleSaveEggSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const soldCount = Number(eggSaleData.eggCount) || 0;
    if (soldCount <= 0) {
      toast.error('Please enter a valid egg count');
      return;
    }

    setLoading(true);
    try {
      const totalPrice = Number((soldCount * (Number(eggSaleData.sellingRate) || 0)).toFixed(2));
      const totalCost = Number((soldCount * (Number(eggSaleData.costPerEgg) || 0)).toFixed(2));
      const profit = Number((totalPrice - totalCost).toFixed(2));
      
      await addDoc(collection(db, 'eggSales'), {
        ...eggSaleData,
        userId: user.uid,
        flockId: selectedFlockId || null,
        eggCount: soldCount,
        sellingRate: Number(eggSaleData.sellingRate) || 0,
        costPerEgg: Number(eggSaleData.costPerEgg) || 0,
        totalPrice: totalPrice,
        totalCost: totalCost,
        profit: profit,
        createdAt: new Date().toISOString()
      });

      // Record transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'Income',
        category: 'Egg Sale',
        amount: totalPrice,
        description: `Sold ${soldCount} eggs to ${eggSaleData.buyerName || 'Unknown'}. Rate: ₹${eggSaleData.sellingRate}/egg. Profit: ₹${profit.toFixed(2)}`,
        date: eggSaleData.saleDate,
        createdAt: new Date().toISOString()
      });

      toast.success('Egg sale recorded');
      setEggSaleData({
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        eggCount: '',
        sellingRate: '',
        costPerEgg: '',
        buyerName: '',
        buyerContact: '',
        notes: ''
      });
    } catch (e) {
      toast.error('Failed to save egg sale');
      handleFirestoreError(e, OperationType.WRITE, 'eggSales');
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

      // Validate Medicines
      for (const med of dailyLog.health.medicines) {
        if (med.name && med.name !== 'none' && Number(med.doses) > 0) {
          const medItem = medicineStock.find(m => m.name === med.name && m.type === 'Medicine');
          const available = Number(medItem?.quantity) || 0;
          if (!medItem || available < Number(med.doses)) {
            toast.error(`Insufficient ${med.name} medicine in stock. Available: ${available} units`);
            setLoading(false);
            return;
          }
        }
      }

      // Validate Vaccines
      for (const vac of dailyLog.health.vaccines) {
        if (vac.name && vac.name !== 'none' && Number(vac.doses) > 0) {
          const vacItem = medicineStock.find(m => m.name === vac.name && m.type === 'Vaccine');
          const available = Number(vacItem?.quantity) || 0;
          if (!vacItem || available < Number(vac.doses)) {
            toast.error(`Insufficient ${vac.name} vaccine in stock. Available: ${available} doses`);
            setLoading(false);
            return;
          }
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
      const mortalityValue = Number(dailyLog.health.mortality) || 0;
      const cullingValue = Number(dailyLog.health.culling) || 0;
      
      const formattedLog = {
        ...dailyLog,
        userId: user.uid,
        flockId: selectedFlockId,
        approved: mortalityValue === 0,
        approvalType: mortalityValue > 0 ? 'Mortality' : null,
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
          goodEggs: Number(dailyLog.production.goodEggs) || 0,
          eggWeight: Number(dailyLog.production.eggWeight) || 0,
          badEggs: Number(dailyLog.production.badEggs) || 0,
          labourCost: Number(dailyLog.production.labourCost) || 0,
          birdCount: Number(dailyLog.production.birdCount) || 0,
        },
        health: {
          ...dailyLog.health,
          mortality: mortalityValue,
          culling: cullingValue,
        },
        biosecurity: {
          ...dailyLog.biosecurity,
          visitors: Number(dailyLog.biosecurity.visitors) || 0,
        },
        timestamp: new Date().toISOString()
      };

      try {
        const addedLog = await addDoc(collection(db, 'dailyLogs'), formattedLog);
        
        // 3. Subtract Stock
        if (todayFeed > 0) {
          const stockItem = feedStock.find(s => s.type === feedType);
          if (stockItem) {
            await updateDoc(doc(db, 'feedStock', stockItem.id), {
              quantity: (Number(stockItem.quantity) || 0) - todayFeed
            });
          }
        }

        for (const med of dailyLog.health.medicines) {
          const doses = Number(med.doses) || 0;
          if (med.name && med.name !== 'none' && doses > 0) {
            const stockItem = medicineStock.find(m => m.name === med.name && m.type === 'Medicine');
            if (stockItem) {
              await updateDoc(doc(db, 'medicineStock', stockItem.id), {
                quantity: (Number(stockItem.quantity) || 0) - doses
              });
            }
          }
        }

        for (const vac of dailyLog.health.vaccines) {
          const doses = Number(vac.doses) || 0;
          if (vac.name && vac.name !== 'none' && doses > 0) {
            const stockItem = medicineStock.find(m => m.name === vac.name && m.type === 'Vaccine');
            if (stockItem) {
              await updateDoc(doc(db, 'medicineStock', stockItem.id), {
                quantity: (Number(stockItem.quantity) || 0) - doses
              });
            }
          }
        }

        // 4. Update Flock Totals
        const flockRef = doc(db, 'flocks', selectedFlockId);
        await updateDoc(flockRef, {
          totalMortality: (Number(currentFlock.totalMortality) || 0) + mortalityValue + cullingValue,
          totalEggs: (Number(currentFlock.totalEggs) || 0) + (Number(dailyLog.production.eggCount) || 0),
          currentCount: Math.max(0, (Number(currentFlock.currentCount) || 0) - (mortalityValue + cullingValue)),
          daysCount: (Number(currentFlock.daysCount) || 0) + 1
        });

        toast.success(`Daily log saved successfully for Batch: ${currentFlock.name}`);
        setDailyLog({
          ...dailyLog,
          production: { ...dailyLog.production, eggCount: '', eggWeight: '', goodEggs: '', badEggs: '' },
          health: { ...dailyLog.health, mortality: '', culling: '', medicines: [], vaccines: [] },
          consumption: { ...dailyLog.consumption, feedIntake: '', waterIntake: '' }
        });
        
        // 2.5 Run Auto Alert Engine (Async)
        const triggerAlerts = async () => {
          try {
            // Default location (e.g., Pune, India) or attempt to get from farm profile if added later
            let lat = 18.5204, lon = 73.8567;
            
            // Try to get geolocation if possible 
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    const weather = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
                    await runAutoAlertEngine({
                        flockId: selectedFlockId,
                        userId: user.uid,
                        farmType: profile?.farmType || 'Broiler Farm',
                        data: { id: addedLog.id, ...formattedLog },
                        weather
                    });
                }, async () => {
                    // Fallback
                    const weather = await fetchWeather(lat, lon);
                    await runAutoAlertEngine({
                        flockId: selectedFlockId,
                        userId: user.uid,
                        farmType: profile?.farmType || 'Broiler Farm',
                        data: { id: addedLog.id, ...formattedLog },
                        weather
                    });
                });
            } else {
                const weather = await fetchWeather(lat, lon);
                await runAutoAlertEngine({
                    flockId: selectedFlockId,
                    userId: user.uid,
                    farmType: profile?.farmType || 'Broiler Farm',
                    data: { id: addedLog.id, ...formattedLog },
                    weather
                });
            }
          } catch (e) {
            console.error("Alert engine failed", e);
          }
        };
        triggerAlerts();

      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'dailyLogs');
        toast.error('Failed to save log');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        userId: user.uid,
        creatorId: user.uid,
        creatorType: 'Farmer',
        createdAt: new Date().toISOString()
      });
      toast.success('Schedule/Task saved successfully');
      setTaskData({
        title: '',
        description: '',
        category: 'Vaccination',
        scheduledDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pending'
      });
      setActiveTab(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
      toast.error('Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEggLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const totalEggs = Number(eggLogData.totalEggs) || 0;
      const goodEggs = Number(eggLogData.goodEggs) || 0;
      const badEggs = Number(eggLogData.badEggs) || 0;
      const feedKg = Number(eggLogData.feedConsumptionKg) || 0;
      const feedPrice = Number(eggLogData.feedCostPerKg) || 0;
      const medCost = Number(eggLogData.medicineCost) || 0;
      const labourCost = Number(eggLogData.labourCost) || 0;
      const birdCount = Number(eggLogData.birdCount) || 0;

      await addDoc(collection(db, 'eggLogs'), {
        userId: user.uid,
        flockId: selectedFlockId || null,
        date: eggLogData.date,
        totalEggs,
        goodEggs,
        badEggs,
        feedConsumptionKg: feedKg,
        feedCostPerKg: feedPrice,
        medicineCost: medCost,
        labourCost: labourCost,
        birdCount,
        createdAt: new Date().toISOString()
      });

      // Also record as a transaction (optional, but good for finance)
      const dailyTotalCost = (feedKg * feedPrice) + medCost + labourCost;
      if (dailyTotalCost > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'Expense',
          category: 'Operations',
          amount: dailyTotalCost,
          description: `Total operational cost for egg production on ${eggLogData.date}`,
          date: eggLogData.date,
          createdAt: new Date().toISOString()
        });
      }

      toast.success('Egg collection recorded successfully');
      setEggLogData({
        date: format(new Date(), 'yyyy-MM-dd'),
        totalEggs: '',
        goodEggs: '',
        badEggs: '',
        feedConsumptionKg: '',
        feedCostPerKg: '',
        medicineCost: '',
        labourCost: '',
        birdCount: ''
      });
      setActiveTab(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'eggLogs');
      toast.error('Failed to save egg log');
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
                  <SelectValue placeholder="Choose a flock">
                    {flocks.find(f => f.id === selectedFlockId)?.name || 'Choose a flock'}
                  </SelectValue>
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
            <LicenseGuard key={cat.id} mode="interaction">
              <Card 
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
            </LicenseGuard>
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* Tab: Farmer Task */}
          {activeTab === 'task' && (
            <>
              <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="text-blue-600" />
                  Farmer Task / Schedule
                </CardTitle>
                <CardDescription>Schedule vaccinations, medicine plans, or tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveTask} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Task Title</Label>
                      <Input 
                        required 
                        value={taskData.title} 
                        onChange={e => setTaskData({...taskData, title: e.target.value})} 
                        placeholder="e.g. Vaccination - ND Lasota" 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={taskData.category} onValueChange={v => setTaskData({...taskData, category: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Vaccination">Vaccination</SelectItem>
                          <SelectItem value="Medicine Plan">Medicine Plan</SelectItem>
                          <SelectItem value="Cleaning">Cleaning</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scheduled Date</Label>
                      <Input 
                        type="date" 
                        required 
                        value={taskData.scheduledDate} 
                        onChange={e => setTaskData({...taskData, scheduledDate: e.target.value})} 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description / Instructions</Label>
                      <Input 
                        value={taskData.description} 
                        onChange={e => setTaskData({...taskData, description: e.target.value})} 
                        placeholder="Enter details about the task..." 
                        className="rounded-xl" 
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6" disabled={loading}>
                    <Save className="mr-2" size={20} />
                    Save Schedule
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Allotted Tasks Row */}
            <div className="mt-12 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-[#122B21] italic leading-tight">ALLOTTED TASKS</h2>
                  <p className="text-slate-400 font-bold italic">Schedule provided by Admin for your farm</p>
                </div>
                <Badge className="bg-[#122B21] text-white px-4 py-1.5 rounded-full font-black italic">
                  {upcomingTasks.length + (farmerSchedule?.steps?.length || 0)} TASKS
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pb-6 pr-2 scrollbar-hide">
                {/* Manual/Assigned Tasks */}
                {upcomingTasks.map((task) => (
                  <Card 
                    key={task.id} 
                    className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => setSelectedTaskDetails({ ...task, isCompleted: task.status === 'Completed' })}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          task.category === 'Vaccination' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {task.category === 'Vaccination' ? <ShieldCheck size={24} /> : <Pill size={24} />}
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-slate-200">
                          {task.category}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-black italic text-slate-900 mb-1">{task.title}</h3>
                      <p className="text-xs font-bold text-slate-400 italic mb-4">
                         {format(new Date(task.scheduledDate), 'MMM dd, yyyy')}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2">
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                             <FileText size={14} className="text-slate-400" />
                          </div>
                        </div>
                        <Button variant="ghost" className="text-[10px] font-black italic text-emerald-600 hover:bg-emerald-50 h-8 rounded-full">
                          VIEW DETAILS
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Roadmap Steps */}
                {farmerSchedule?.steps?.filter((step: any) => {
                  const scheduledDate = new Date(farmerSchedule.startDate);
                  scheduledDate.setDate(scheduledDate.getDate() + (step.day - 1));
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const diffTime = scheduledDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  const window = farmerSchedule.visibilityDaysBefore ?? 7;
                  return diffDays <= window;
                }).map((step: any) => {
                  const isCompleted = farmerSchedule.completedDays?.includes(step.day);
                  const scheduledDate = new Date(farmerSchedule.startDate);
                  scheduledDate.setDate(scheduledDate.getDate() + (step.day - 1));
                  
                  return (
                    <Card 
                      key={`step-${step.day}`} 
                      className={`rounded-[2rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform ${
                        isCompleted ? 'opacity-70 bg-slate-50' : ''
                      }`}
                      onClick={() => setSelectedTaskDetails({ 
                        ...step, 
                        isRoadmap: true, 
                        isCompleted, 
                        scheduledDate: scheduledDate.toISOString(),
                        flockName: flocks.find(f => f.id === farmerSchedule.flockId)?.name || 'Batch'
                      })}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isCompleted ? 'bg-emerald-100 text-emerald-600' :
                            step.type === 'Vaccination' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            {isCompleted ? <ClipboardCheck size={24} /> :
                             step.type === 'Vaccination' ? <ShieldCheck size={24} /> : <Pill size={24} />}
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">ROADMAP</p>
                            <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-slate-200">
                              Day {step.day}
                            </Badge>
                            <p className="text-[10px] font-black italic text-emerald-600 mt-1">
                              {getRemainingDaysLabel(scheduledDate.toISOString())}
                            </p>
                          </div>
                        </div>
                        <h3 className="text-xl font-black italic text-slate-900 mb-1">{step.taskTitle}</h3>
                        <div className="flex items-center justify-between mt-4">
                           <div className="flex gap-2">
                             {step.videoUrl && (
                               <Badge className="bg-amber-100 text-amber-600 border-none text-[8px] font-black">VIDEO GUIDE</Badge>
                             )}
                             {isCompleted && (
                               <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] font-black">DONE</Badge>
                             )}
                           </div>
                          <Button variant="ghost" className="text-[10px] font-black italic text-emerald-600 hover:bg-emerald-50 h-8 rounded-full">
                            {isCompleted ? 'COMPLETED' : 'VIEW DETAILS'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {upcomingTasks.length === 0 && !farmerSchedule && (
                <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <ClipboardList className="text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black italic text-slate-400">NO TASKS ALLOTTED YET</h3>
                  <p className="text-slate-400 font-bold italic max-w-xs mx-auto">Tasks assigned by your administrator will appear here.</p>
                </div>
              )}
            </div>
          </>
          )}

          {/* Tab: Incubator Log */}
          {activeTab === 'incubator' && (
            <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="text-indigo-600" />
                  Incubator Monitoring log
                </CardTitle>
                <CardDescription>Record temperature and humidity for active batches</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveIncubatorLog} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Active Hatchery Batch</Label>
                      <Select value={incubatorLog.batchId} onValueChange={v => setIncubatorLog({...incubatorLog, batchId: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {hatcheryBatches.filter(b => b.status === 'Incubating').map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.batchName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hatcheryBatches.filter(b => b.status === 'Incubating').length === 0 && (
                         <p className="text-[10px] text-amber-600">No incubating batches found. Create one in Hatchery Management tab.</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={incubatorLog.date} onChange={e => setIncubatorLog({...incubatorLog, date: e.target.value})} className="rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input type="time" value={incubatorLog.time} onChange={e => setIncubatorLog({...incubatorLog, time: e.target.value})} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Temperature (°C)</Label>
                      <Input type="number" step="0.1" required value={incubatorLog.temperature} onChange={e => setIncubatorLog({...incubatorLog, temperature: e.target.value})} placeholder="e.g. 37.5" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Humidity (%)</Label>
                      <Input type="number" step="0.1" required value={incubatorLog.humidity} onChange={e => setIncubatorLog({...incubatorLog, humidity: e.target.value})} placeholder="e.g. 60" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Ventilation</Label>
                      <Select value={incubatorLog.ventilation} onValueChange={v => setIncubatorLog({...incubatorLog, ventilation: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Normal">Normal</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Water Level</Label>
                      <Select value={incubatorLog.waterLevel} onValueChange={v => setIncubatorLog({...incubatorLog, waterLevel: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Full">Full</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Notes</Label>
                      <Input value={incubatorLog.notes} onChange={e => setIncubatorLog({...incubatorLog, notes: e.target.value})} placeholder="Any observations..." className="rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6" disabled={loading}>
                    <Save className="mr-2" size={20} />
                    Save Reading
                  </Button>
                </form>

                <div className="mt-8">
                  <h3 className="font-bold text-slate-700 mb-4">Recent Readings</h3>
                  <div className="space-y-3">
                    {incubatorLogs.slice(0, 10).map(log => {
                      const batch = hatcheryBatches.find(b => b.id === log.batchId);
                      return (
                        <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-tight">{batch?.batchName || 'Unknown Batch'}</p>
                            <p className="text-sm font-bold text-slate-800">{log.temperature}°C / {log.humidity}% Humidity</p>
                            <p className="text-[10px] text-slate-500">{format(new Date(log.date), 'MMM dd')} at {log.time}</p>
                          </div>
                          <div className="text-right">
                             <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-lg border border-slate-200">
                               Vent: {log.ventilation}
                             </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab: Daily Data (Comprehensive) */}
          {activeTab === 'daily_data' && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-emerald-50/50">
                  <CardTitle className="flex items-center gap-2 text-emerald-900">
                    <FileText className="text-emerald-600" />
                    Daily Farm Data Entry
                  </CardTitle>
                  <CardDescription>Record all daily activities for the selected flock</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSaveDailyLog} className="space-y-4">
                    {/* Selection Section - Always visible */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Select Batch / Flock</Label>
                        <Select value={selectedFlockId} onValueChange={setSelectedFlockId}>
                          <SelectTrigger className="rounded-xl border-emerald-100 bg-white">
                            <SelectValue placeholder="Choose a flock">
                              {flocks.find(f => f.id === selectedFlockId)?.name || 'Choose a flock'}
                            </SelectValue>
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

                    <div className="space-y-3">
                      {/* 1. Feed Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('feed')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-orange-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                              <Utensils size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Feed Section</span>
                          </div>
                          {expandedSections.feed ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.feed && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
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
                        )}
                      </div>

                      {/* 2. Water Consumption Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('water')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                              <Droplets size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Water Consumption Section</span>
                          </div>
                          {expandedSections.water ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.water && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
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
                        )}
                      </div>

                      {/* 3. Health & Medication Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('health')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-red-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-xl text-red-600">
                              <Pill size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Health & Medication</span>
                          </div>
                          {expandedSections.health ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.health && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200 space-y-6">
                            {/* Vaccines */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-bold">Vaccinations Given Today</Label>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setDailyLog({...dailyLog, health: {...dailyLog.health, vaccines: [...dailyLog.health.vaccines, {name: '', doses: ''}]}})}
                                  className="rounded-xl border-dashed h-8"
                                >
                                  <Plus size={14} className="mr-1" /> Add Vaccine
                                </Button>
                              </div>
                              {dailyLog.health.vaccines.length === 0 && (
                                <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-sm">
                                  No vaccines recorded for today
                                </div>
                              )}
                              <div className="grid grid-cols-1 gap-3">
                                {dailyLog.health.vaccines.map((v, idx) => (
                                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 relative items-end">
                                    <div className="space-y-1.5 flex-1">
                                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Select Vaccine</Label>
                                      <Select 
                                        value={v.name} 
                                        onValueChange={val => {
                                          const newList = [...dailyLog.health.vaccines];
                                          newList[idx].name = val;
                                          setDailyLog({...dailyLog, health: {...dailyLog.health, vaccines: newList}});
                                        }}
                                      >
                                        <SelectTrigger className="rounded-xl bg-white h-10">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {medicineStock.filter(item => item.type === 'Vaccine' && Number(item.quantity) > 0).map(item => (
                                            <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1.5 w-full">
                                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Doses Given</Label>
                                      <div className="flex gap-2">
                                        <Input 
                                          type="number" 
                                          value={v.doses} 
                                          onChange={e => {
                                            const newList = [...dailyLog.health.vaccines];
                                            newList[idx].doses = e.target.value;
                                            setDailyLog({...dailyLog, health: {...dailyLog.health, vaccines: newList}});
                                          }}
                                          placeholder="0"
                                          className="rounded-xl bg-white h-10"
                                        />
                                        <div className="px-3 h-10 flex items-center bg-white rounded-xl border border-slate-200 text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                          {(() => {
                                            const stock = medicineStock.find(m => m.name === v.name && m.type === 'Vaccine');
                                            return stock ? `${stock.quantity} left` : '0 left';
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-end">
                                      <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => {
                                          const newList = dailyLog.health.vaccines.filter((_, i) => i !== idx);
                                          setDailyLog({...dailyLog, health: {...dailyLog.health, vaccines: newList}});
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-10 p-0 rounded-xl"
                                      >
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Medicines */}
                            <div className="space-y-4 pt-4 border-t border-slate-50">
                              <div className="flex items-center justify-between">
                                <Label className="text-base font-bold">Medicines Used Today</Label>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setDailyLog({...dailyLog, health: {...dailyLog.health, medicines: [...dailyLog.health.medicines, {name: '', doses: ''}]}})}
                                  className="rounded-xl border-dashed h-8"
                                >
                                  <Plus size={14} className="mr-1" /> Add Medicine
                                </Button>
                              </div>
                              {dailyLog.health.medicines.length === 0 && (
                                <div className="text-center py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-sm">
                                  No medicines recorded for today
                                </div>
                              )}
                              <div className="grid grid-cols-1 gap-3">
                                {dailyLog.health.medicines.map((m, idx) => (
                                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 relative items-end">
                                    <div className="space-y-1.5 flex-1">
                                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Select Medicine</Label>
                                      <Select 
                                        value={m.name} 
                                        onValueChange={val => {
                                          const newList = [...dailyLog.health.medicines];
                                          newList[idx].name = val;
                                          setDailyLog({...dailyLog, health: {...dailyLog.health, medicines: newList}});
                                        }}
                                      >
                                        <SelectTrigger className="rounded-xl bg-white h-10">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {medicineStock.filter(item => item.type === 'Medicine' && Number(item.quantity) > 0).map(item => (
                                            <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1.5 w-full">
                                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Quantity Given</Label>
                                      <div className="flex gap-2">
                                        <Input 
                                          type="number" 
                                          value={m.doses} 
                                          onChange={e => {
                                            const newList = [...dailyLog.health.medicines];
                                            newList[idx].doses = e.target.value;
                                            setDailyLog({...dailyLog, health: {...dailyLog.health, medicines: newList}});
                                          }}
                                          placeholder="0"
                                          className="rounded-xl bg-white h-10"
                                        />
                                        <div className="px-3 h-10 flex items-center bg-white rounded-xl border border-slate-200 text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                          {(() => {
                                            const stock = medicineStock.find(item => item.name === m.name && item.type === 'Medicine');
                                            return stock ? `${stock.quantity} left` : '0 left';
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex justify-end">
                                      <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => {
                                          const newList = dailyLog.health.medicines.filter((_, i) => i !== idx);
                                          setDailyLog({...dailyLog, health: {...dailyLog.health, medicines: newList}});
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-10 p-0 rounded-xl"
                                      >
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-50">
                              <Label htmlFor="symptoms">Symptoms / Observations</Label>
                              <Input 
                                id="symptoms" 
                                value={dailyLog.health.symptoms} 
                                onChange={e => setDailyLog({...dailyLog, health: {...dailyLog.health, symptoms: e.target.value}})}
                                placeholder="Describe any bird health issues..." 
                                className="rounded-xl mt-2" 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Mortality & Culling Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('mortality')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-200 rounded-xl text-slate-600">
                              <Trash2 size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Mortality & Culling</span>
                          </div>
                          {expandedSections.mortality ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.mortality && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
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
                        )}
                      </div>

                      {/* 5. Egg Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('eggs')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-emerald-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                              <Egg size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Egg Section</span>
                          </div>
                          {expandedSections.eggs ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.eggs && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Label htmlFor="eggCount">Total Eggs Collected</Label>
                                <Input 
                                  id="eggCount" 
                                  type="number" 
                                  value={dailyLog.production.eggCount} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    const good = Number(dailyLog.production.goodEggs) || 0;
                                    const bad = Number(val) - good;
                                    setDailyLog({
                                      ...dailyLog, 
                                      production: {
                                        ...dailyLog.production, 
                                        eggCount: val,
                                        badEggs: bad > 0 ? bad.toString() : '0'
                                      }
                                    });
                                  }}
                                  placeholder="0"
                                  className="rounded-xl h-12 bg-slate-50 border-slate-200 font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="goodEggs">Good Condition Eggs</Label>
                                <Input 
                                  id="goodEggs" 
                                  type="number" 
                                  value={dailyLog.production.goodEggs} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    const total = Number(dailyLog.production.eggCount) || 0;
                                    const bad = total - Number(val);
                                    setDailyLog({
                                      ...dailyLog, 
                                      production: {
                                        ...dailyLog.production, 
                                        goodEggs: val,
                                        badEggs: bad > 0 ? bad.toString() : '0'
                                      }
                                    });
                                  }}
                                  placeholder="0"
                                  className="rounded-xl h-12 bg-emerald-50/30 border-emerald-100 font-bold"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center pr-1">
                                  <Label htmlFor="badEggs">Bad/Damage Eggs</Label>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto Calculated</span>
                                </div>
                                <Input 
                                  id="badEggs" 
                                  type="number" 
                                  readOnly
                                  value={dailyLog.production.badEggs} 
                                  className="rounded-xl h-12 bg-red-50/30 border-red-100 font-black text-red-600 cursor-not-allowed"
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
                                  className="rounded-xl h-12 bg-slate-50 border-slate-200"
                                />
                              </div>
                            </div>

                            <div className="mt-8 p-6 bg-slate-900 rounded-[2rem] border-4 border-emerald-500/20 shadow-2xl relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 transform group-hover:scale-110 transition-transform">
                                <IndianRupee size={120} className="text-white" />
                              </div>
                              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                Operational Cost Calculation (Today)
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-6">
                                <div className="space-y-2">
                                  <Label className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Labour Cost (₹)</Label>
                                  <Input 
                                    type="number" 
                                    value={dailyLog.production.labourCost} 
                                    onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, labourCost: e.target.value}})}
                                    className="bg-white/5 border-white/10 text-white rounded-xl h-10 focus:ring-emerald-500"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Bird Count</Label>
                                  <Input 
                                    type="number" 
                                    value={dailyLog.production.birdCount} 
                                    onChange={e => setDailyLog({...dailyLog, production: {...dailyLog.production, birdCount: e.target.value}})}
                                    className="bg-white/5 border-white/10 text-white rounded-xl h-10 focus:ring-emerald-500"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                                {(() => {
                                  const costs = calculateDailyCosts();
                                  const birdCount = Number(dailyLog.production.birdCount) || 0;
                                  return (
                                    <>
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                          <p className="text-xs font-bold text-slate-400">Total Feed Cost</p>
                                          <Badge className="bg-orange-500/20 text-orange-400 border-none text-[8px] font-black">FEED</Badge>
                                        </div>
                                        <p className="text-2xl font-black text-white">₹{costs.feedCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{dailyLog.consumption.feedIntake || 0}kg x {dailyLog.consumption.feedType}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                          <p className="text-xs font-bold text-slate-400">Med & Labour</p>
                                          <Badge className="bg-blue-500/20 text-blue-400 border-none text-[8px] font-black">OTHER</Badge>
                                        </div>
                                        <p className="text-2xl font-black text-white">₹{(costs.medicineCost + costs.labourCost).toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Med: ₹{costs.medicineCost.toFixed(0)} | Lab: ₹{costs.labourCost.toFixed(0)}</p>
                                      </div>
                                      <div className="md:col-span-2 pt-4 border-t border-slate-800 flex justify-between items-center">
                                        <div>
                                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Daily Operational Cost</p>
                                          <p className="text-3xl font-black text-white">₹{costs.totalCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                          <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Per Egg (Est.)</p>
                                            <p className="text-xl font-black text-emerald-400 leading-none">
                                              ₹{Number(dailyLog.production.goodEggs) > 0 ? (costs.totalCost / Number(dailyLog.production.goodEggs)).toFixed(2) : '0.00'}
                                            </p>
                                          </div>
                                          {birdCount > 0 && (
                                            <div>
                                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cost Per Bird</p>
                                              <p className="text-lg font-black text-emerald-400/70 leading-none">
                                                ₹{(costs.totalCost / birdCount).toFixed(2)}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 6. Biosecurity Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('biosecurity')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-emerald-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                              <ShieldCheck size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Biosecurity Section</span>
                          </div>
                          {expandedSections.biosecurity ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.biosecurity && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
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
                        )}
                      </div>

                      {/* 7. Disease Observation Section */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSection('disease')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-amber-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                              <AlertTriangle size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Disease Observation</span>
                          </div>
                          {expandedSections.disease ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.disease && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-4">
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
                              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <input 
                                  type="checkbox" 
                                  id="diseaseAlert" 
                                  checked={redirectToAlerts} 
                                  onChange={e => setRedirectToAlerts(e.target.checked)} 
                                  className="w-5 h-5 rounded accent-amber-600 cursor-pointer"
                                />
                                <Label htmlFor="diseaseAlert" className="text-xs font-bold text-amber-900 cursor-pointer">
                                  Critical Issue? Mark for Health Alert & Diagnosis
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Growth Section - Moved to bottom (or could be merged elsewhere) */}
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => toggleSection('growth')}
                          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 hover:bg-purple-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                              <Scale size={18} />
                            </div>
                            <span className="font-bold text-slate-900">Growth / Weight Tracking</span>
                          </div>
                          {expandedSections.growth ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                        </button>
                        {expandedSections.growth && (
                          <div className="p-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="avgWeight">Avg Body Weight (Grams)</Label>
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
                        )}
                      </div>
                    </div>

                    <div className="pt-6">
                      <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-2xl py-8 text-xl font-bold shadow-xl shadow-emerald-900/20" disabled={loading}>
                        <Save className="mr-2" size={28} />
                        Save Daily Data
                      </Button>
                    </div>
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
                          case 'eggs_prod':
                            const combinedEggLogs = [
                              ...eggLogs.filter(flockFilter).map(log => ({
                                ...log,
                                source: 'egg_log',
                                count: Number(log.totalEggs),
                                good: Number(log.goodEggs),
                                bad: Number(log.badEggs),
                                birds: Number(log.birdCount) || 1,
                                logCost: (Number(log.feedConsumptionKg) * Number(log.feedCostPerKg) || 0) + (Number(log.medicineCost) || 0) + (Number(log.labourCost) || 0)
                              })),
                              ...logs.filter(l => flockFilter(l) && Number(l.production?.eggCount) > 0).map(log => {
                                const intake = Number(log.consumption?.feedIntake) || 0;
                                const fType = log.consumption?.feedType;
                                const stock = feedStock.find(s => s.type === fType);
                                const fPrice = stock?.unitPrice || (stock?.initialQuantity ? (Number(stock.purchaseCost) / Number(stock.initialQuantity)) : 0);
                                const feedCost = intake * fPrice;
                                const medCost = (Array.isArray(log.health?.medicines) ? log.health.medicines : []).reduce((sum: number, m: any) => {
                                   const mStock = medicineStock.find(ms => ms.name === m.name);
                                   const mPrice = mStock?.unitPrice || (mStock?.initialQuantity ? (Number(mStock.purchaseCost) / Number(mStock.initialQuantity)) : 0);
                                   return sum + (Number(m.doses) * mPrice);
                                }, 0);
                                const totalCost = feedCost + medCost + (Number(log.production?.labourCost) || 0);
                          
                                return {
                                  ...log,
                                  source: 'daily_log',
                                  date: log.date,
                                  count: Number(log.production?.eggCount),
                                  good: Number(log.production?.goodEggs),
                                  bad: Number(log.production?.badEggs),
                                  birds: Number(log.birds?.closing) || Number(log.birds?.active) || 1,
                                  logCost: totalCost
                                };
                              })
                            ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                          
                            displayItems = combinedEggLogs.map(log => {
                               const flock = flocks.find(f => f.id === log.flockId);
                               const actualBirds = log.birds > 1 ? log.birds : (Number(flock?.birdCount) || 1);
                               const layingRatio = Math.round((log.count / actualBirds) * 100);
                               const costPerEgg = log.good > 0 ? log.logCost / log.good : 0;
                               
                               // Find matching sales for this date and flock
                               const matchingSales = eggSales.filter(s => s.saleDate === log.date && s.flockId === log.flockId);
                               const totalProfit = matchingSales.reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
                               const totalSold = matchingSales.reduce((sum, s) => sum + (Number(s.eggCount) || 0), 0);
                               const profitPerEgg = totalSold > 0 ? totalProfit / totalSold : 0;
                               const totalRevenue = matchingSales.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
                               const profitPercent = (totalRevenue - totalProfit) > 0 ? (totalProfit / (totalRevenue - totalProfit)) * 100 : 0;

                               return {
                                id: log.id,
                                date: log.date,
                                flockId: log.flockId,
                                title: log.source === 'egg_log' ? 'Egg Production Log' : 'Daily Production Data',
                                details: (
                                  <div className="space-y-3 mt-2">
                                    <div className="grid grid-cols-4 gap-2">
                                       <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Coll.</p>
                                          <p className="text-xs font-bold text-slate-900">{log.count}</p>
                                       </div>
                                       <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                          <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Good</p>
                                          <p className="text-xs font-bold text-emerald-900">{log.good}</p>
                                       </div>
                                       <div className="p-2 bg-red-50 rounded-xl border border-red-100 text-center">
                                          <p className="text-[8px] font-bold text-red-600 uppercase tracking-tighter">Bad</p>
                                          <p className="text-xs font-bold text-red-900">{log.bad}</p>
                                       </div>
                                       <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                          <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-tighter">Ratio</p>
                                          <p className="text-xs font-bold text-indigo-900">{layingRatio}%</p>
                                       </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100">
                                       <span className="text-[9px] font-bold text-blue-600 uppercase">Cost Per Egg</span>
                                       <span className="text-xs font-bold text-blue-900">₹{costPerEgg.toFixed(2)}</span>
                                    </div>

                                    {totalSold > 0 && (
                                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                          <p className="text-[8px] font-bold text-emerald-600 uppercase">Profit/Egg</p>
                                          <p className="text-xs font-bold text-emerald-900">₹{profitPerEgg.toFixed(2)}</p>
                                        </div>
                                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                          <p className="text-[8px] font-bold text-emerald-600 uppercase">Profit</p>
                                          <p className="text-xs font-bold text-emerald-900">₹{totalProfit}</p>
                                        </div>
                                        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                          <p className="text-[8px] font-bold text-emerald-600 uppercase">Profit %</p>
                                          <p className="text-xs font-bold text-emerald-900">{profitPercent.toFixed(1)}%</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ),
                                raw: log,
                                type: log.source === 'egg_log' ? 'egg_log' : 'daily_log'
                              };
                            });
                            break;
                          case 'eggs_sold':
                            displayItems = eggSales.filter(flockFilter).sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || '')).map(sale => {
                              const profitPerEgg = sale.eggCount > 0 ? (Number(sale.profit) / Number(sale.eggCount)) : 0;
                              const totalCost = Number(sale.totalPrice) - Number(sale.profit);
                              const profitPercent = totalCost > 0 ? (Number(sale.profit) / totalCost) * 100 : 0;

                              return {
                                id: sale.id,
                                date: sale.saleDate,
                                flockId: sale.flockId,
                                title: 'Egg Sale Record',
                                details: (
                                  <div className="space-y-3 mt-2">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                      <div>
                                        <p className="text-[11px] font-black text-slate-900">{sale.eggCount} Eggs sold</p>
                                        <p className="text-[10px] text-slate-400 font-medium">@{sale.sellingRate}/egg</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-black text-emerald-600">₹{sale.totalPrice}</p>
                                        <p className="text-[10px] text-slate-400 italic font-medium">to {sale.buyerName || 'Private'}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-center">
                                        <p className="text-[8px] font-bold text-blue-600 uppercase">Profit/Egg</p>
                                        <p className="text-xs font-bold text-blue-900">₹{profitPerEgg.toFixed(2)}</p>
                                      </div>
                                      <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                        <p className="text-[8px] font-bold text-emerald-600 uppercase">Profit</p>
                                        <p className="text-xs font-bold text-emerald-900">₹{sale.profit}</p>
                                      </div>
                                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-100 text-center">
                                        <p className="text-[8px] font-bold text-amber-600 uppercase">Profit %</p>
                                        <p className="text-xs font-bold text-amber-900">{profitPercent.toFixed(1)}%</p>
                                      </div>
                                    </div>
                                  </div>
                                ),
                                amount: sale.totalPrice,
                                raw: sale,
                                type: 'egg_sale'
                              };
                            });
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
                                  <span className="text-xs font-medium text-slate-500">
                                    {(() => {
                                      try {
                                        const d = item.date || (item as any).timestamp;
                                        if (!d) return 'N/A';
                                        return format(new Date(d), 'MMM dd, yyyy');
                                      } catch (e) {
                                        return 'N/A';
                                      }
                                    })()}
                                  </span>
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
                                {item.type === 'daily' || item.type === 'medicine' || item.type === 'feed' || item.type === 'alert' || item.type === 'egg_log' || item.type === 'egg_sale' ? (
                                  <>
                                    {item.type !== 'egg_sale' && (
                                      <Button variant="ghost" size="icon" onClick={() => setEditingLog(item.raw)} className="h-9 w-9 rounded-full hover:bg-slate-100">
                                        <Edit2 size={16} />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => {
                                      if (item.type === 'egg_log') handleDeleteEggLog(item.id);
                                      else if (item.type === 'egg_sale') handleDeleteEggSale(item.id);
                                      else handleDeleteLog(item.id);
                                    }} className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50">
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
                  Selling Entry
                </CardTitle>
                <CardDescription>Record flock or egg sales</CardDescription>
                
                <div className="flex bg-slate-100 p-1 rounded-xl mt-4">
                  <button 
                    type="button"
                    onClick={() => setSellMode('batch')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sellMode === 'batch' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Bird size={14} />
                    Record Batch Sell
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSellMode('egg')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sellMode === 'egg' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Egg size={14} />
                    Record Egg Sell
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {sellMode === 'batch' ? (
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
                          <SelectValue placeholder="Choose a flock">
                            {flocks.find(f => f.id === selectedFlockId)?.name || 'Choose a flock'}
                          </SelectValue>
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
                ) : (
                  <form onSubmit={handleSaveEggSale} className="space-y-6">
                    {(() => {
                      // Auto-calculations for Egg Sale - Flock Aware
                      const relevantLogs = selectedFlockId ? logs.filter(l => l.flockId === selectedFlockId) : logs;
                      const relevantEggLogs = selectedFlockId ? eggLogs.filter(l => l.flockId === selectedFlockId) : eggLogs;
                      const relevantEggSales = selectedFlockId ? eggSales.filter(s => s.flockId === selectedFlockId) : eggSales;

                      const totalGoodEggs = relevantLogs.reduce((sum, log) => sum + (Number(log.production?.goodEggs) || 0), 0) + 
                                           relevantEggLogs.reduce((sum, log) => sum + (Number(log.goodEggs) || 0), 0);
                      const totalEggsSold = relevantEggSales.reduce((sum, sale) => sum + (Number(sale.eggCount) || 0), 0);
                      const availableEggs = Math.max(0, totalGoodEggs - totalEggsSold);

                      // Cost Per Egg calculation
                      // Operational costs from dailyLogs + eggLogs
                      const totalLogOpCost = relevantLogs.reduce((sum, log) => {
                        const feedIntake = Number(log.consumption?.feedIntake) || 0;
                        const feedType = log.consumption?.feedType;
                        const stockItem = feedStock.find(s => s.type === feedType);
                        
                        const feedPrice = stockItem?.unitPrice || 
                                           (Number(stockItem?.initialQuantity) ? (Number(stockItem.purchaseCost) / Number(stockItem.initialQuantity)) : 
                                           (Number(stockItem?.quantity) ? (Number(stockItem.purchaseCost) / Number(stockItem.quantity)) : 0));
                        
                        const medicineCost = (Array.isArray(log.health?.medicines) ? log.health.medicines : []).reduce((mSum: number, med: any) => {
                          const medStock = medicineStock.find(ms => ms.name === med.name);
                          const unitPrice = medStock?.unitPrice || 
                                           (Number(medStock?.initialQuantity) ? (Number(medStock.purchaseCost) / Number(medStock.initialQuantity)) : 
                                           (Number(medStock?.quantity) ? (Number(medStock.purchaseCost) / Number(medStock.quantity)) : 0));
                          return mSum + (Number(med.doses) * unitPrice);
                        }, 0);

                        const vaccineCost = (Array.isArray(log.health?.vaccines) ? log.health.vaccines : []).reduce((vSum: number, vac: any) => {
                          const vacStock = medicineStock.find(vs => vs.name === vac.name);
                          const unitPrice = vacStock?.unitPrice || 
                                           (Number(vacStock?.initialQuantity) ? (Number(vacStock.purchaseCost) / Number(vacStock.initialQuantity)) : 
                                           (Number(vacStock?.quantity) ? (Number(vacStock.purchaseCost) / Number(vacStock.quantity)) : 0));
                          return vSum + (Number(vac.doses) * unitPrice);
                        }, 0);

                        return sum + (feedIntake * feedPrice) + medicineCost + vaccineCost + (Number(log.production?.labourCost) || 0);
                      }, 0);

                      const totalEggLogOpCost = relevantEggLogs.reduce((sum, log) => {
                        return sum + (Number(log.feedConsumptionKg) * Number(log.feedCostPerKg) || 0) + 
                               (Number(log.medicineCost) || 0) + 
                               (Number(log.labourCost) || 0);
                      }, 0);

                      const totalOpCost = totalLogOpCost + totalEggLogOpCost;
                      const costPerEgg = totalGoodEggs > 0 ? (totalOpCost / totalGoodEggs) : 0;

                      // 7-Day Average Cost calculation
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

                      const recentLogs = relevantLogs.filter(l => (l.date || '') >= sevenDaysAgoStr);
                      const recentEggLogs = relevantEggLogs.filter(l => (l.date || '') >= sevenDaysAgoStr);

                      const recentLogCost = recentLogs.reduce((sum, log) => {
                        const intake = Number(log.consumption?.feedIntake) || 0;
                        const fType = log.consumption?.feedType;
                        const stockItem = feedStock.find(s => s.type === fType);
                        const fPrice = stockItem?.unitPrice || (stockItem?.initialQuantity ? (stockItem.purchaseCost / stockItem.initialQuantity) : 0);
                        return sum + (intake * fPrice) + (Number(log.production?.labourCost) || 0);
                      }, 0);

                      const recentEggLogCost = recentEggLogs.reduce((sum, log) => {
                        return sum + (Number(log.feedConsumptionKg) * Number(log.feedCostPerKg) || 0) + (Number(log.medicineCost) || 0) + (Number(log.labourCost) || 0);
                      }, 0);

                      const recentEggs = recentLogs.reduce((sum, log) => sum + (Number(log.production?.goodEggs) || 0), 0) + 
                                        recentEggLogs.reduce((sum, log) => sum + (Number(log.goodEggs) || 0), 0);
                      
                      const recentCostPerEgg = recentEggs > 0 ? ((recentLogCost + recentEggLogCost) / recentEggs) : costPerEgg;

                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                            <div className="p-5 bg-emerald-50 rounded-[2rem] border border-emerald-100 flex items-center justify-between shadow-sm">
                              <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Available Eggs</p>
                                <p className="text-3xl font-black text-slate-900 leading-none">{availableEggs}</p>
                              </div>
                              <div className="bg-white p-3 rounded-2xl text-emerald-600 shadow-sm border border-emerald-50">
                                <Egg size={20} />
                              </div>
                            </div>
                            <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-center justify-between shadow-sm">
                              <div>
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Recent Cost (7d)</p>
                                <p className="text-2xl font-black text-slate-900 leading-none">₹{recentCostPerEgg.toFixed(2)}</p>
                              </div>
                              <div className="bg-white p-3 rounded-2xl text-amber-600 shadow-sm border border-amber-50">
                                <TrendingUp size={20} />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Sale Date</Label>
                              <Input 
                                type="date" 
                                value={eggSaleData.saleDate} 
                                onChange={e => setEggSaleData({...eggSaleData, saleDate: e.target.value})}
                                className="rounded-xl border-emerald-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Egg Count (Total Eggs)</Label>
                              <Input 
                                type="number" 
                                required 
                                value={eggSaleData.eggCount} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setEggSaleData({
                                    ...eggSaleData, 
                                    eggCount: val,
                                    costPerEgg: eggSaleData.costPerEgg || costPerEgg.toFixed(2)
                                  });
                                }}
                                placeholder={`Max: ${availableEggs}`}
                                max={availableEggs}
                                className="rounded-xl border-emerald-100"
                              />
                              {Number(eggSaleData.eggCount) > availableEggs && (
                                <p className="text-[10px] text-red-500 font-bold">Error: Exceeds available stock!</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Recent Cost (7D) (₹)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                value={eggSaleData.costPerEgg || recentCostPerEgg.toFixed(2)} 
                                onChange={e => setEggSaleData({...eggSaleData, costPerEgg: e.target.value})}
                                placeholder="e.g. 5.50"
                                className="rounded-xl border-emerald-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Selling Rate (₹ per Egg)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                required 
                                value={eggSaleData.sellingRate} 
                                onChange={e => setEggSaleData({...eggSaleData, sellingRate: e.target.value})}
                                placeholder="e.g. 7.00"
                                className="rounded-xl border-emerald-100"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Buyer Name</Label>
                              <Input 
                                value={eggSaleData.buyerName} 
                                onChange={e => setEggSaleData({...eggSaleData, buyerName: e.target.value})}
                                placeholder="Who bought them?"
                                className="rounded-xl border-emerald-100"
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <div className="space-y-2">
                      <Label>Buyer Contact / Notes</Label>
                      <Input 
                        value={eggSaleData.buyerContact} 
                        onChange={e => setEggSaleData({...eggSaleData, buyerContact: e.target.value})}
                        placeholder="Phone or extra details..."
                        className="rounded-xl border-emerald-100"
                      />
                    </div>

                    {/* Egg Sale Live Calculation */}
                    {(Number(eggSaleData.eggCount) > 0 && Number(eggSaleData.sellingRate) > 0) && (
                      <div className="p-6 bg-[#122B21] rounded-[2rem] text-white shadow-xl shadow-emerald-900/20 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Revenue Estimation</p>
                            <h4 className="text-lg font-bold">Egg Sale Total</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400 text-xs font-medium">{eggSaleData.eggCount} eggs × ₹{eggSaleData.sellingRate}</p>
                            <p className="text-3xl font-black">₹{(Number(eggSaleData.eggCount) * Number(eggSaleData.sellingRate)).toLocaleString()}</p>
                          </div>
                        </div>

                        {Number(eggSaleData.costPerEgg) > 0 && (() => {
                          const revenue = Number(eggSaleData.eggCount) * Number(eggSaleData.sellingRate);
                          const cost = Number(eggSaleData.eggCount) * Number(eggSaleData.costPerEgg);
                          const profit = revenue - cost;
                          const profitPerEgg = Number(eggSaleData.sellingRate) - Number(eggSaleData.costPerEgg);
                          const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;

                          return (
                            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
                              <div>
                                <p className="text-emerald-400 text-[9px] font-bold uppercase mb-1">Profit/Egg</p>
                                <p className="text-sm font-bold">₹{profitPerEgg.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-emerald-400 text-[9px] font-bold uppercase mb-1">Total Profit</p>
                                <p className="text-sm font-bold">₹{profit.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-emerald-400 text-[9px] font-bold uppercase mb-1">Profit %</p>
                                <p className="text-sm font-bold">{profitPercent.toFixed(1)}%</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <Button type="submit" disabled={loading} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-200 font-bold text-lg">
                      {loading ? 'Recording...' : 'Record Egg Sale'}
                    </Button>
                  </form>
                )}

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
                                Sold on {(() => {
                                  if (!item.date) return 'N/A';
                                  try {
                                    const d = new Date(item.date);
                                    return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM dd, yyyy');
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
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

          {/* Tab: Hatchery Data */}
          {activeTab === 'hatchery' && (
            <Card className="border-none shadow-sm rounded-3xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Egg className="text-indigo-600" />
                  Hatchery Batch Management
                </CardTitle>
                <CardDescription>Track egg incubation and hatching performance</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateHatcheryBatch} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="batchName">Batch Name / ID</Label>
                      <Input 
                        id="batchName" 
                        required 
                        value={hatcheryData.batchName} 
                        onChange={e => setHatcheryData({...hatcheryData, batchName: e.target.value})} 
                        placeholder="e.g. HATCH-2024-001" 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Current Status</Label>
                      <Select 
                        value={hatcheryData.status} 
                        onValueChange={v => setHatcheryData({...hatcheryData, status: v})}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Incubating">Incubating</SelectItem>
                          <SelectItem value="Hatched">Hatched</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setDate">Date Eggs Set</Label>
                      <Input 
                        id="setDate" 
                        type="date" 
                        required 
                        value={hatcheryData.setDate} 
                        onChange={e => setHatcheryData({...hatcheryData, setDate: e.target.value})} 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expectedHatchDate">Expected Hatch Date</Label>
                      <Input 
                        id="expectedHatchDate" 
                        type="date" 
                        required 
                        value={hatcheryData.expectedHatchDate} 
                        onChange={e => setHatcheryData({...hatcheryData, expectedHatchDate: e.target.value})} 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eggsSet">Total Eggs Set (Qty)</Label>
                      <Input 
                        id="eggsSet" 
                        type="number" 
                        required 
                        value={hatcheryData.eggsSet} 
                        onChange={e => setHatcheryData({...hatcheryData, eggsSet: e.target.value})} 
                        placeholder="0" 
                        className="rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hatcheryCost">Incubation Cost (₹)</Label>
                      <Input 
                        id="hatcheryCost" 
                        type="number" 
                        value={hatcheryData.cost} 
                        onChange={e => setHatcheryData({...hatcheryData, cost: e.target.value})} 
                        placeholder="0.00" 
                        className="rounded-xl" 
                      />
                    </div>
                  </div>

                  {hatcheryData.status === 'Hatched' && (
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                        <Plus size={16} />
                        Hatching Results
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="actualHatchDate">Hatch Date</Label>
                          <Input 
                            id="actualHatchDate" 
                            type="date" 
                            value={hatcheryData.actualHatchDate} 
                            onChange={e => setHatcheryData({...hatcheryData, actualHatchDate: e.target.value})} 
                            className="rounded-xl" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chicksHatched">Total Chicks Hatched</Label>
                          <Input 
                            id="chicksHatched" 
                            type="number" 
                            value={hatcheryData.chicksHatched} 
                            onChange={e => setHatcheryData({...hatcheryData, chicksHatched: e.target.value})} 
                            placeholder="0" 
                            className="rounded-xl" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gradeA">Grade A Chicks</Label>
                          <Input 
                            id="gradeA" 
                            type="number" 
                            value={hatcheryData.gradeA} 
                            onChange={e => setHatcheryData({...hatcheryData, gradeA: e.target.value})} 
                            placeholder="0" 
                            className="rounded-xl" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gradeB">Grade B Chicks</Label>
                          <Input 
                            id="gradeB" 
                            type="number" 
                            value={hatcheryData.gradeB} 
                            onChange={e => setHatcheryData({...hatcheryData, gradeB: e.target.value})} 
                            placeholder="0" 
                            className="rounded-xl" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="hatcheryNotes">Notes</Label>
                    <Input 
                      id="hatcheryNotes" 
                      value={hatcheryData.notes} 
                      onChange={e => setHatcheryData({...hatcheryData, notes: e.target.value})} 
                      placeholder="e.g. Fertility rate was good, temp fluctuations on day 5..." 
                      className="rounded-xl" 
                    />
                  </div>

                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6 text-lg font-bold" disabled={loading}>
                    <Plus className="mr-2" size={20} />
                    Record Hatchery Batch
                  </Button>
                </form>

                <div className="mt-12 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Save size={20} className="text-indigo-600" />
                      Hatchery History
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {hatcheryBatches.map(batch => (
                      <div key={batch.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900">{batch.batchName}</h4>
                            <Badge variant={batch.status === 'Hatched' ? 'secondary' : batch.status === 'Cancelled' ? 'destructive' : 'default'} className="rounded-full">
                              {batch.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            Set on {(() => {
                              try {
                                return format(new Date(batch.setDate), 'MMM dd, yyyy');
                              } catch (e) {
                                return 'N/A';
                              }
                            })()} • {batch.eggsSet} eggs
                          </p>
                          {batch.status === 'Hatched' && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {batch.chicksHatched} Chicks Hatched ({batch.hatchability}%)
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 sm:flex-none rounded-xl h-10 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => setEditingHatcheryBatch(batch)}
                          >
                            <Edit2 size={14} className="mr-2" />
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 sm:flex-none rounded-xl h-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteHatcheryBatch(batch.id)}
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {hatcheryBatches.length === 0 && (
                      <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        No hatchery batches recorded yet
                      </div>
                    )}
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
                
                // Consumption-based Costs (as per user methodology)
                let consumedFeedCost = 0;
                let consumedMedCost = 0;

                flockLogs.forEach(log => {
                  // Feed Cost
                  const intake = Number(log.consumption?.feedIntake) || 0;
                  const fType = log.consumption?.feedType;
                  if (intake > 0 && fType) {
                    const stock = feedStock.find(s => s.type === fType);
                    // Use stock.unitPrice if available, otherwise fallback to (purchaseCost / initialQuantity)
                    const unitPrice = stock?.unitPrice || 
                                     (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 
                                     (stock?.quantity ? (stock.purchaseCost / stock.quantity) : 0));
                    if (unitPrice > 0) {
                      consumedFeedCost += intake * unitPrice;
                    }
                  }
                  // Med/Vac Cost
                  const mName = log.health?.medicines;
                  const mDoses = Number(log.health?.medicineDoses) || 0;
                  if (mDoses > 0 && mName && mName !== 'none') {
                    const stock = medicineStock.find(s => s.name === mName);
                    const unitPrice = stock?.unitPrice || 
                                     (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 
                                     (stock?.quantity ? (stock.purchaseCost / stock.quantity) : 0));
                    if (unitPrice > 0) {
                      consumedMedCost += mDoses * unitPrice;
                    }
                  }
                  const vName = log.health?.vaccines;
                  const vDoses = Number(log.health?.vaccineDoses) || 0;
                  if (vDoses > 0 && vName && vName !== 'none') {
                    const stock = medicineStock.find(s => s.name === vName);
                    const unitPrice = stock?.unitPrice || 
                                     (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 
                                     (stock?.quantity ? (stock.purchaseCost / stock.quantity) : 0));
                    if (unitPrice > 0) {
                      consumedMedCost += vDoses * unitPrice;
                    }
                  }
                });

                // Detailed breakdowns for UI
                const feedBreakdown: Record<string, { kg: number, cost: number }> = {};
                const healthBreakdown: Record<string, { type: string, qty: number, cost: number }> = {};

                flockLogs.forEach(log => {
                  const intake = Number(log.consumption?.feedIntake) || 0;
                  const fType = log.consumption?.feedType;
                  if (intake > 0 && fType) {
                    const stock = feedStock.find(s => s.type === fType);
                    const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                    if (!feedBreakdown[fType]) feedBreakdown[fType] = { kg: 0, cost: 0 };
                    feedBreakdown[fType].kg += intake;
                    feedBreakdown[fType].cost += (intake * unitPrice);
                  }

                  const mName = log.health?.medicines;
                  const mDoses = Number(log.health?.medicineDoses) || 0;
                  if (mDoses > 0 && mName && mName !== 'none') {
                    const stock = medicineStock.find(s => s.name === mName);
                    const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                    if (!healthBreakdown[mName]) healthBreakdown[mName] = { type: 'Medicine', qty: 0, cost: 0 };
                    healthBreakdown[mName].qty += mDoses;
                    healthBreakdown[mName].cost += (mDoses * unitPrice);
                  }

                  const vName = log.health?.vaccines;
                  const vDoses = Number(log.health?.vaccineDoses) || 0;
                  if (vDoses > 0 && vName && vName !== 'none') {
                    const stock = medicineStock.find(s => s.name === vName);
                    const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                    if (!healthBreakdown[vName]) healthBreakdown[vName] = { type: 'Vaccine', qty: 0, cost: 0 };
                    healthBreakdown[vName].qty += vDoses;
                    healthBreakdown[vName].cost += (vDoses * unitPrice);
                  }
                });

                const chicksCost = Number(flock.chicksCost) || 0;
                const feedCost = consumedFeedCost; // Force consumption based
                const medCost = consumedMedCost; // Force consumption based
                const otherCost = flockTxs.filter(t => t.type === 'Expense' && !['Feed', 'Medicine', 'Vaccine', 'Chicks'].includes(t.category)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                
                const totalExpenses = chicksCost + feedCost + medCost + otherCost;
                const currentAlive = Number(flock.currentCount) || 0;
                const costPerBird = currentAlive > 0 ? totalExpenses / currentAlive : (totalExpenses / (flock.initialCount - totalMortality));
                const netProfit = totalRevenue - totalExpenses;
                const isProfit = netProfit >= 0;

                const totalWeightSold = Number(flock.saleDetails?.totalWeight) || 0;
                const currentWeightKg = ((flock.currentWeight || flock.initialAvgWeight || 0) / 1000) * currentAlive;
                const weightForFCR = totalWeightSold > 0 ? totalWeightSold : currentWeightKg;
                const fcr = weightForFCR > 0 ? (totalFeed / weightForFCR).toFixed(2) : 'N/A';

                const duration = flock.soldAt && flock.placementDate 
                  ? Math.ceil((new Date(flock.soldAt).getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24))
                  : flockLogs.length > 0 
                    ? Math.ceil((new Date(flockLogs[0].date).getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 'N/A';

                return (
                  <div className="bg-slate-50 min-h-full">
                    <div ref={reportRef}>
                      <div className="p-6 bg-white border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center group">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <ClipboardList className="text-emerald-600 transition-transform group-hover:scale-110" />
                            Batch Performance Report
                          </h2>
                          <p className="text-sm text-slate-500 font-medium uppercase tracking-tight">{flock.name} • {flock.breed}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setReportFlockId(null)} className="rounded-full hover:bg-slate-100">
                          <Plus className="rotate-45 text-slate-400" size={24} />
                        </Button>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Birds</p>
                            <p className="text-lg font-black text-slate-900">{flock.initialCount}</p>
                            <p className="text-[10px] text-red-500 font-bold mt-1 tracking-tight">{totalMortality} Deaths ({mortalityRate}%)</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Feed</p>
                            <p className="text-lg font-black text-slate-900">{totalFeed.toLocaleString()} kg</p>
                            <p className="text-[10px] text-amber-600 font-bold mt-1 tracking-tight">FCR: {fcr}</p>
                          </div>
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sale Weight</p>
                            <p className="text-lg font-black text-slate-900">{totalWeightSold} kg</p>
                            <p className="text-[10px] text-blue-600 font-bold mt-1 tracking-tight">Duration: {duration} Days</p>
                          </div>
                          <div className={`${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border p-4 rounded-2xl shadow-sm transition-all hover:shadow-md`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>Net Profit/Loss</p>
                            <p className={`text-lg font-black ${isProfit ? 'text-emerald-700' : 'text-red-700'}`}>₹{Math.abs(netProfit).toLocaleString()}</p>
                            <p className={`text-[10px] font-bold mt-1 tracking-tight ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>{isProfit ? 'Profit' : 'Loss'}</p>
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
                          <CardContent className="p-4 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Chicks Cost</span>
                              <span className="font-bold text-slate-700">₹{chicksCost.toLocaleString()}</span>
                            </div>

                            {/* Detailed Feed Breakdown */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Feed Breakdown</p>
                              {Object.entries(feedBreakdown).map(([type, data]) => (
                                <div key={type} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <span className="text-slate-600 font-medium">{type} ({data.kg} kg)</span>
                                  <span className="font-bold text-slate-800">₹{data.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                </div>
                              ))}
                              {Object.keys(feedBreakdown).length === 0 && (
                                <p className="text-[10px] italic text-slate-400 pl-1">No feed records</p>
                              )}
                              <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-100">
                                <span className="text-slate-500">Total Feed Cost</span>
                                <span className="font-bold text-slate-700">₹{feedCost.toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Detailed Health Breakdown */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Medicine & Vaccine Breakdown</p>
                              {Object.entries(healthBreakdown).map(([name, data]) => (
                                <div key={name} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <span className="text-slate-600 font-medium">{name} ({data.qty} doses/units)</span>
                                  <span className="font-bold text-slate-800">₹{data.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                </div>
                              ))}
                              {Object.keys(healthBreakdown).length === 0 && (
                                <p className="text-[10px] italic text-slate-400 pl-1">No health records</p>
                              )}
                              <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-100">
                                <span className="text-slate-500">Total Med Cost</span>
                                <span className="font-bold text-slate-700">₹{medCost.toLocaleString()}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Other Expenses</span>
                              <span className="font-bold text-slate-700">₹{otherCost.toLocaleString()}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-2 rounded-xl mt-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Cost Per Bird</p>
                                <p className="text-sm font-bold text-emerald-600">₹{costPerBird.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Expenses</p>
                                <p className="text-sm font-bold text-red-600">₹{totalExpenses.toLocaleString()}</p>
                              </div>
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
                    </div>
                  </div>

                  <div className="flex justify-center pb-8 sticky bottom-0 bg-white/90 backdrop-blur-md p-6 border-t border-slate-100 z-20">
                  <Button 
                    variant="default" 
                    className="rounded-2xl px-12 py-7 bg-[#122B21] hover:bg-[#1a3d2e] shadow-2xl shadow-emerald-950/20 flex items-center gap-3 font-black text-base transition-all active:scale-95 text-white"
                    onClick={() => handleDownloadPDF(flock.name)}
                  >
                    <Download size={22} className="text-emerald-400" />
                    DOWNLOAD PDF REPORT
                  </Button>
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

          {/* Edit Hatchery Batch Dialog */}
          <Dialog open={!!editingHatcheryBatch} onOpenChange={(open) => !open && setEditingHatcheryBatch(null)}>
            <DialogContent className="sm:max-w-[600px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Edit Hatchery Batch</DialogTitle>
              </DialogHeader>
              {editingHatcheryBatch && (
                <form onSubmit={handleUpdateHatcheryBatch} className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-batchName">Batch Name</Label>
                      <Input id="edit-batchName" value={editingHatcheryBatch.batchName} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, batchName: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-hatcheryStatus">Status</Label>
                      <Select value={editingHatcheryBatch.status} onValueChange={v => setEditingHatcheryBatch({...editingHatcheryBatch, status: v})}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Incubating">Incubating</SelectItem>
                          <SelectItem value="Hatched">Hatched</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-eggsSet">Eggs Set</Label>
                      <Input id="edit-eggsSet" type="number" value={editingHatcheryBatch.eggsSet} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, eggsSet: e.target.value})} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-hBatchCost">Batch Cost (₹)</Label>
                      <Input id="edit-hBatchCost" type="number" value={editingHatcheryBatch.cost} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, cost: e.target.value})} className="rounded-xl" />
                    </div>
                    {editingHatcheryBatch.status === 'Hatched' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="edit-chicks">Chicks Hatched</Label>
                          <Input id="edit-chicks" type="number" value={editingHatcheryBatch.chicksHatched} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, chicksHatched: e.target.value})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-gradeA">Grade A</Label>
                          <Input id="edit-gradeA" type="number" value={editingHatcheryBatch.gradeA} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, gradeA: e.target.value})} className="rounded-xl" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Input id="edit-notes" value={editingHatcheryBatch.notes} onChange={e => setEditingHatcheryBatch({...editingHatcheryBatch, notes: e.target.value})} className="rounded-xl" />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0 mt-4">
                    <Button type="button" variant="outline" onClick={() => setEditingHatcheryBatch(null)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl" disabled={loading}>Save Changes</Button>
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
                      {Number(newMedicine.purchaseCost) > 0 && Number(newMedicine.quantity) > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600 ml-1">
                          Auto-calculated: ₹{(Number(newMedicine.purchaseCost) / Number(newMedicine.quantity)).toFixed(2)} per {newMedicine.unit}
                        </p>
                      )}
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
                              <p className="text-[10px] text-slate-400">
                                {(() => {
                                  try {
                                    return item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy') : 'N/A';
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-indigo-600">{item.quantity} {item.unit}</p>
                              {item.purchaseCost > 0 && (
                                <p className="text-[10px] text-slate-500">
                                  ₹{item.purchaseCost} (₹{item.unitPrice ? item.unitPrice.toFixed(2) : (item.initialQuantity ? (item.purchaseCost / item.initialQuantity).toFixed(2) : 0)}/{item.unit})
                                </p>
                              )}
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
                                    {(() => {
                                      try {
                                        return format(new Date(log.date), 'dd MMM yyyy');
                                      } catch (e) {
                                        return 'N/A';
                                      }
                                    })()} • {flock?.name || 'Unknown Batch'}
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
                      {Number(newFeed.purchaseCost) > 0 && Number(newFeed.quantity) > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600 ml-1">
                          Auto-calculated: ₹{(Number(newFeed.purchaseCost) / Number(newFeed.quantity)).toFixed(2)} per kg
                        </p>
                      )}
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
                                  <p className="text-[10px] text-slate-400">
                                    Last: {(() => {
                                      try {
                                        return format(new Date(item.lastEntry), 'dd MMM');
                                      } catch (e) {
                                        return 'N/A';
                                      }
                                    })()}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-amber-600">{item.quantity} kg</p>
                              {item.purchaseCost > 0 && (
                                <p className="text-[10px] text-slate-500">
                                  ₹{item.purchaseCost} (₹{item.unitPrice ? item.unitPrice.toFixed(2) : (item.initialQuantity ? (item.purchaseCost / item.initialQuantity).toFixed(2) : 0)}/kg)
                                </p>
                              )}
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
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="bg-teal-600 text-white pb-8">
                  <CardTitle className="flex items-center gap-2 text-2xl font-black">
                    <Users size={28} />
                    Manage Contacts
                  </CardTitle>
                  <CardDescription className="text-teal-50/70 font-medium">Add buyers, suppliers, and essential service providers</CardDescription>
                </CardHeader>
                <CardContent className="mt-[-20px]">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <form onSubmit={handleSaveContact} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contactName">Name</Label>
                          <Input 
                            id="contactName" 
                            required 
                            value={contactData.name} 
                            onChange={e => setContactData({...contactData, name: e.target.value})}
                            placeholder="John Doe"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactPhone">Phone</Label>
                          <Input 
                            id="contactPhone" 
                            required 
                            value={contactData.phone} 
                            onChange={e => setContactData({...contactData, phone: e.target.value})}
                            placeholder="+91 9999999999"
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactRole">Role</Label>
                          <Select 
                            value={contactData.role} 
                            onValueChange={(v: any) => setContactData({...contactData, role: v})}
                          >
                            <SelectTrigger className="rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Buyer">Buyer (Egg/Bird)</SelectItem>
                              <SelectItem value="Supplier">Supplier (Feed/Med)</SelectItem>
                              <SelectItem value="Labor">Labor/Staff</SelectItem>
                              <SelectItem value="Vet">Veterinarian</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactNotes">Notes</Label>
                          <Input 
                            id="contactNotes" 
                            value={contactData.notes} 
                            onChange={e => setContactData({...contactData, notes: e.target.value})}
                            placeholder="Short note..."
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 rounded-xl py-6 font-bold shadow-lg shadow-teal-900/10 transition-all hover:scale-[1.01]">
                        <Plus size={18} className="mr-2" />
                        Save New Contact
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.length === 0 ? (
                  <div className="col-span-full p-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No contacts saved yet.</p>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <div key={contact.id} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start justify-between group hover:border-teal-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${
                          contact.role === 'Buyer' ? 'bg-emerald-50 text-emerald-600' :
                          contact.role === 'Supplier' ? 'bg-amber-50 text-amber-600' :
                          contact.role === 'Vet' ? 'bg-blue-50 text-blue-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{contact.role}</p>
                          <h4 className="font-bold text-slate-900 leading-tight">{contact.name}</h4>
                          <a href={`tel:${contact.phone}`} className="text-xs font-bold text-teal-600 hover:underline">{contact.phone}</a>
                          {contact.notes && <p className="text-[10px] text-slate-400 mt-1 italic">"{contact.notes}"</p>}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteContact(contact.id)}
                        className="h-8 w-8 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
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
                          <Label>Total Eggs Collected</Label>
                          <Input 
                            type="number" 
                            value={editingLog.production.eggCount} 
                            onChange={e => {
                              const val = e.target.value;
                              const good = Number(editingLog.production.goodEggs) || 0;
                              const bad = Number(val) - good;
                              setEditingLog({
                                ...editingLog, 
                                production: {
                                  ...editingLog.production, 
                                  eggCount: val,
                                  badEggs: bad > 0 ? bad.toString() : '0'
                                }
                              });
                            }} 
                            className="rounded-xl" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Good Condition Eggs</Label>
                          <Input 
                            type="number" 
                            value={editingLog.production.goodEggs} 
                            onChange={e => {
                              const val = e.target.value;
                              const total = Number(editingLog.production.eggCount) || 0;
                              const bad = total - Number(val);
                              setEditingLog({
                                ...editingLog, 
                                production: {
                                  ...editingLog.production, 
                                  goodEggs: val,
                                  badEggs: bad > 0 ? bad.toString() : '0'
                                }
                              });
                            }} 
                            className="rounded-xl" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bad/Damage Eggs (Auto)</Label>
                          <Input type="number" readOnly value={editingLog.production.badEggs} className="rounded-xl bg-slate-50 text-slate-500" />
                        </div>
                        <div className="space-y-2">
                          <Label>Egg Weight (g)</Label>
                          <Input type="number" value={editingLog.production.eggWeight} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, eggWeight: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Labour Cost (₹)</Label>
                          <Input type="number" value={editingLog.production.labourCost} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, labourCost: e.target.value}})} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bird Count</Label>
                          <Input type="number" value={editingLog.production.birdCount} onChange={e => setEditingLog({...editingLog, production: {...editingLog.production, birdCount: e.target.value}})} className="rounded-xl" />
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

          {/* Task Details Modal */}
          <Dialog open={!!selectedTaskDetails} onOpenChange={(open) => !open && setSelectedTaskDetails(null)}>
            <DialogContent className="max-w-xl rounded-[2.5rem] p-8 border-none overflow-y-auto max-h-[90vh]">
              {selectedTaskDetails && (
                <div className="space-y-8">
                  <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 ${
                      selectedTaskDetails.isCompleted ? 'bg-emerald-100 text-emerald-600' :
                      (selectedTaskDetails.category === 'Vaccination' || selectedTaskDetails.type === 'Vaccination') ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {selectedTaskDetails.isCompleted ? <ClipboardCheck size={40} /> :
                       (selectedTaskDetails.category === 'Vaccination' || selectedTaskDetails.type === 'Vaccination') ? <ShieldCheck size={40} /> : <Pill size={40} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-slate-200">
                          {selectedTaskDetails.category || selectedTaskDetails.type}
                        </Badge>
                        {selectedTaskDetails.isCompleted && <Badge className="bg-emerald-500 text-white border-none text-[10px]">COMPLETED</Badge>}
                        {selectedTaskDetails.isRoadmap && <Badge variant="secondary" className="text-[10px] font-black">ROADMAP</Badge>}
                      </div>
                      <DialogTitle className="text-3xl font-black italic text-slate-900 leading-tight">
                        {selectedTaskDetails.title || selectedTaskDetails.taskTitle}
                      </DialogTitle>
                      <DialogDescription className="font-bold text-slate-400 italic flex items-center gap-2 mt-1">
                        {format(new Date(selectedTaskDetails.scheduledDate), 'MMM dd, yyyy')}
                        {selectedTaskDetails.isRoadmap && ` (Day ${selectedTaskDetails.day})`}
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Methods & Instructions</h4>
                      <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 max-h-[300px] overflow-y-auto scrollbar-hide">
                        <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">
                          {selectedTaskDetails.description || selectedTaskDetails.instructions}
                        </p>
                      </div>
                    </div>

                    {selectedTaskDetails.videoUrl && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Video Tutorial</h4>
                        <Button 
                          className="w-full bg-[#122B21] text-white hover:bg-black font-black h-16 rounded-2xl flex items-center justify-center gap-3 transition-all"
                          onClick={() => handleWatchVideo(selectedTaskDetails)}
                        >
                          WATCH VIDEO GUIDE
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 font-bold italic mt-2">
                          Clicking will redirect you to the video guide provided by Admin.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedTaskDetails(null)}
                      className="h-14 rounded-2xl font-bold text-slate-400"
                    >
                      Close
                    </Button>
                    {!selectedTaskDetails.isCompleted && (
                      <Button 
                        disabled={isFutureTask(selectedTaskDetails.scheduledDate)}
                        className={`h-14 rounded-2xl font-black shadow-xl uppercase tracking-widest text-[10px] ${
                          isFutureTask(selectedTaskDetails.scheduledDate) ? 'bg-slate-200 text-slate-400' :
                          selectedTaskDetails.isRoadmap ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        onClick={async () => {
                          if (selectedTaskDetails.isRoadmap) {
                            await handleMarkRoadmapDone(selectedTaskDetails.day);
                          } else {
                            try {
                              await updateDoc(doc(db, 'tasks', selectedTaskDetails.id), { status: 'Completed', updatedAt: new Date().toISOString() });
                              toast.success('Task marked as completed');
                            } catch (err) {
                              toast.error('Failed to update task');
                            }
                          }
                          setSelectedTaskDetails(null);
                        }}
                      >
                        {isFutureTask(selectedTaskDetails.scheduledDate) ? 'LOCKED (FUTURE)' : 'Mark as Done'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default AddData;
