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

  return null;
};

export default Dashboard;