import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  Wallet, TrendingUp, HandCoins, ArrowDownRight, ArrowUpRight, 
  Calendar, CheckCircle, Clock, ShoppingBag, Landmark, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const ManagerEarnings: React.FC = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState({
    walletBalance: 12500,
    withdrawn: 45000,
    totalEarned: 57500,
    commissionRate: 2.5, // 2.5% on farmer orders
    monthlySalesTarget: 150000,
    monthlySalesCurrent: 98000
  });

  const [orders, setOrders] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch assigned farmers
    const qFarmers = query(collection(db, 'users'), where('managerId', '==', user.uid));
    const unsubFarmers = onSnapshot(qFarmers, (snap) => {
      const farmersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      setFarmers(farmersList);

      if (farmersList.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Fetch all orders from these farmers to calculate commissions
      const farmerIds = farmersList.map(f => f.id);
      
      // Firestore 'in' has standard queries. Let's fetch the overall orders.
      const unsubOrders = onSnapshot(
        query(collection(db, 'orders'), orderBy('date', 'desc')),
        (ordersSnap) => {
          const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
          // Filter dynamically by assigned farmers
          const referralOrders = allOrders.filter(o => farmerIds.includes(o.userId));
          setOrders(referralOrders);

          // Calculate real dynamically linked commission
          let totalSalesVal = 0;
          referralOrders.forEach(o => {
            if (o.status === 'Completed' || o.paymentStatus === 'Paid') {
              totalSalesVal += (o.total || o.finalTotal || 0);
            }
          });

          const commissionAcrued = Math.round(totalSalesVal * 0.025); // 2.5% standard
          const baseSalary = 15000; // Manager standard field stipend

          setEarnings(prev => ({
            ...prev,
            monthlySalesCurrent: totalSalesVal,
            totalEarned: baseSalary + commissionAcrued + 45000, // baseline defaults
            walletBalance: baseSalary + commissionAcrued
          }));

          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );

      return () => unsubOrders();
    });

    return () => {
      unsubFarmers();
    };
  }, [user]);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || 'Team Farmer';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <Wallet className="text-[#4F46E5]" size={32} />
          COMMISSIONS & EARNINGS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Regional sales commissions and performance bonusses ledger
        </p>
      </div>

      {/* Main Ledger grid view */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Wallet & Quick Cashout */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-[#0F172A] text-white overflow-hidden flex flex-col justify-between py-6 relative">
          <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-indigo-550 rounded-full blur-[80px] opacity-30 pointer-events-none" />
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] bg-white/10 text-white font-extrabold px-3 py-1 rounded-full border border-white/5 uppercase tracking-widest">
                Hub Wallet
              </span>
              <Landmark size={18} className="text-slate-400" />
            </div>

            <div>
              <p className="text-xs text-slate-400 font-bold">AVAILABLE BALANCE</p>
              <h2 className="text-4xl font-extrabold text-white mt-1">₹{earnings.walletBalance.toLocaleString()}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Cashouts</p>
                <p className="text-sm font-extrabold text-[#10B981] mt-0.5">₹{earnings.withdrawn.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Accrued</p>
                <p className="text-sm font-extrabold text-slate-200 mt-0.5">₹{earnings.totalEarned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
          <div className="px-6 border-t border-white/5 pt-4">
            <Button className="w-full bg-[#4F46E5] hover:bg-opacity-95 text-xs text-center font-bold uppercase tracking-widest rounded-2xl h-11 border-none cursor-not-allowed">
              Request Bank Transfer
            </Button>
          </div>
        </Card>

        {/* Manager Target Stats */}
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6 flex flex-col justify-between md:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black italic tracking-wide text-slate-800">REGIONAL SALES GOALS</CardTitle>
                <CardDescription className="text-xs">Based on supply orders placed by your farmers</CardDescription>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 font-black uppercase text-[9px] tracking-widest rounded-full border border-emerald-150">
                Commission tier: {earnings.commissionRate}%
              </Badge>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Monthly Orders aggregate</span>
                <span>₹{earnings.monthlySalesCurrent.toLocaleString()} / ₹{earnings.monthlySalesTarget.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden w-full">
                <div 
                  className="bg-emerald-505 bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (earnings.monthlySalesCurrent / earnings.monthlySalesTarget) * 105)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-450 font-bold mt-1">
                Reach target to unlock an extra 1% bonus coefficient next month!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-50 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated stipend</p>
                <p className="text-sm font-black text-slate-850">₹15,000 / Mo</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                <HandCoins size={16} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned Team Size</p>
                <p className="text-sm font-black text-slate-850">{farmers.length} Active Farmers</p>
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Referral Orders Ledger lists */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="pb-4">
          <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight">Referral Orders Log</CardTitle>
          <CardDescription className="text-xs">Supply orders placed by your assigned farmers earning you commission credit</CardDescription>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Order Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Farmer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Items summary</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Order Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Commission (2.5%)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center font-mono">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400 font-bold">
                    No matching referral orders completed yet in this hub
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const comm = Math.round((order.total || order.finalTotal || 0) * 0.025);
                  return (
                    <TableRow key={order.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs font-bold text-slate-600">
                        {order.date ? format(new Date(order.date), 'dd MMM yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-xs text-slate-800">{getFarmerName(order.userId)}</p>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-slate-500 font-semibold">
                        {order.items?.map((i: any) => `${i.name} x${i.quantity}`).join(', ') || 'Various items'}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-slate-800">
                        ₹{(order.total || order.finalTotal || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-emerald-600">
                        +₹{comm.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[9px]">
                        <Badge variant={order.status === 'Completed' ? 'default' : 'secondary'} className="rounded-full text-[8px] font-extrabold uppercase tracking-wider">
                          {order.status || 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default ManagerEarnings;
