import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, deleteDoc } from 'firebase/firestore';
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
import { Link, useNavigate } from 'react-router-dom';
import domtoimage from 'dom-to-image';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import LicenseGuard from '@/src/components/LicenseGuard';
import LoginModal from '@/src/components/LoginModal';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
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
  const [eggSales, setEggSales] = useState<any[]>([]);
  const [farmerSchedule, setFarmerSchedule] = useState<any | null>(null);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEggLogsModal, setShowEggLogsModal] = useState(false);

  const [selectedTaskDetails, setSelectedTaskDetails] = useState<any | null>(null);

  const getRemainingDaysLabel = (targetDate: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    const diff = differenceInDays(target, today);
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1) return `In ${diff} days`;
    if (diff < -1) return `${Math.abs(diff)} days ago`;
    return format(target, 'MMM dd');
  };

  const isFutureTask = (targetDate: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    return target > today;
  };

  const checkAccess = (action: () => void) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    action();
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
        toast.success('Roadmap milestone marked as completed');
        // If the modal is open for this task, update it
        if (selectedTaskDetails && selectedTaskDetails.day === day) {
          setSelectedTaskDetails(prev => ({ ...prev, isCompleted: true }));
        }
      }
    } catch (err) {
      toast.error('Failed to update schedule');
    }
  };

  const handleWatchVideo = async (task: any) => {
    if (!farmerSchedule || !task.videoUrl) return;
    
    // Open the video link
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

  const handleDeleteEggLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;
    try {
      await deleteDoc(doc(db, 'eggLogs', id));
      toast.success('Log deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'eggLogs');
      toast.error('Failed to delete log');
    }
  };

  const handleDeleteDailyLog = async (id: string, log: any) => {
    if (!window.confirm('Are you sure you want to delete this production record? This will zero out the production in the daily log.')) return;
    try {
      await updateDoc(doc(db, 'dailyLogs', id), {
        production: {
          ...log.production,
          eggCount: 0,
          goodEggs: 0,
          badEggs: 0,
          labourCost: 0
        }
      });
      toast.success('Production record removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'dailyLogs');
      toast.error('Failed to remove record');
    }
  };

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

    const qEggLogs = query(collection(db, 'eggLogs'), where('userId', '==', user.uid));
    const unsubEggLogs = onSnapshot(qEggLogs, (snapshot) => {
      setEggLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggLogs'));

    const qEggSales = query(collection(db, 'eggSales'), where('userId', '==', user.uid));
    const unsubEggSales = onSnapshot(qEggSales, (snapshot) => {
      setEggSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'eggSales'));

    // 8. Listen to Farmer Schedule
    const qSchedule = query(collection(db, 'schedules'), where('userId', '==', user.uid));
    const unsubSchedule = onSnapshot(qSchedule, async (snap) => {
      if (!snap.empty) {
        const scheduleData = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        // Fetch Template to get actual tasks
        const templateId = scheduleData.templateId;
        onSnapshot(doc(db, 'scheduleTemplates', templateId), (tSnap) => {
           if (tSnap.exists()) {
             setFarmerSchedule({ ...scheduleData, template: tSnap.data() });
           }
        });
      } else {
        setFarmerSchedule(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'schedules'));

    return () => {
      unsubscribeFlocks();
      unsubscribeRecent();
      unsubscribeAllTxs();
      unsubFeed();
      unsubMed();
      unsubLogs();
      unsubEggLogs();
      unsubEggSales();
      unsubAlerts();
      unsubTasks();
      unsubSchedule();
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

      {/* Task Details Modal */}
      <Dialog open={!!selectedTaskDetails} onOpenChange={(open) => !open && setSelectedTaskDetails(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none overflow-y-auto max-h-[90vh]">
          {selectedTaskDetails && (
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 ${
                  selectedTaskDetails.isCompleted ? 'bg-emerald-100 text-emerald-600' :
                  selectedTaskDetails.category === 'Vaccination' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {selectedTaskDetails.isCompleted ? <ClipboardCheck size={40} /> :
                   selectedTaskDetails.category === 'Vaccination' ? <ShieldCheck size={40} /> : <Pill size={40} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-slate-200">
                      {selectedTaskDetails.category}
                    </Badge>
                    {selectedTaskDetails.isCompleted && <Badge className="bg-emerald-500 text-white border-none text-[10px]">COMPLETED</Badge>}
                  </div>
                  <DialogTitle className="text-3xl font-black italic text-slate-900 leading-tight">{selectedTaskDetails.title}</DialogTitle>
                  <DialogDescription className="font-bold text-slate-400 italic flex items-center gap-2 mt-1">
                    <Calendar size={14} />
                    {selectedTaskDetails.scheduledDate ? `${getRemainingDaysLabel(selectedTaskDetails.scheduledDate)} (${format(new Date(selectedTaskDetails.scheduledDate), 'MMM dd, yyyy')})` : `Day ${selectedTaskDetails.day}`}
                  </DialogDescription>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Methods & Instructions</h4>
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 max-h-[300px] overflow-y-auto scrollbar-hide">
                    <p className="text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">{selectedTaskDetails.description}</p>
                  </div>
                </div>

                {selectedTaskDetails.videoUrl && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Video Tutorial</h4>
                    <Button 
                      className="w-full bg-[#122B21] text-white hover:bg-black font-black h-16 rounded-2xl flex items-center justify-center gap-3 transition-all"
                      onClick={() => handleWatchVideo(selectedTaskDetails)}
                    >
                      <Download size={20} className="rotate-[270deg]" />
                      WATCH VIDEO GUIDE
                    </Button>
                    <p className="text-[9px] text-center text-slate-400 font-bold italic mt-2">
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

      <Dialog open={showTasksModal} onOpenChange={setShowTasksModal}>
        <DialogContent className="max-w-2xl rounded-[2rem] max-h-[90vh] p-0 border-none flex flex-col overflow-hidden">
          <div className="bg-sky-600 p-8 text-white relative shrink-0">
            <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
              <Calendar />
              Upcoming Schedule
            </h2>
            <p className="text-sky-100 font-bold text-xs uppercase tracking-widest">Tasks, Vaccinations & Plans</p>
            <div className="absolute top-8 right-8 bg-sky-500/30 p-4 rounded-3xl backdrop-blur-md border border-sky-400/30">
              <ClipboardCheck size={40} className="text-sky-200 opacity-50" />
            </div>
          </div>
          <div className="p-8 space-y-6 bg-slate-50 overflow-y-auto flex-1">
            {(() => {
                  const roadmapTasks = (farmerSchedule?.template?.days || [])
                    .filter((t: any) => {
                      const taskDate = new Date(farmerSchedule.startDate);
                      taskDate.setDate(taskDate.getDate() + (t.day - 1));
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      const diffTime = taskDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      // Filter based on visibility window (default 7 if not set)
                      const window = farmerSchedule.visibilityDaysBefore ?? 7;
                      return diffDays <= window;
                    })
                    .map((t: any) => {
                      const taskDate = new Date(farmerSchedule.startDate);
                      taskDate.setDate(taskDate.getDate() + (t.day - 1));
                      const isCompleted = farmerSchedule.completedDays?.includes(t.day);
                      return {
                        id: `roadmap-${t.day}-${t.title}`,
                        day: t.day,
                        title: t.title,
                        description: t.description,
                        category: t.category,
                        videoUrl: t.videoUrl,
                        scheduledDate: format(taskDate, 'yyyy-MM-dd'),
                        creatorType: 'System Roadmap',
                        isRoadmap: true,
                        isCompleted
                      };
                    });

              const allTasks = [
                ...tasks.map(t => ({ ...t, isCompleted: t.status === 'Completed' })), 
                ...roadmapTasks
              ].sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));

              if (allTasks.length === 0) {
                return (
                  <div className="text-center py-20 text-slate-400">
                    <CheckSquare size={50} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No tasks scheduled</p>
                    <p className="text-xs">Your schedule is currently clear</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {allTasks.map(task => (
                    <Card 
                      key={task.id} 
                      className={`border-none shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all cursor-pointer ${task.isRoadmap ? 'border-l-4 border-l-emerald-500' : ''} ${task.isCompleted ? 'opacity-60 bg-slate-100' : 'bg-white'}`}
                      onClick={() => setSelectedTaskDetails(task)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex gap-4">
                            <div className={`p-3 rounded-2xl ${
                              task.isCompleted ? 'bg-emerald-50 text-emerald-600' : 
                              task.isRoadmap ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {task.category === 'Vaccination' ? <ShieldCheck size={20} /> : <ClipboardList size={20} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                  <h4 className={`font-black text-slate-900 ${task.isCompleted ? 'line-through opacity-50' : ''}`}>
                                    {task.title}
                                  </h4>
                                  <div className="flex gap-1">
                                    <Badge className={`text-[8px] uppercase font-bold border-none ${
                                        task.category === 'Vaccination' ? 'bg-rose-100 text-rose-600' : 
                                        task.isRoadmap ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        {task.category}
                                    </Badge>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3 mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                  <span className="flex items-center gap-1 text-emerald-600 font-black">
                                    <Calendar size={12}/> {getRemainingDaysLabel(task.scheduledDate)}
                                  </span>
                                  {task.creatorType && <span className="flex items-center gap-1">• {task.creatorType}</span>}
                              </div>
                            </div>
                          </div>
                          {!task.isCompleted && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={isFutureTask(task.scheduledDate)}
                              className={`rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold text-[10px] shrink-0 ${isFutureTask(task.scheduledDate) ? 'opacity-50 grayscale' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFutureTask(task.scheduledDate)) {
                                  toast.error('You cannot mark future tasks as done yet!');
                                  return;
                                }
                                if (task.isRoadmap) {
                                  handleMarkRoadmapDone(task.day);
                                } else {
                                  updateDoc(doc(db, 'tasks', task.id), { status: 'Completed', updatedAt: new Date().toISOString() });
                                  toast.success('Task marked as completed');
                                }
                              }}
                            >
                              {isFutureTask(task.scheduledDate) ? 'LOCKED' : 'DONE'}
                            </Button>
                          )}
                          {task.isCompleted && <CheckSquare className="text-emerald-500" size={20} />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
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
                // Create normalized logs from both collections
                const normalizedLogs: any[] = [];
                
                // Process dailyLogs
                dailyLogs.forEach(log => {
                  if (Number(log.production?.eggCount) > 0) {
                     const intake = Number(log.consumption?.feedIntake) || 0;
                     const fType = log.consumption?.feedType;
                     let feedCostVal = 0;
                     if (intake > 0 && fType) {
                       const stock = feedStockList.find(s => s.type === fType);
                       const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                       feedCostVal = intake * unitPrice;
                     }

                     let medCostVal = 0;
                     if (Array.isArray(log.health?.medicines)) {
                       log.health.medicines.forEach((m: any) => {
                         const doses = Number(m.doses) || 0;
                         if (doses > 0 && m.name) {
                           const stock = medicineStockList.find(s => s.name === m.name);
                           const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                           medCostVal += doses * unitPrice;
                         }
                       });
                     }
                     if (Array.isArray(log.health?.vaccines)) {
                       log.health.vaccines.forEach((v: any) => {
                         const doses = Number(v.doses) || 0;
                         if (doses > 0 && v.name) {
                           const stock = medicineStockList.find(s => s.name === v.name);
                           const unitPrice = stock?.unitPrice || (stock?.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : 0);
                           medCostVal += doses * unitPrice;
                         }
                       });
                     }

                     const labour = Number(log.production?.labourCost) || 0;
                     const totalCost = feedCostVal + medCostVal + labour;
                     const goodEggs = Number(log.production?.goodEggs) || 0;

                     normalizedLogs.push({
                       id: log.id,
                       date: log.date,
                       dailyCost: totalCost,
                       totalEggs: Number(log.production?.eggCount) || 0,
                       goodEggs,
                       badEggs: Number(log.production?.badEggs) || 0,
                       costPerEgg: goodEggs > 0 ? totalCost / goodEggs : 0,
                       birdCount: Number(log.birds?.closing) || stats.totalBirds || 0,
                        source: 'daily_log',
                        raw: log
                     });
                   }
                 });

                 // Process dedicated eggLogs
                 eggLogs.forEach(log => {
                    const totalCost = (Number(log.feedConsumptionKg) * Number(log.feedCostPerKg) || 0) + 
                                     (Number(log.medicineCost) || 0) + 
                                     (Number(log.labourCost) || 0);
                    const goodEggs = Number(log.goodEggs) || 0;
                    
                    normalizedLogs.push({
                      id: log.id,
                      date: log.date,
                      dailyCost: totalCost,
                      totalEggs: Number(log.totalEggs) || 0,
                      goodEggs,
                      badEggs: Number(log.badEggs) || 0,
                      costPerEgg: goodEggs > 0 ? totalCost / goodEggs : 0,
                      birdCount: Number(log.birdCount) || 0,
                       source: 'egg_log',
                       raw: log
                    });
                 });

                 const layerLogs = normalizedLogs
                   .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                   .slice(0, 10);

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
                             const flock = activeFlocks.find(f => f.id === latest?.flockId);
                             const birds = (Number(latest?.birdCount) > 1 ? Number(latest.birdCount) : (Number(flock?.birdCount) || (stats.totalBirds > 0 ? stats.totalBirds : 1)));
                             const rate = Math.round((Number(latest?.totalEggs || 0) / birds) * 100);
                             return Math.min(100, rate);
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
                               <TableHead className="text-[9px] font-black uppercase tracking-widest text-right min-w-[60px]">Actions</TableHead>
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
                                 <TableCell className="text-right">
                                   <div className="flex justify-end gap-1">
                                      <Link to={`/add?tab=history&filter=eggs_prod&edit=${log.id}&source=${log.source === 'daily_log' ? 'daily' : 'egg'}`}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100">
                                          <TrendingUp size={12} className="text-slate-400" />
                                        </Button>
                                      </Link>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                          if (log.source === 'daily_log') handleDeleteDailyLog(log.id, log.raw);
                                          else handleDeleteEggLog(log.id);
                                        }}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                   </div>
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
          <div 
            role="button" 
            onClick={() => checkAccess(() => navigate('/add?tab=alerts'))}
            className="hidden sm:block"
          >
            <Button variant="outline" className="border-red-100 text-red-600 hover:bg-red-50 rounded-xl h-10 px-4 font-bold gap-2">
              <AlertTriangle size={18} />
              <span>Safety Alerts</span>
            </Button>
          </div>
          <div 
            role="button"
            onClick={() => checkAccess(() => navigate('/add?tab=alerts'))}
            className="sm:hidden block p-2 bg-red-50 rounded-xl border border-red-100"
          >
             <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div 
            role="button"
            onClick={() => checkAccess(() => navigate('/notifications'))}
            className="relative p-2 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Bell size={20} className="text-slate-600" />
            {systemAlerts.some(a => (a.active !== false) && (a.userId ? a.userId === user?.uid : (a.target === 'All' || a.target === profile?.farmType)) && !a.viewedBy?.includes(user?.uid)) && (
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </div>
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
            onClick={() => checkAccess(() => setShowLogsModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Total Birds" 
            value={stats.totalBirds.toLocaleString()} 
            icon={Users} 
            color="bg-emerald-500"
            subtitle={`${Math.max(0, (profile?.birdCapacity || 0) - stats.totalBirds).toLocaleString()} Free`}
            onClick={() => checkAccess(() => setShowBirdsModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Active Flocks" 
            value={stats.totalFlocks} 
            icon={Package} 
            color="bg-blue-500"
            subtitle="Running Batches"
            onClick={() => checkAccess(() => setShowActiveFlocksModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Net Balance" 
            value={`₹${stats.balance.toLocaleString()}`} 
            icon={CreditCard} 
            color="bg-orange-500"
            subtitle="P/L Summary"
            onClick={() => checkAccess(() => setShowNetBalanceModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Feed Stock" 
            value={`${stats.feedStock.toLocaleString()} kg`} 
            icon={Package} 
            color="bg-amber-600"
            subtitle={`Cost: ₹${stats.feedStockValue.toLocaleString()}`}
            onClick={() => checkAccess(() => setShowFeedModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Medicine Stock" 
            value={`${stats.medicineStock} Items`} 
            icon={Pill} 
            color="bg-indigo-600"
            subtitle={`Cost: ₹${stats.medicineStockValue.toLocaleString()}`}
            onClick={() => checkAccess(() => setShowMedModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Upcoming Schedule" 
            value={tasks.filter(t => t.status !== 'Completed').length} 
            icon={Calendar} 
            color="bg-sky-600"
            subtitle="Tasks & Plans"
            onClick={() => checkAccess(() => setShowTasksModal(true))}
          />
        </LicenseGuard>
        <LicenseGuard mode="interaction">
          <StatCard 
            title="Available Eggs" 
            value={(() => {
              const totalProduced = [
                ...dailyLogs.map(l => Number(l.production?.goodEggs) || 0),
                ...eggLogs.map(l => Number(l.goodEggs) || 0)
              ].reduce((sum, count) => sum + count, 0);

              const totalSold = eggSales.reduce((sum, sale) => sum + (Number(sale.eggCount) || 0), 0);
              
              return (totalProduced - totalSold).toLocaleString();
            })()} 
            icon={Egg} 
            color="bg-amber-500"
            subtitle="Inventory Stock"
            onClick={() => checkAccess(() => setShowEggLogsModal(true))}
          />
        </LicenseGuard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Schedule / Upcoming Tasks - Farmer Visibility Restriction */}
          <AnimatePresence>
            {farmerSchedule && farmerSchedule.template && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center px-1">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={14} className="text-emerald-500" />
                      Upcoming Batch Schedule
                   </h4>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 h-6 px-2 rounded-lg"
                    onClick={() => checkAccess(() => setShowScheduleModal(true))}
                   >
                      View Full Plan
                   </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pb-4 pr-1 scrollbar-hide">
                  {(() => {
                    const template = farmerSchedule.template;
                    const visibleDays = profile?.scheduleDisplayDays || 2;
                    const completedDays = farmerSchedule.completedDays || [];
                    
                    const filteredTasks = template.days
                      ? template.days
                          .sort((a: any, b: any) => a.day - b.day)
                          .filter((task: any) => {
                            const taskDate = new Date(farmerSchedule.startDate);
                            taskDate.setDate(taskDate.getDate() + (task.day - 1));
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffDays = Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const isCompleted = completedDays.includes(task.day);
                            return diffDays >= 0 && diffDays < visibleDays && !isCompleted;
                          })
                      : [];
                    
                    if (filteredTasks.length === 0) return <p className="col-span-full py-4 text-center text-slate-400 italic text-xs">No pending scheduled tasks for the next {visibleDays} days.</p>;

                    return filteredTasks.map((task: any, idx: number) => {
                        const taskDate = new Date(farmerSchedule.startDate);
                        taskDate.setDate(taskDate.getDate() + (task.day - 1));
                        const isToday = format(new Date(), 'yyyy-MM-dd') === format(taskDate, 'yyyy-MM-dd');

                        return (
                          <div 
                            key={idx} 
                            className={`p-4 rounded-[1.5rem] border flex items-center gap-4 transition-all hover:shadow-md cursor-pointer ${isToday ? 'bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-900/5' : 'bg-white border-slate-50'}`}
                            onClick={() => setSelectedTaskDetails({
                              ...task,
                              videoUrl: task.videoUrl,
                              scheduledDate: format(taskDate, 'yyyy-MM-dd'),
                              isRoadmap: true,
                              isCompleted: false
                            })}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                              task.category === 'Vaccination' ? 'bg-amber-100 text-amber-600' :
                              task.category === 'Medicine Plan' ? 'bg-indigo-100 text-indigo-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {task.category === 'Vaccination' ? <ShieldCheck size={20} /> : <Pill size={20} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                  {getRemainingDaysLabel(format(taskDate, 'yyyy-MM-dd'))}
                                </p>
                                {isToday && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>}
                                {task.videoUrl && (
                                  <Badge className="bg-amber-100 text-amber-600 border-none text-[8px] font-black px-1.5 h-4 ml-auto">
                                    VIDEO
                                  </Badge>
                                )}
                              </div>
                              <h5 className="font-bold text-slate-900 text-sm truncate">{task.title}</h5>
                              <p className="text-[10px] text-slate-500 font-medium truncate">{task.description}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[10px] font-black text-emerald-600 h-8 rounded-xl shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkRoadmapDone(task.day);
                              }}
                            >
                              DONE
                            </Button>
                          </div>
                        );
                      });
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                            <DialogTrigger nativeButton={true} render={
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
      {/* Full Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-8 border-none overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic">Your Batch Plan</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">Complete roadmap for your current active batch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            {farmerSchedule?.template?.days ? (
              farmerSchedule.template.days.sort((a: any, b: any) => a.day - b.day).map((task: any, idx: number) => {
               const taskDate = new Date(farmerSchedule.startDate);
               taskDate.setDate(taskDate.getDate() + (task.day - 1));
               const isToday = format(new Date(), 'yyyy-MM-dd') === format(taskDate, 'yyyy-MM-dd');
               const isPast = taskDate < new Date(new Date().setHours(0,0,0,0));

               return (
                <div key={idx} className={`p-5 rounded-2xl border flex items-center gap-4 ${isToday ? 'bg-emerald-50 border-emerald-200' : isPast ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100'}`}>
                   <div className="flex flex-col items-center shrink-0 w-12">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Day</p>
                      <p className="text-xl font-black text-slate-900">{task.day}</p>
                   </div>
                   <div className="h-10 w-px bg-slate-100 mx-2"></div>
                   <div className="flex-1">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{format(taskDate, 'MMM dd, yyyy')}</p>
                      <h5 className="font-bold text-slate-900">{task.title}</h5>
                      <p className="text-xs text-slate-500">{task.description}</p>
                   </div>
                   <Badge className={`${
                      task.category === 'Vaccination' ? 'bg-amber-100 text-amber-700' : 
                      task.category === 'Medicine Plan' ? 'bg-indigo-100 text-indigo-700' : 
                      'bg-slate-100 text-slate-600'
                    } border-none font-bold text-[10px]`}>
                      {task.category}
                    </Badge>
                </div>
               );
              })
            ) : (
              <p className="text-center text-slate-400 italic py-8">No plan defined for this schedule.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
};

export default Dashboard;
