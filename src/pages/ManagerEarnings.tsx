import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  History, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Clock,
  Briefcase,
  Percent,
  Info,
  Package
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  getDocs,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/src/lib/AuthContext';
import { format } from 'date-fns';

const ManagerEarnings: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalPaid: 0,
    pendingBalance: 0,
    activeFarmers: 0
  });
  const [payments, setPayments] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [commissionConfig, setCommissionConfig] = useState<any>({});

  useEffect(() => {
    if (!profile?.uid) return;

    const managerId = profile.uid;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch products
        const productsSnap = await getDocs(query(collection(db, 'shopItems'), orderBy('name', 'asc')));
        const productsList = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(productsList);
        
        // 1. Fetch Assigned Farmers
        const usersSnap = await getDocs(query(collection(db, 'users'), where('managerId', '==', managerId)));
        const userDocs = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const assignedFarmerIds = userDocs.map(u => u.id);

        // 2. Fetch Manager's Commission Config
        const commDoc = await getDoc(doc(db, 'managerCommissions', managerId));
        const config = commDoc.exists() ? commDoc.data().productCommissions || {} : {};
        setCommissionConfig(config);

        // 3. Fetch Orders and Calculate Commissions
        const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('date', 'desc')));
        const allOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const myOrders = allOrders.filter(o => 
          assignedFarmerIds.includes(o.userId) || o.assignedManagerId === managerId
        ).filter(o => o.status !== 'Cancelled');

        let totalEarned = 0;
        const salesWithCommission = myOrders.map(order => {
          let orderCommission = 0;
          order.items?.forEach((item: any) => {
            const comm = config[item.id];
            if (comm) {
              const qty = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              if (typeof comm === 'number') {
                orderCommission += comm * qty;
              } else if (comm.type === 'percentage') {
                orderCommission += (price * qty * comm.value) / 100;
              } else {
                orderCommission += comm.value * qty;
              }
            }
          });
          totalEarned += orderCommission;
          return { ...order, earnedCommission: orderCommission };
        });

        setRecentSales(salesWithCommission.slice(0, 10));

        // 4. Fetch Payments from Admin
        const paymentsSnap = await getDocs(query(collection(db, 'managerPayments'), where('managerId', '==', managerId), orderBy('date', 'desc')));
        const paymentsList = paymentsSnap.docs.map(doc => ({
           id: doc.id, 
           ...doc.data(),
           date: doc.data().date?.toDate() || new Date()
        }));
        setPayments(paymentsList);

        const totalPaid = paymentsList
          .filter((p: any) => p.status === 'Paid')
          .reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);

        setStats({
          totalEarned,
          totalPaid,
          pendingBalance: totalEarned - totalPaid,
          activeFarmers: assignedFarmerIds.length
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching earnings data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Commission & Payments</h1>
        <p className="text-slate-500 font-medium">Track your earnings and payment history from the platform</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-indigo-600 text-white rounded-[2rem]">
          <CardContent className="pt-8">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <Badge className="bg-emerald-400 text-emerald-950 border-none font-bold">LIFETIME</Badge>
            </div>
            <h3 className="text-3xl font-bold font-mono">₹{stats.totalEarned.toLocaleString()}</h3>
            <p className="text-indigo-100/60 text-[10px] font-bold uppercase tracking-widest mt-2">Total Commissions</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] flex flex-col justify-between">
          <CardContent className="pt-8 pb-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 font-mono">₹{stats.totalPaid.toLocaleString()}</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Received Amount</p>
              </div>
            </div>
          </CardContent>
          <div className="px-6 py-3 bg-slate-50 rounded-b-[2rem] border-t border-slate-100">
            <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              Fully settled by admin
            </p>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] flex flex-col justify-between">
          <CardContent className="pt-8 pb-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 font-mono">₹{stats.pendingBalance.toLocaleString()}</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pending Balance</p>
              </div>
            </div>
          </CardContent>
          <div className="px-6 py-3 bg-slate-50 rounded-b-[2rem] border-t border-slate-100">
            <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Next payout cycle: Monthly end</p>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-[#122B21] text-white rounded-[2rem]">
          <CardContent className="pt-8">
             <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Briefcase size={24} className="text-emerald-400" />
              </div>
              <ArrowUpRight size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-3xl font-bold font-mono">{stats.activeFarmers}</h3>
            <p className="text-emerald-100/60 text-[10px] font-bold uppercase tracking-widest mt-2">Active Assigned Farmers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Sales with Commission */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="text-indigo-600" />
              Recent Commisionable Sales
            </CardTitle>
            <CardDescription>Earnings from orders placed by your farmers</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-8 font-bold text-[10px] tracking-widest uppercase">Order</TableHead>
                <TableHead className="font-bold text-[10px] tracking-widest uppercase">Status</TableHead>
                <TableHead className="font-bold text-[10px] tracking-widest uppercase text-right px-8">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors border-slate-50">
                  <TableCell className="px-8 py-4">
                    <p className="text-xs font-bold text-slate-900">Batch #{sale.id.substring(0,6).toUpperCase()}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{format(new Date(sale.date), 'MMM dd, yyyy')}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] font-bold ${
                      sale.status === 'Delivered' ? 'border-emerald-100 text-emerald-600 bg-emerald-50' : 'border-slate-100 text-slate-500'
                    }`}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-8 font-bold text-slate-900">
                    ₹{sale.earnedCommission.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {recentSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-slate-400 italic">No commissionable sales recorded.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Payment History */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="text-emerald-600" />
              Payment History
            </CardTitle>
            <CardDescription>Funds received from administrative settlements</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-8 font-bold text-[10px] tracking-widest uppercase">Reference</TableHead>
                <TableHead className="font-bold text-[10px] tracking-widest uppercase text-center">Date</TableHead>
                <TableHead className="font-bold text-[10px] tracking-widest uppercase text-right px-8">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50 transition-colors border-slate-50">
                  <TableCell className="px-8 py-4">
                    <p className="text-xs font-bold text-slate-900">{p.description || 'Admin Settlement'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CreditCard size={10} className="text-slate-400" />
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-[11px] text-slate-500 font-medium">
                    {format(p.date, 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <span className="text-sm font-black text-emerald-600">+₹{p.amount.toLocaleString()}</span>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-slate-400 italic">No payment records found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Commission Rates List */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="text-amber-600" />
            My Commission Rates
          </CardTitle>
          <CardDescription>Approved commission structure for each product category</CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          {Object.keys(commissionConfig).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
               <Info size={32} className="mb-2 opacity-20" />
               <p className="text-xs font-bold uppercase tracking-widest">No commissions configured</p>
               <p className="text-[10px] mt-1">Please contact administrator to setup your commission plan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {Object.entries(commissionConfig).map(([productId, config]: [string, any]) => {
                 const product = products.find(p => p.id === productId);
                 const value = typeof config === 'number' ? config : config.value;
                 const type = typeof config === 'number' ? 'fixed' : config.type;

                 return (
                   <div key={productId} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-amber-50 transition-colors">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 border border-slate-100 shrink-0">
                         <Package size={20} />
                       </div>
                       <div>
                         <p className="text-xs font-bold text-slate-900 group-hover:text-amber-900">{product?.name || 'Unknown Product'}</p>
                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Category: {product?.category || 'General'}</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-sm font-black text-amber-600">
                         {type === 'percentage' ? `${value}%` : `₹${value}`}
                       </p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">PER {product?.unit?.toUpperCase() || 'UNIT'}</p>
                     </div>
                   </div>
                 );
               })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerEarnings;
