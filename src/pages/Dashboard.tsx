import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Users, Package, CreditCard, ArrowUpRight, ArrowDownRight, Pill, ClipboardCheck, Info, Trash2, Bird, Scale, FileText, IndianRupee, Download, ClipboardList, Plus, Bell, AlertTriangle, Egg, Calendar, CheckSquare, ShieldCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import { Link } from 'react-router-dom';
import domtoimage from 'dom-to-image';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import LicenseGuard from '@/src/components/LicenseGuard';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    totalFlocks: 0,
    totalBirds: 0,
    balance: 0,
    feedStock: 0,
    feedStockValue: 0,
    medicineStock: 0,
    medicineStockValue: 0,
  });

  const [activeFlocks, setActiveFlocks] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Calculate final balance including "Healing" logic
  const calculatedBalance = React.useMemo(() => {
    let bal = 0;
    const txDescriptions = new Set();
    transactions.forEach(tx => {
      if (tx.type === 'Income') bal += tx.amount;
      else bal -= tx.amount;
      if (tx.description) txDescriptions.add(tx.description);
    });

    let extraChicksCost = 0;
    activeFlocks.forEach(f => {
      const expectedDesc = `Purchase of ${f.initialCount} birds - ${f.name}`;
      if (f.chicksCost > 0 && !txDescriptions.has(expectedDesc)) {
        extraChicksCost += f.chicksCost;
      }
    });

    return bal - extraChicksCost;
  }, [transactions, activeFlocks]);

  // Sync calculated balance with stats
  useEffect(() => {
    setStats(prev => ({ ...prev, balance: calculatedBalance }));
  }, [calculatedBalance]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [feedStockList, setFeedStockList] = useState<any[]>([]);
  const [medicineStockList, setMedicineStockList] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [logCompliance, setLogCompliance] = useState(0);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showMedModal, setShowMedModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showBirdsModal, setShowBirdsModal] = useState(false);
  const [showActiveFlocksModal, setShowActiveFlocksModal] = useState(false);
  const [showNetBalanceModal, setShowNetBalanceModal] = useState(false);
  const [showBatchReportModal, setShowBatchReportModal] = useState(false);
  const [selectedReportFlock, setSelectedReportFlock] = useState<any>(null);
  const [expandedBatchCost, setExpandedBatchCost] = useState<string | null>(null);
  const [missingLogsByDate, setMissingLogsByDate] = useState<Record<string, any[]>>({});
  const [expandedFeedFlock, setExpandedFeedFlock] = useState<string | null>(null);
  const [expandedMedFlock, setExpandedMedFlock] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [eggLogs, setEggLogs] = useState<any[]>([]);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showEggLogsModal, setShowEggLogsModal] = useState(false);

  const calculateBatchTotalCost = (flock: any) => {
    const flockLogs = dailyLogs.filter(log => log.flockId === flock.id);
    const flockTxs = transactions.filter(t => t.flockId === flock.id);
    
    let feedCost = 0;
    let medCost = 0;

    flockLogs.forEach(log => {
      const intake = Number(log.consumption?.feedIntake) || 0;
      const fType = log.consumption?.feedType;
      if (intake > 0 && fType) {
        const stockItem = feedStockList.find(s => s.type === fType);
        const unitPrice = stockItem?.unitPrice || 
                         (stockItem?.initialQuantity ? (stockItem.purchaseCost / stockItem.initialQuantity) : 
                         (stockItem?.quantity ? (stockItem.purchaseCost / stockItem.quantity) : 0));
        feedCost += intake * unitPrice;
      }

      // Multiple Medicines
      if (Array.isArray(log.health?.medicines)) {
        log.health.medicines.forEach((m: any) => {
          const medDoses = Number(m.doses) || 0;
          if (medDoses > 0 && m.name) {
            const medItem = medicineStockList.find(item => item.name === m.name);
            const unitPrice = medItem?.unitPrice || 
                             (medItem?.initialQuantity ? (medItem.purchaseCost / medItem.initialQuantity) : 
                             (medItem?.quantity ? (medItem.purchaseCost / medItem.quantity) : 0));
            medCost += medDoses * unitPrice;
          }
        });
      } else {
        const mName = log.health?.medicines;
        const mDoses = Number(log.health?.medicineDoses) || 0;
        if (mDoses > 0 && mName && mName !== 'none') {
          const medItem = medicineStockList.find(m => m.name === mName);
          const unitPrice = medItem?.unitPrice || 
                           (medItem?.initialQuantity ? (medItem.purchaseCost / medItem.initialQuantity) : 
                           (medItem?.quantity ? (medItem.purchaseCost / medItem.quantity) : 0));
          medCost += mDoses * unitPrice;
        }
      }

      // Multiple Vaccines
      if (Array.isArray(log.health?.vaccines)) {
        log.health.vaccines.forEach((v: any) => {
          const vacDoses = Number(v.doses) || 0;
          if (vacDoses > 0 && v.name) {
            const vacItem = medicineStockList.find(item => item.name === v.name);
            const unitPrice = vacItem?.unitPrice || 
                             (vacItem?.initialQuantity ? (vacItem.purchaseCost / vacItem.initialQuantity) : 
                             (vacItem?.quantity ? (vacItem.purchaseCost / vacItem.quantity) : 0));
            medCost += vacDoses * unitPrice;
          }
        });
      } else {
        const vName = log.health?.vaccines;
        const vDoses = Number(log.health?.vaccineDoses) || 0;
        if (vDoses > 0 && vName && vName !== 'none') {
          const vacItem = medicineStockList.find(m => m.name === vName);
          const unitPrice = vacItem?.unitPrice || 
                           (vacItem?.initialQuantity ? (vacItem.purchaseCost / vacItem.initialQuantity) : 
                           (vacItem?.quantity ? (vacItem.purchaseCost / vacItem.quantity) : 0));
          medCost += vDoses * unitPrice;
        }
      }
    });

    const otherCost = flockTxs.filter(t => t.type === 'Expense' && !['Feed', 'Medicine', 'Vaccine', 'Chicks'].includes(t.category)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      chicks: Number(flock.chicksCost) || 0,
      feed: feedCost,
      medicine: medCost,
      other: otherCost,
      total: (Number(flock.chicksCost) || 0) + feedCost + medCost + otherCost
    };
  };

  const calculateFlockStockCost = (flockId: string, type: 'feed' | 'medicine') => {
    const flockLogs = dailyLogs.filter(log => log.flockId === flockId);
    let totalCost = 0;
    let totalQty = 0;

    flockLogs.forEach(log => {
      if (type === 'feed') {
        const feedType = log.consumption?.feedType;
        const intake = Number(log.consumption?.feedIntake) || 0;
        if (intake > 0 && feedType) {
          totalQty += intake;
          const stockItem = feedStockList.find(s => s.type === feedType);
          const unitPrice = stockItem?.unitPrice || 
                           (stockItem?.initialQuantity ? (stockItem.purchaseCost / stockItem.initialQuantity) : 
                           (stockItem?.quantity ? (stockItem.purchaseCost / stockItem.quantity) : 0));
          totalCost += intake * unitPrice;
        }
      } else {
        const medName = log.health?.medicines;
        const medDoses = Number(log.health?.medicineDoses) || 0;
        if (medDoses > 0 && medName && medName !== 'none') {
          totalQty += medDoses;
          const medItem = medicineStockList.find(m => m.name === medName);
          const unitPrice = medItem?.unitPrice || 
                           (medItem?.initialQuantity ? (medItem.purchaseCost / medItem.initialQuantity) : 
                           (medItem?.quantity ? (medItem.purchaseCost / medItem.quantity) : 0));
          totalCost += medDoses * unitPrice;
        }
        
        const vacName = log.health?.vaccines;
        const vacDoses = Number(log.health?.vaccineDoses) || 0;
        if (vacDoses > 0 && vacName && vacName !== 'none') {
          totalQty += vacDoses;
          const vacItem = medicineStockList.find(m => m.name === vacName);
          const unitPrice = vacItem?.unitPrice || 
                           (vacItem?.initialQuantity ? (vacItem.purchaseCost / vacItem.initialQuantity) : 
                           (vacItem?.quantity ? (vacItem.purchaseCost / vacItem.quantity) : 0));
          totalCost += vacDoses * unitPrice;
        }
      }
    });

    return { totalCost, totalQty };
  };

  const calculateFeedBreakdown = (flockId: string) => {
    const flockLogs = dailyLogs.filter(log => log.flockId === flockId);
    const breakdown: Record<string, { kg: number, cost: number }> = {};

    flockLogs.forEach(log => {
      const feedType = log.consumption?.feedType;
      const intake = Number(log.consumption?.feedIntake) || 0;
      if (intake > 0 && feedType) {
        if (!breakdown[feedType]) breakdown[feedType] = { kg: 0, cost: 0 };
        breakdown[feedType].kg += intake;
        
        const stockItem = feedStockList.find(s => s.type === feedType);
        const unitPrice = stockItem?.unitPrice || 
                         (stockItem?.initialQuantity ? (stockItem.purchaseCost / stockItem.initialQuantity) : 
                         (stockItem?.quantity ? (stockItem.purchaseCost / stockItem.quantity) : 0));
        breakdown[feedType].cost += intake * unitPrice;
      }
    });

    return Object.entries(breakdown).map(([type, data]) => ({ type, ...data }));
  };

  const calculateMedicineBreakdown = (flockId: string) => {
    const flockLogs = dailyLogs.filter(log => log.flockId === flockId);
    const breakdown: Record<string, { type: string, qty: number, cost: number }> = {};

    flockLogs.forEach(log => {
      // Medicine
      const medName = log.health?.medicines;
      const medDoses = Number(log.health?.medicineDoses) || 0;
      if (medDoses > 0 && medName && medName !== 'none') {
        if (!breakdown[medName]) breakdown[medName] = { type: 'Medicine', qty: 0, cost: 0 };
        breakdown[medName].qty += medDoses;
        const medItem = medicineStockList.find(m => m.name === medName);
        const unitPrice = medItem?.unitPrice || 
                         (medItem?.initialQuantity ? (medItem.purchaseCost / medItem.initialQuantity) : 
                         (medItem?.quantity ? (medItem.purchaseCost / medItem.quantity) : 0));
        breakdown[medName].cost += medDoses * unitPrice;
      }
      
      // Vaccine
      const vacName = log.health?.vaccines;
      const vacDoses = Number(log.health?.vaccineDoses) || 0;
      if (vacDoses > 0 && vacName && vacName !== 'none') {
        if (!breakdown[vacName]) breakdown[vacName] = { type: 'Vaccine', qty: 0, cost: 0 };
        breakdown[vacName].qty += vacDoses;
        const vacItem = medicineStockList.find(m => m.name === vacName);
        const unitPrice = vacItem?.unitPrice || 
                         (vacItem?.initialQuantity ? (vacItem.purchaseCost / vacItem.initialQuantity) : 
                         (vacItem?.quantity ? (vacItem.purchaseCost / vacItem.quantity) : 0));
        breakdown[vacName].cost += vacDoses * unitPrice;
      }
    });

    return Object.entries(breakdown).map(([name, data]) => ({ name, ...data }));
  };

  const calculateProductionCost = (flock: any) => {
    const costs = calculateBatchTotalCost(flock);
    const currentCount = flock.currentCount || flock.initialCount || 1;
    return costs.total / currentCount;
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedReportFlock) return;
    
    const toastId = toast.loading('Brewing your report...');
    
    try {
      // 1. Create a clone and sanitize colors to avoid html2canvas parser crash
      const reportClone = reportRef.current.cloneNode(true) as HTMLElement;
      
      // Clean up buttons and unwanted UI
      reportClone.querySelectorAll('button').forEach(btn => btn.remove());
      
      // EXTREME Color Sanitization: html2canvas CRASHES on oklch()
      const sanitizeOklch = (element: HTMLElement) => {
        const computed = window.getComputedStyle(element);
        const styles = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'];
        
        styles.forEach(prop => {
          const val = (element.style as any)[prop] || computed.getPropertyValue(prop);
          if (val && val.includes('oklch')) {
            // Force fallback to common colors if oklch is detected
            if (prop === 'backgroundColor') (element.style as any)[prop] = '#ffffff';
            else if (prop === 'color') (element.style as any)[prop] = '#1e293b';
            else (element.style as any)[prop] = '#e2e8f0';
          }
        });
        
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
        scale: 2, // High resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8fafc',
        logging: false,
        onclone: (clonedDoc) => {
          // Final safety strike against any remaining oklch in stylesheets
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
      pdf.save(`${selectedReportFlock.name}_Report.pdf`);
      
      document.body.removeChild(wrapper);
      toast.success('Report downloaded!', { id: toastId });
    } catch (error: any) {
      console.error('PDF Error:', error);
      toast.error('PDF Generation failed. Please try again.', { id: toastId });
    }
  };

  useEffect(() => {
    if (!user) return;

    // 1. Listen to flocks
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
    }, (error) => handleFirestoreError(error, OperationType.GET, 'flocks'));

    // 2. Listen to limited recent transactions
    const transactionsQuery = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(5)
    );
    const unsubscribeRecent = onSnapshot(transactionsQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentTransactions(txs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    // 3. Listen to all transactions for balance tracking
    const allTxsQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribeAllTxs = onSnapshot(allTxsQuery, (snapshot) => {
      let bal = 0;
      const txs: any[] = [];
      const txDescriptions = new Set();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        txs.push({ id: doc.id, ...data });
        if (data.type === 'Income') bal += data.amount;
        else bal -= data.amount;
        if (data.description) txDescriptions.add(data.description);
      });
      
      setTransactions(txs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    // 4. Listen to stock
    const qFeed = query(collection(db, 'feedStock'), where('userId', '==', user.uid));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setFeedStockList(list);
      
      const totalQty = list.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalValue = list.reduce((sum, item) => {
          const qty = item.quantity || 0;
          const unitPrice = item.unitPrice || (item.initialQuantity ? (item.purchaseCost / item.initialQuantity) : 0);
          return sum + (qty * unitPrice);
      }, 0);
      
      setStats(prev => ({ 
          ...prev, 
          feedStock: totalQty,
          feedStockValue: totalValue
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const qMed = query(collection(db, 'medicineStock'), where('userId', '==', user.uid));
    const unsubMed = onSnapshot(qMed, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMedicineStockList(list);
      
      const availableCount = list.filter(item => (item.quantity || 0) > 0).length;
      const totalValue = list.reduce((sum, item) => {
          const qty = item.quantity || 0;
          const unitPrice = item.unitPrice || (item.initialQuantity ? (item.purchaseCost / item.initialQuantity) : 0);
          return sum + (qty * unitPrice);
      }, 0);
      
      setStats(prev => ({ 
          ...prev, 
          medicineStock: availableCount,
          medicineStockValue: totalValue
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    // 5. Listen to daily logs
    const qLogs = query(collection(db, 'dailyLogs'), where('userId', '==', user.uid));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDailyLogs(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'dailyLogs'));

    // 6. Listen to system alerts
    const alertsQuery = query(collection(db, 'systemAlerts'), orderBy('createdAt', 'desc'), limit(10));
    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const allAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setSystemAlerts(allAlerts);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'systemAlerts'));

    // 7. Listen to tasks
    const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (a.scheduledDate || '').localeCompare(b.scheduledDate || '')));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'tasks'));

    return () => {
      unsubscribeFlocks();
      unsubscribeRecent();
      unsubscribeAllTxs();
      unsubFeed();
      unsubMed();
      unsubLogs();
      unsubAlerts();
      unsubTasks();
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

    // Calculate missing logs by date
    const missing: Record<string, any[]> = {};
    activeFlocks.forEach(flock => {
      if (flock.placementDate) {
        const startDate = new Date(flock.placementDate);
        const dayCount = differenceInDays(today, startDate);
        for (let i = 0; i <= dayCount; i++) {
          const checkDate = new Date(startDate);
          checkDate.setDate(startDate.getDate() + i);
          const dateStr = format(checkDate, 'yyyy-MM-dd');
          
          const hasLog = dailyLogs.some(log => log.flockId === flock.id && log.date === dateStr);
          if (!hasLog) {
            if (!missing[dateStr]) missing[dateStr] = [];
            missing[dateStr].push(flock);
          }
        }
      }
    });
    setMissingLogsByDate(missing);
  }, [activeFlocks, dailyLogs]);

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick }: any) => (
    <Card 
      className={`border-none shadow-sm overflow-hidden group h-full ${onClick ? 'cursor-pointer hover:shadow-md transition-all active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <div className={`${color} p-2.5 rounded-2xl text-white shadow-lg shadow-current/20`}>
            <Icon size={20} />
          </div>
          {onClick && <Info size={14} className="text-slate-300 group-hover:text-slate-400" />}
        </div>
        
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex flex-col">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">{value}</h3>
            {subtitle && (
              <p className="text-[10px] font-bold text-slate-600 mt-1 bg-slate-100/80 px-2 py-0.5 rounded-lg inline-block self-start">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
        {/* Feed Stock Modal - Updated to show INVENTORY */}
      <Dialog open={showFeedModal} onOpenChange={setShowFeedModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="text-amber-600" />
              Available Feed Inventory
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feed Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Available Quantity Cost (Bal)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedStockList.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-none font-bold text-[10px]">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-600">{item.quantity?.toLocaleString()} kg</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      ₹{((item.quantity || 0) * (item.unitPrice || (item.initialQuantity ? item.purchaseCost / item.initialQuantity : 0))).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {feedStockList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 py-12">
                      <Package size={40} className="mx-auto mb-2 opacity-20" />
                      No feed items in stock
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Medicine Stock Modal - Updated to show INVENTORY */}
      <Dialog open={showMedModal} onOpenChange={setShowMedModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="text-indigo-600" />
              Available Medicine & Vaccines
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Available Quantity Cost (Bal)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicineStockList.map(item => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${item.type === 'Vaccine' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'} border-none font-bold text-[10px]`}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-600">{item.quantity?.toLocaleString()} {item.unit || 'units'}</TableCell>
                    <TableCell className="text-right font-bold text-indigo-600">
                      ₹{((item.quantity || 0) * (item.unitPrice || (item.initialQuantity ? item.purchaseCost / item.initialQuantity : 0))).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {medicineStockList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 py-12">
                      <Pill size={40} className="mx-auto mb-2 opacity-20" />
                      No medicine items in stock
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Flocks Modal */}
      <Dialog open={showActiveFlocksModal} onOpenChange={setShowActiveFlocksModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="text-blue-600" />
              Running Flocks Information
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {activeFlocks.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No running flocks found</p>
            ) : (
              activeFlocks.map(flock => (
                <Card key={flock.id} className="border border-slate-100 shadow-none rounded-2xl overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900">{flock.name}</h4>
                        <p className="text-xs text-slate-500">{flock.breed} • Placed on {flock.placementDate}</p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 border-none">Active</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-2 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Birds</p>
                        <p className="text-sm font-bold text-slate-800">{flock.currentCount.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Age</p>
                        <p className="text-sm font-bold text-slate-800">{differenceInDays(new Date(), new Date(flock.placementDate)) + 1} Days</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Mortality</p>
                        <p className="text-sm font-bold text-red-600">{flock.totalMortality || 0}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl text-center">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">FCR</p>
                        <p className="text-sm font-bold text-emerald-600">{flock.currentFCR || '--'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Net Balance Modal */}
      <Dialog open={showNetBalanceModal} onOpenChange={setShowNetBalanceModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="text-orange-600" />
              Batch-wise Cost & Balance
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-4">
              <p className="text-xs font-bold text-orange-600 uppercase mb-1">Total Net Balance</p>
              <h3 className="text-3xl font-bold text-orange-700">₹{stats.balance.toLocaleString()}</h3>
            </div>

            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Active Batch Costs</h4>
            {activeFlocks.map(flock => {
              const costs = calculateBatchTotalCost(flock);
              const isExpanded = expandedBatchCost === flock.id;

              return (
                <div key={flock.id} className="space-y-2">
                  <div 
                    className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center cursor-pointer hover:border-slate-300 transition-colors"
                    onClick={() => setExpandedBatchCost(isExpanded ? null : flock.id)}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{flock.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Breed: {flock.breed}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">₹{costs.total.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Total Cost</p>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mx-4 p-4 bg-slate-50 rounded-2xl border-x border-b border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spending Breakdown</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-xs font-medium text-slate-600">Chick Cost</span>
                          <span className="text-sm font-bold text-slate-900">₹{costs.chicks.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-xs font-medium text-slate-600">Feed Consumption</span>
                          <span className="text-sm font-bold text-slate-900">₹{costs.feed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-xs font-medium text-slate-600">Medicine & Vaccines</span>
                          <span className="text-sm font-bold text-slate-900">₹{costs.medicine.toLocaleString()}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-900">Total Investment</span>
                          <span className="text-sm font-extra-bold text-orange-600">₹{costs.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upcoming Schedule / Tasks Modal */}
      <Dialog open={showTasksModal} onOpenChange={setShowTasksModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto p-0 border-none overflow-hidden">
          <div className="bg-sky-600 p-8 text-white relative">
            <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
              <Calendar />
              Upcoming Schedule
            </h2>
            <p className="text-sky-100 font-bold text-xs uppercase tracking-widest">Tasks, Vaccinations & Plans</p>
            <div className="absolute top-8 right-8 bg-sky-500/30 p-4 rounded-3xl backdrop-blur-md border border-sky-400/30">
              <ClipboardCheck size={40} className="text-sky-200 opacity-50" />
            </div>
          </div>
          <div className="p-8 space-y-6 bg-slate-50">
            {tasks.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <CheckSquare size={50} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold">No tasks scheduled</p>
                <p className="text-xs">Your schedule is currently clear</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(task => (
                  <Card key={task.id} className="border-none shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-4">
                          <div className={`p-3 rounded-2xl ${
                            task.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {task.category === 'Vaccination' ? <ShieldCheck size={20} /> : <ClipboardList size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                                <h4 className={`font-black text-slate-900 ${task.status === 'Completed' ? 'line-through opacity-50' : ''}`}>
                                  {task.title}
                                </h4>
                                <Badge className={`text-[8px] uppercase font-bold border-none ${
                                    task.category === 'Vaccination' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                    {task.category}
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">{task.description}</p>
                            <div className="flex items-center gap-3 mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <span className="flex items-center gap-1"><Calendar size={12}/> {task.scheduledDate}</span>
                                {task.creatorType && <span className="flex items-center gap-1">• From {task.creatorType}</span>}
                            </div>
                          </div>
                        </div>
                        {task.status !== 'Completed' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold text-[10px]"
                            onClick={async () => {
                                try {
                                    await updateDoc(doc(db, 'tasks', task.id), { status: 'Completed', updatedAt: new Date().toISOString() });
                                    toast.success('Task marked as completed');
                                } catch (err) {
                                    toast.error('Failed to update task');
                                }
                            }}
                          >
                            COMPLETE
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Egg Production & Cost Modal */}
      <Dialog open={showEggLogsModal} onOpenChange={setShowEggLogsModal}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
           <div className="bg-amber-500 p-6 sm:p-8 text-white relative">
             <h2 className="text-xl sm:text-2xl font-black mb-1 flex items-center gap-2">
               <Egg />
               Egg Production & Cost Analysis
             </h2>
             <p className="text-amber-100 font-bold text-[10px] sm:text-xs uppercase tracking-widest">7-Day Performance Overview</p>
           </div>
           
           <div className="p-4 sm:p-8 bg-slate-50 space-y-6 sm:space-y-8">
              {(() => {
                const layerLogs = dailyLogs
                  .filter(l => Number(l.production?.eggCount) > 0)
                  .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                  .slice(0, 7)
                  .map(log => {
                    const intake = Number(log.consumption?.feedIntake) || 0;
                    const fType = log.consumption?.feedType;
                    let feedCost = 0;
                    if (intake > 0 && fType) {
                      const stock = feedStockList.find(s => s.type === fType);
                      const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                      feedCost = intake * unitPrice;
                    }

                    let medCost = 0;
                    if (Array.isArray(log.health?.medicines)) {
                      log.health.medicines.forEach((m: any) => {
                        const doses = Number(m.doses) || 0;
                        if (doses > 0 && m.name) {
                          const stock = medicineStockList.find(s => s.name === m.name);
                          const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                          medCost += doses * unitPrice;
                        }
                      });
                    }
                    if (Array.isArray(log.health?.vaccines)) {
                      log.health.vaccines.forEach((v: any) => {
                        const doses = Number(v.doses) || 0;
                        if (doses > 0 && v.name) {
                          const stock = medicineStockList.find(s => s.name === v.name);
                          const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                          medCost += doses * unitPrice;
                        }
                      });
                    }

                    const labour = Number(log.production?.labourCost) || 0;
                    const totalCost = feedCost + medCost + labour;
                    const goodEggs = Number(log.production?.goodEggs) || 0;
                    
                    return {
                      ...log,
                      dailyCost: totalCost,
                      costPerEgg: goodEggs > 0 ? totalCost / goodEggs : 0,
                      totalEggs: Number(log.production?.eggCount) || 0,
                      goodEggs,
                      badEggs: Number(log.production?.badEggs) || 0
                    };
                  });

                if (layerLogs.length === 0) {
                  return (
                    <div className="text-center py-20 text-slate-400">
                      <Egg size={50} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold">No egg logs found</p>
                      <p className="text-xs">Start logging daily egg collection to see analytics</p>
                    </div>
                  );
                }

                const avg7DayEggs = Math.round(layerLogs.reduce((sum, l) => sum + l.totalEggs, 0) / layerLogs.length);
                const avg7DayCostPerEgg = layerLogs.reduce((sum, l) => sum + l.costPerEgg, 0) / layerLogs.length;

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white overflow-hidden relative group">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg 7-Day Eggs</p>
                         <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{avg7DayEggs}</h3>
                         <TrendingUp size={40} className="absolute -right-2 -bottom-2 text-emerald-50 opacity-10 group-hover:scale-110 transition-transform" />
                      </Card>
                      <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white overflow-hidden relative group">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost Per Egg (Avg)</p>
                         <h3 className="text-xl sm:text-2xl font-black text-amber-600 leading-none">₹{avg7DayCostPerEgg.toFixed(2)}</h3>
                      </Card>
                      <Card className="border-none shadow-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white overflow-hidden relative group">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Laying Rate</p>
                         <h3 className="text-xl sm:text-2xl font-black text-indigo-600 leading-none">
                           {(() => {
                              const latest = layerLogs[0];
                              const birds = Number(latest?.production?.birdCount) || stats.totalBirds || 1;
                              return Math.round((latest.totalEggs / birds) * 100);
                           })()}%
                         </h3>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest px-2">Daily Collection Records</h4>
                      <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-100 overflow-x-auto">
                         <Table>
                           <TableHeader className="bg-slate-50/50">
                             <TableRow className="border-slate-100">
                               <TableHead className="text-[9px] font-black uppercase tracking-widest min-w-[80px]">Date</TableHead>
                               <TableHead className="text-[9px] font-black uppercase tracking-widest text-center min-w-[100px]">Eggs (G/B)</TableHead>
                               <TableHead className="text-[9px] font-black uppercase tracking-widest text-right min-w-[80px]">Daily Cost</TableHead>
                               <TableHead className="text-[9px] font-black uppercase tracking-widest text-right min-w-[80px]">Cost/Egg</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {layerLogs.map(log => (
                               <TableRow key={log.id} className="border-slate-50">
                                 <TableCell className="font-bold text-slate-700 text-[11px] sm:text-xs">{log.date}</TableCell>
                                 <TableCell className="text-center font-bold text-slate-900 text-[11px] sm:text-xs">
                                   {log.totalEggs} <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">({log.goodEggs}/{log.badEggs})</span>
                                 </TableCell>
                                 <TableCell className="text-right font-bold text-slate-600 text-[11px] sm:text-xs">₹{log.dailyCost.toFixed(0)}</TableCell>
                                 <TableCell className="text-right px-4 sm:px-6">
                                   <Badge className={`${log.costPerEgg < 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} border-none font-bold text-[10px]`}>
                                     ₹{log.costPerEgg.toFixed(2)}
                                   </Badge>
                                 </TableCell>
                               </TableRow>
                             ))}
                           </TableBody>
                         </Table>
                      </div>
                    </div>
                  </>
                );
              })()}
           </div>
        </DialogContent>
      </Dialog>

      <header className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Farm Overview</h1>
          <p className="text-slate-500">Welcome back, {profile?.name || 'Farmer'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/add?tab=alerts" className="hidden sm:block">
            <Button variant="outline" className="border-red-100 text-red-600 hover:bg-red-50 rounded-xl h-10 px-4 font-bold gap-2">
              <AlertTriangle size={18} />
              <span>Safety Alerts</span>
            </Button>
          </Link>
          <Link to="/add?tab=alerts" className="sm:hidden block p-2 bg-red-50 rounded-xl border border-red-100">
             <AlertTriangle size={20} className="text-red-500" />
          </Link>
          <Link to="/notifications" className="relative p-2 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
            <Bell size={20} className="text-slate-600" />
            {systemAlerts.some(a => (a.active !== false) && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)) && (
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </Link>
        </div>
      </header>

      {/* System Alerts Summary Banner */}
      {systemAlerts.some(a => {
        const isActive = a.active !== false;
        const isUnviewed = a.viewedBy ? !a.viewedBy.includes(user?.uid) : true;
        const isTargetMatch = a.userId 
          ? (a.userId === user?.uid) 
          : (a.target === 'All' || a.target === profile?.farmType);
        return isActive && isUnviewed && isTargetMatch;
      }) && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between gap-4 relative overflow-hidden group ${
              systemAlerts.some(a => {
                const isActive = a.active !== false;
                const isUnviewed = a.viewedBy ? !a.viewedBy.includes(user?.uid) : true;
                const isTargetMatch = a.userId 
                  ? (a.userId === user?.uid) 
                  : (a.target === 'All' || a.target === profile?.farmType);
                return isActive && isUnviewed && isTargetMatch && a.priority === 'High';
              }) 
                ? 'bg-red-50 border-red-100' 
                : 'bg-blue-50 border-blue-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${
                systemAlerts.some(a => a.active !== false && a.priority === 'High' && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)) ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                <Bell size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${
                  systemAlerts.some(a => a.active !== false && a.priority === 'High' && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)) ? 'text-red-900' : 'text-blue-900'
                }`}>
                  System Notifications
                </h3>
                <p className="text-xs text-slate-600">
                  You have {systemAlerts.filter(a => a.active !== false && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)).length} active alert(s) needing your attention.
                </p>
              </div>
            </div>
            
            <Link to="/notifications">
              <Button size="sm" className={`rounded-xl px-6 font-bold shadow-sm ${
                systemAlerts.some(a => a.active !== false && a.priority === 'High' && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)) 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
                View
              </Button>
            </Link>
          </motion.div>
        </AnimatePresence>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Logs" 
            value={`${logCompliance}%`} 
            icon={ClipboardCheck} 
            color="bg-indigo-600"
            subtitle="Compliance"
            onClick={() => setShowLogsModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Total Birds" 
            value={stats.totalBirds.toLocaleString()} 
            icon={Users} 
            color="bg-emerald-500"
            subtitle={`${Math.max(0, (profile?.birdCapacity || 0) - stats.totalBirds).toLocaleString()} Free`}
            onClick={() => setShowBirdsModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Active Flocks" 
            value={stats.totalFlocks} 
            icon={Package} 
            color="bg-blue-500"
            subtitle="Running Batches"
            onClick={() => setShowActiveFlocksModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Net Balance" 
            value={`₹${stats.balance.toLocaleString()}`} 
            icon={CreditCard} 
            color="bg-orange-500"
            subtitle="P/L Summary"
            onClick={() => setShowNetBalanceModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Feed Stock" 
            value={`${stats.feedStock.toLocaleString()} kg`} 
            icon={Package} 
            color="bg-amber-600"
            subtitle={`Cost: ₹${stats.feedStockValue.toLocaleString()}`}
            onClick={() => setShowFeedModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Medicine Stock" 
            value={`${stats.medicineStock} Items`} 
            icon={Pill} 
            color="bg-indigo-600"
            subtitle={`Cost: ₹${stats.medicineStockValue.toLocaleString()}`}
            onClick={() => setShowMedModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Upcoming Schedule" 
            value={tasks.filter(t => t.status !== 'Completed').length} 
            icon={Calendar} 
            color="bg-sky-600"
            subtitle="Tasks & Plans"
            onClick={() => setShowTasksModal(true)}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Eggs" 
            value={(() => {
              const layerLogs = dailyLogs.filter(l => Number(l.production?.eggCount) > 0);
              return layerLogs[0]?.production?.eggCount || 0;
            })()} 
            icon={Egg} 
            color="bg-amber-500"
            subtitle="Daily Collection"
            onClick={() => setShowEggLogsModal(true)}
          />
        </LicenseGuard>
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
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase">Cost / Bird</p>
                          <p className="text-sm font-bold text-emerald-600">
                            ₹{calculateProductionCost(flock).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase">Cost / KG</p>
                          <p className="text-sm font-bold text-indigo-600">
                            ₹{(() => {
                              const costPerBird = calculateProductionCost(flock);
                              const weightInKg = (flock.currentWeight || flock.initialAvgWeight || 0) / 1000;
                              return weightInKg > 0 ? (costPerBird / weightInKg).toFixed(2) : '0.00';
                            })()}
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

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-4 text-emerald-600 font-bold hover:text-emerald-700 hover:bg-emerald-50 rounded-xl flex items-center gap-2"
                        onClick={() => {
                          setSelectedReportFlock(flock);
                          setShowBatchReportModal(true);
                        }}
                      >
                        <ClipboardCheck size={14} />
                        View Full Report
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Detailed Batch Report Modal */}
          <Dialog open={showBatchReportModal} onOpenChange={setShowBatchReportModal}>
            <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto rounded-3xl p-0 border-none">
              {selectedReportFlock && (() => {
                const costs = calculateBatchTotalCost(selectedReportFlock);
                const days = differenceInDays(new Date(), new Date(selectedReportFlock.placementDate)) + 1;
                const mortalityRate = selectedReportFlock.initialCount > 0 ? ((selectedReportFlock.totalMortality || 0) / selectedReportFlock.initialCount * 100).toFixed(2) : 0;
                
                const feedBreakdown = calculateFeedBreakdown(selectedReportFlock.id);
                const healthBreakdown = calculateMedicineBreakdown(selectedReportFlock.id);
                
                const totalFeedConsumed = feedBreakdown.reduce((sum, f) => sum + f.kg, 0);
                const weightInKg = (selectedReportFlock.currentWeight || selectedReportFlock.initialAvgWeight || 0) / 1000;
                const totalBiomass = weightInKg * (selectedReportFlock.currentCount || 0);
                const fcr = totalBiomass > 0 ? (totalFeedConsumed / totalBiomass).toFixed(2) : '0.00';

                return (
                  <div className="bg-slate-50 min-h-full flex flex-col">
                    <div ref={reportRef} className="flex-1">
                      <div className="p-6 bg-white border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <ClipboardList className="text-emerald-600" />
                            Batch Performance Report
                          </h2>
                          <p className="text-sm text-slate-500 font-medium uppercase tracking-tight">{selectedReportFlock.name} • {selectedReportFlock.breed}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setShowBatchReportModal(false)} className="rounded-full">
                          <Plus className="rotate-45" size={24} />
                        </Button>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Highlights Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* 1. Total Birds */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Birds</p>
                            <p className="text-lg font-black text-slate-900">{selectedReportFlock.initialCount}</p>
                            <p className="text-[10px] text-red-500 font-bold mt-0.5 tracking-tight">{selectedReportFlock.totalMortality || 0} Deaths ({mortalityRate}%)</p>
                          </div>

                          {/* 2. Total Feed */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Feed Used</p>
                            <p className="text-lg font-black text-slate-900">{totalFeedConsumed.toLocaleString()} kg</p>
                            <p className="text-[10px] text-amber-600 font-bold mt-0.5 tracking-tight">Cumulative Intake</p>
                          </div>

                          {/* 3. Avg Weight & Age */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Weight</p>
                            <p className="text-lg font-black text-slate-900">{selectedReportFlock.currentWeight || selectedReportFlock.initialAvgWeight || 0} g</p>
                            <p className="text-[10px] text-blue-600 font-bold mt-0.5 tracking-tight">Age: {days} Days</p>
                          </div>

                          {/* 4. Real-time Costing */}
                          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Prod. Cost / Bird</p>
                            <p className="text-lg font-black text-emerald-700">₹{calculateProductionCost(selectedReportFlock).toFixed(2)}</p>
                            <p className="text-[10px] text-emerald-500 font-bold mt-0.5 tracking-tight">Based on consumption</p>
                          </div>

                          {/* 5. FCR (Feed Conversion Ratio) */}
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">FCR (Efficiency)</p>
                            <p className="text-lg font-black text-emerald-600">{fcr}</p>
                            <p className="text-[9px] text-slate-500 font-bold mt-0.5 italic">
                              {Number(fcr) <= 1.6 ? 'EXCELLENT' : 'OPTIMIZATION NEEDED'}
                            </p>
                          </div>

                          {/* 6. Target Costing / Bird */}
                          {(() => {
                            const target = Number(selectedReportFlock.liftingStrategy?.targetCosting) || 0;
                            const current = calculateProductionCost(selectedReportFlock);
                            const isOnTrack = target === 0 || current <= target;
                            return (
                              <div className={`p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md ${isOnTrack ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-red-50/50 border-red-100/50'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isOnTrack ? 'text-emerald-600' : 'text-red-500'}`}>Target Cost / Bird</p>
                                <p className={`text-lg font-black ${isOnTrack ? 'text-emerald-700' : 'text-red-700'}`}>₹{target || '--'}</p>
                                <p className={`text-[10px] font-bold mt-0.5 tracking-tight ${isOnTrack ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {target > 0 ? (isOnTrack ? 'UNDER TARGET' : 'ABOVE TARGET') : 'NOT SET'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* 7. Remaining Days */}
                          {(() => {
                            const liftingDateStr = selectedReportFlock.liftingStrategy?.scheduledDate;
                            const remainingDays = liftingDateStr ? differenceInDays(new Date(liftingDateStr), new Date()) : null;
                            return (
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lifting Countdown</p>
                                <p className="text-lg font-black text-slate-900">
                                  {remainingDays !== null 
                                    ? (remainingDays > 0 ? `${remainingDays} Days Left` : (remainingDays === 0 ? 'Lifting Today' : `${Math.abs(remainingDays)} Days Overdue`)) 
                                    : '--'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5 tracking-tight uppercase">
                                  {liftingDateStr ? format(new Date(liftingDateStr), 'dd MMM yyyy') : 'NOT SCHEDULED'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* 8. Lifting Rate (Market Rate) */}
                          <Dialog>
                            <DialogTrigger nativeButton={false} render={
                              <button className="w-full text-left bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-slate-50 group">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Market Rate (Lifting)</p>
                                <p className="text-lg font-black text-indigo-600">₹{selectedReportFlock.liftingStrategy?.liftingRate || '--'}</p>
                                <div className="flex items-center justify-between mt-0.5">
                                  <p className="text-[10px] text-indigo-400 font-bold tracking-tight uppercase">View Rates</p>
                                  <Info size={10} className="text-indigo-300 group-hover:text-indigo-500 transition-colors" />
                                </div>
                              </button>
                            } />
                            <DialogContent className="rounded-[2rem] sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-2xl font-black italic">Sales Strategy Rates</DialogTitle>
                                <DialogDescription>Lifting rates set by the manager for this batch</DialogDescription>
                              </DialogHeader>
                              <div className="py-6 space-y-4">
                                <div className="p-5 bg-slate-900 text-white rounded-3xl">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Base Rate</p>
                                  <p className="text-4xl font-black italic">₹{selectedReportFlock.liftingStrategy?.liftingRate || '--'}<span className="text-lg font-normal text-slate-500 non-italic">/kg</span></p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Male Rate</p>
                                    <p className="text-xl font-black text-blue-700">₹{selectedReportFlock.liftingStrategy?.maleRate || '--'}</p>
                                  </div>
                                  <div className="p-4 bg-pink-50 rounded-2xl border border-pink-100">
                                    <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-1">Female Rate</p>
                                    <p className="text-xl font-black text-pink-700">₹{selectedReportFlock.liftingStrategy?.femaleRate || '--'}</p>
                                  </div>
                                </div>
                                {selectedReportFlock.liftingStrategy?.notes && (
                                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Strategy Notes</p>
                                    <p className="text-sm text-amber-900 font-medium">{selectedReportFlock.liftingStrategy.notes}</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>

                        {/* Financial Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                            <CardHeader className="border-b border-slate-50 py-4 font-black text-xs uppercase tracking-widest flex-row items-center gap-2">
                                <IndianRupee size={16} className="text-emerald-700" />
                                Expense Breakdown
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Chicks Cost</span>
                                <span className="font-bold text-slate-700 underline underline-offset-4 decoration-slate-200">₹{costs.chicks.toLocaleString()}</span>
                              </div>

                              {/* Detailed Feed Breakdown */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Feed Breakdown</p>
                                {feedBreakdown.map(f => (
                                  <div key={f.type} className="flex justify-between items-center text-xs bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                    <span className="text-slate-600 font-bold tracking-tight">{f.type} ({f.kg} kg)</span>
                                    <span className="font-black text-slate-900">₹{f.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                  </div>
                                ))}
                                {feedBreakdown.length === 0 && (
                                  <p className="text-[10px] italic text-slate-400 pl-1 p-2">No feed records linked to batch</p>
                                )}
                                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                                  <span className="text-slate-500 font-bold">Total Feed Cost</span>
                                  <span className="font-black text-slate-900">₹{costs.feed.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Detailed Health Breakdown */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Medicine & Vaccine Breakdown</p>
                                {healthBreakdown.map(m => (
                                  <div key={m.name} className="flex justify-between items-center text-xs bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                    <span className="text-slate-600 font-bold tracking-tight">{m.name} ({m.qty} doses/units)</span>
                                    <span className="font-black text-slate-900">₹{m.cost.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                                  </div>
                                ))}
                                {healthBreakdown.length === 0 && (
                                  <p className="text-[10px] italic text-slate-400 pl-1 p-2">No health records linked to batch</p>
                                )}
                                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                                  <span className="text-slate-500 font-bold">Total Med Cost</span>
                                  <span className="font-black text-slate-900">₹{costs.medicine.toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Other Expenses</span>
                                <span className="font-bold text-slate-700 tracking-tight">₹{costs.other.toLocaleString()}</span>
                              </div>
                              <div className="pt-3 border-t border-slate-100 flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl mt-4 shadow-lg shadow-slate-200">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Expenses</p>
                                  <p className="text-2xl font-black italic">₹{costs.total.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cost / Bird</p>
                                  <p className="text-lg font-black text-emerald-400">₹{calculateProductionCost(selectedReportFlock).toFixed(2)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <div className="space-y-6">
                            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                              <CardHeader className="border-b border-slate-50 py-4 font-black text-xs uppercase tracking-widest flex-row items-center gap-2">
                                  <Scale size={16} className="text-blue-500" />
                                  Performance KPIs
                              </CardHeader>
                              <CardContent className="p-4 space-y-6">
                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Feed Conversion Ratio</p>
                                  <p className="text-4xl font-black text-slate-900">{fcr}</p>
                                  <p className="text-[9px] text-slate-500 font-bold mt-1 italic">Efficiency: {Number(fcr) < 1.6 ? 'EXCELLENT' : 'OPTIMIZATION NEEDED'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Livability Rate</p>
                                    <p className="text-xl font-black text-slate-900">{(100 - Number(mortalityRate)).toFixed(1)}%</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Intake</p>
                                    <p className="text-xl font-black text-slate-900">
                                      {days > 0 ? ((totalFeedConsumed / days) / selectedReportFlock.initialCount * 1000).toFixed(1) : '0'}g
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <div className="p-6 bg-[#122B21] text-white rounded-[2rem] shadow-xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Bird size={100} />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp size={16} className="text-emerald-400" />
                                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">Current Valuation</p>
                                    </div>
                                    <h4 className="text-4xl font-black italic tracking-tighter">₹{costs.total.toLocaleString()}</h4>
                                    <p className="text-[10px] text-emerald-400 mt-2 font-bold uppercase tracking-wider">Asset value of running batch</p>
                                </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pb-8 sticky bottom-0 bg-white/90 backdrop-blur-md p-6 border-t border-slate-100 z-20">
                      <Button 
                        variant="default" 
                        className="rounded-2xl px-12 py-7 bg-[#122B21] hover:bg-[#1a3d2e] shadow-2xl shadow-emerald-950/20 flex items-center gap-3 font-black text-base transition-all active:scale-95 text-white"
                        onClick={handleDownloadPDF}
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

          {/* Recent Transactions Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-slate-900">Recent Transactions</h2>
              <LicenseGuard mode="interaction">
                <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hover:text-indigo-700 font-bold p-0">View All</Button>
              </LicenseGuard>
            </div>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-slate-400 border border-dashed border-slate-200">
                  No transactions yet
                </div>
              ) : (
                recentTransactions.map((tx) => (
                  <LicenseGuard key={tx.id} mode="interaction">
                    <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50 cursor-pointer hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${tx.type === 'Income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === 'Income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{tx.description}</p>
                          <p className="text-xs text-slate-400">
                            {(() => {
                              if (!tx.date) return '';
                              try {
                                const d = new Date(tx.date);
                                return isNaN(d.getTime()) ? '' : format(d, 'MMM dd, yyyy');
                              } catch (e) {
                                return '';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <p className={`font-bold ${tx.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.type === 'Income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                      </p>
                    </div>
                  </LicenseGuard>
                ))
              )}
            </div>
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

      {/* Missing Logs Modal */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="text-indigo-600" />
              Missing Records Analysis
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {Object.keys(missingLogsByDate).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-emerald-600 font-bold">All logs are up to date! Great job.</p>
              </div>
            ) : (
              Object.entries(missingLogsByDate)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([date, flocks]: [string, any[]]) => (
                  <div key={date} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-bold text-slate-900">
                        {(() => {
                          try {
                            const d = new Date(date);
                            return isNaN(d.getTime()) ? date : format(d, 'MMMM dd, yyyy');
                          } catch (e) {
                            return date;
                          }
                        })()}
                      </p>
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-lg uppercase">
                        {flocks.length} Missing
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {flocks.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-sm font-bold text-slate-700">{f.name}</span>
                          <span className="text-xs text-slate-500">{f.breed}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bird Stock & Capacity Modal */}
      <Dialog open={showBirdsModal} onOpenChange={setShowBirdsModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="text-emerald-600" />
              Bird Stock & Farm Capacity
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-2xl font-bold text-slate-900">{stats.totalBirds.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Currently Alive</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-2xl font-bold text-emerald-700">
                  {Math.max(0, (profile?.birdCapacity || 0) - stats.totalBirds).toLocaleString()}
                </p>
                <p className="text-[10px] font-bold text-emerald-600/60 uppercase">Available Capacity</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Batch Breakdown</p>
              <div className="space-y-2">
                {activeFlocks.map(flock => (
                  <div key={flock.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{flock.name}</p>
                      <p className="text-xs text-slate-500">Breed: {flock.breed}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{flock.currentCount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Placed: {flock.initialCount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {activeFlocks.length === 0 && (
                  <p className="text-center py-4 text-slate-400 text-sm italic">No active batches</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase">Total Farm Capacity</span>
                <span className="font-bold">{profile?.birdCapacity?.toLocaleString() || 0}</span>
              </div>
              <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats.totalBirds / (profile?.birdCapacity || 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
