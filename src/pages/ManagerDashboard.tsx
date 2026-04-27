import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Users, 
  Activity, 
  ClipboardList, 
  MapPin, 
  Phone, 
  ArrowUpRight, 
  ShoppingCart, 
  ShoppingBag,
  Eye, 
  Package, 
  Calendar,
  Bird,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  IndianRupee,
  Thermometer,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { updateDoc, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

const ManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [myFarmers, setMyFarmers] = useState<any[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [feedStocks, setFeedStocks] = useState<any[]>([]);
  const [medicineStocks, setMedicineStocks] = useState<any[]>([]);
  const [commissionConfig, setCommissionConfig] = useState<any>({});
  
  const [selectedCart, setSelectedCart] = useState<any>(null);
  const [isAbandonedCartModalOpen, setIsAbandonedCartModalOpen] = useState(false);
  const [selectedFarmerForBatches, setSelectedFarmerForBatches] = useState<any>(null);
  const [selectedFarmerForStock, setSelectedFarmerForStock] = useState<any>(null);
  const [selectedFarmerForMortality, setSelectedFarmerForMortality] = useState<any>(null);
  const [stockType, setStockType] = useState<'feed' | 'medicine' | null>(null);
  const [farmerBatches, setFarmerBatches] = useState<any[]>([]);
  const [isFlockModalOpen, setIsFlockModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isBirdsModalOpen, setIsBirdsModalOpen] = useState(false);
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState(false);
  const [isFeedStockModalOpen, setIsFeedStockModalOpen] = useState(false);
  const [isMedicineStockModalOpen, setIsMedicineStockModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isMortalityApprovalOpen, setIsMortalityApprovalOpen] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch assigned farmers
    const q = query(collection(db, 'users'), where('managerId', '==', profile.uid));
    const unsubscribeFarmers = onSnapshot(q, (snapshot) => {
      const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMyFarmers(farmers);
      
      const farmerIds = farmers.map(f => f.id);
      if (farmerIds.length > 0) {
        // Fetch carts
        const cartQ = query(collection(db, 'carts'));
        onSnapshot(cartQ, (cartSnap) => {
          const allCarts = cartSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAbandonedCarts(allCarts.filter((c: any) => farmerIds.includes(c.userId)));
        });

        // Fetch flocks
        const flockQ = query(collection(db, 'flocks'), where('status', '==', 'Active'));
        onSnapshot(flockQ, (flockSnap) => {
          const allFlocks = flockSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFlocks(allFlocks.filter((f: any) => farmerIds.includes(f.userId)));
        });

        // Fetch logs
        const logQ = query(collection(db, 'dailyLogs'), orderBy('timestamp', 'desc'), limit(500));
        onSnapshot(logQ, (logSnap) => {
          const allLogs = logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setLogs(allLogs.filter((l: any) => farmerIds.includes(l.userId)));
        });

        // Fetch Feed Stock
        const feedQ = query(collection(db, 'feedStock'));
        onSnapshot(feedQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFeedStocks(all.filter((item: any) => farmerIds.includes(item.userId)));
        });

        // Fetch Medicine Stock
        const medQ = query(collection(db, 'medicineStock'));
        onSnapshot(medQ, (snap) => {
          const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMedicineStocks(all.filter((item: any) => farmerIds.includes(item.userId)));
        });
      }
    });

    // Fetch products
    getDocs(collection(db, 'shopItems')).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Commission Config
    getDoc(doc(db, 'managerCommissions', profile.uid)).then(snap => {
      if (snap.exists()) setCommissionConfig(snap.data().productCommissions || {});
    });

    return () => unsubscribeFarmers();
  }, [profile?.uid]);

  const stats = {
    totalFarmers: myFarmers.length,
    activeFlocks: flocks.length,
    totalBirds: flocks.reduce((sum, f) => sum + (f.currentCount || 0), 0),
    avgMortality: logs.length > 0 ? (logs.reduce((sum, l) => sum + (l.health?.mortality || 0), 0) / (flocks.reduce((sum, f) => sum + (f.initialCount || 0), 0) || 1) * 100) : 0,
    missingLogs: myFarmers.filter(f => !logs.some(l => l.userId === f.id && l.date === format(new Date(), 'yyyy-MM-dd'))).length,
    criticalAlerts: logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).length,
    pendingMortalityApproval: logs.filter(l => l.health?.mortality > 0 && l.approved === false).length,
    abandonedCarts: abandonedCarts.length,
    abandonedCartFarmers: new Set(abandonedCarts.map(c => c.userId)).size,
    totalFeedStock: feedStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
    totalMedicineStock: medicineStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
  };

  const calculateCartCommission = (items: any[]) => {
    return items.reduce((sum, item) => {
      const comm = commissionConfig[item.id];
      const product = products.find(p => p.id === item.id);
      if (!comm || !product) return sum;
      
      const qty = Number(item.quantity) || 0;
      const price = Number(product.price) || 0;
      
      if (typeof comm === 'number') return sum + (comm * qty);
      if (comm.type === 'percentage') return sum + (price * qty * comm.value / 100);
      return sum + (comm.value * qty);
    }, 0);
  };

  const calculateCartTotal = (items: any[]) => {
    return items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.id);
      return sum + (Number(product?.price || 0) * (Number(item.quantity) || 0));
    }, 0);
  };

  const viewFarmerBatches = async (farmer: any) => {
    setSelectedFarmerForBatches(farmer);
    const q = query(collection(db, 'flocks'), where('userId', '==', farmer.id), where('status', '==', 'Active'));
    const snap = await getDocs(q);
    setFarmerBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleApproveMortality = async (logId: string) => {
    try {
      await updateDoc(doc(db, 'dailyLogs', logId), { approved: true });
      toast.success('Mortality entry approved');
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleSendResetLink = async (farmer: any) => {
    if (!farmer.email) {
      toast.error('Email not found for this farmer');
      return;
    }
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, farmer.email);
      toast.success(`Reset link sent to ${farmer.name}'s email`);
    } catch (error: any) {
      toast.error('Failed to send reset link: ' + error.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manager Dashboard</h1>
          <p className="text-slate-500 font-medium">Field operations and team performance overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* My Assigned Farmers Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between group hover:border-indigo-200 transition-all hover:bg-indigo-50/10">
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
              <Users size={22} />
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalFarmers}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Farmers</p>
          </div>
        </div>

        {/* Mortality Trends Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-emerald-200 transition-all hover:bg-emerald-50/10 group"
          onClick={() => setIsMortalityModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Activity size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900 text-emerald-600">{stats.avgMortality.toFixed(2)}%</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality Rate</p>
          </div>
        </div>

        {/* Active Flock Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all hover:bg-indigo-50/10 group"
          onClick={() => setIsFlockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
              <Package size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.activeFlocks}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Flocks</p>
          </div>
        </div>

        {/* Total Birds Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-emerald-200 transition-all hover:bg-emerald-50/10 group"
          onClick={() => setIsBirdsModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Bird size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalBirds.toLocaleString()}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Birds</p>
          </div>
        </div>

        {/* Accountability / Logs Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-amber-200 transition-all hover:bg-amber-50/10 group"
          onClick={() => setIsLogsModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
              <ClipboardList size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.missingLogs}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Missing Logs (Today)</p>
          </div>
        </div>

        {/* Critical Alerts Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-red-200 transition-all hover:bg-red-50/10 group"
          onClick={() => setIsAlertModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-red-50 p-3 rounded-2xl text-red-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-red-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.criticalAlerts}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Critical Alerts</p>
          </div>
        </div>

        {/* Mortality Approval Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-rose-200 transition-all hover:bg-rose-50/10 group"
          onClick={() => setIsMortalityApprovalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 p-3 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
              <ShieldCheck size={22} />
            </div>
            {stats.pendingMortalityApproval > 0 && (
              <Badge className="bg-rose-500 text-white text-[8px] animate-pulse">ACTION REQUIRED</Badge>
            )}
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.pendingMortalityApproval}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality Approvals</p>
          </div>
        </div>

        {/* Mortality Trends Details Card - Actually just a link to the modal now since Top card does it but let's keep one in grid if space allows or replace with Stock */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-orange-200 transition-all hover:bg-orange-50/10 group"
          onClick={() => setIsFeedStockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-orange-50 p-3 rounded-2xl text-orange-600 group-hover:scale-110 transition-transform">
              <Package size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-orange-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalFeedStock.toLocaleString()} KG</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Feed Stock</p>
          </div>
        </div>

        {/* Medicine Stock Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-purple-200 transition-all hover:bg-purple-50/10 group"
          onClick={() => setIsMedicineStockModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-purple-50 p-3 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
              <Thermometer size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-purple-600 transition-colors" />
          </div>
          <div className="mt-6">
            <h4 className="text-2xl font-bold text-slate-900">{stats.totalMedicineStock.toLocaleString()} Items</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medicine Stock</p>
          </div>
        </div>

        {/* Abandoned Carts Card */}
        <div 
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between cursor-pointer hover:border-amber-200 transition-all hover:bg-amber-50/10 group"
          onClick={() => setIsAbandonedCartModalOpen(true)}
        >
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
              <ShoppingCart size={22} />
            </div>
            <ArrowUpRight size={16} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abandoned Carts ({stats.abandonedCartFarmers})</p>
              <h4 className="text-2xl font-bold text-slate-900">₹{abandonedCarts.reduce((sum, c) => sum + calculateCartTotal(c.items || []), 0).toLocaleString()}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm bg-white rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg">Assigned Farmers</CardTitle>
            <CardDescription>Farmers under your direct supervision</CardDescription>
          </CardHeader>
          <CardContent>
            {myFarmers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic font-medium">
                No farmers assigned yet.
              </div>
            ) : (
              <div className="space-y-4">
                {myFarmers.map(farmer => (
                  <div key={farmer.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-lg font-bold text-slate-400 border border-slate-100 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                        {farmer.name?.[0]}
                      </div>
                      <div>
                        <p 
                          className="font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                          onClick={() => viewFarmerBatches(farmer)}
                        >
                          {farmer.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <MapPin size={12} className="text-slate-400" />
                          <span>{farmer.district || 'Location not set'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-indigo-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => window.location.href = `tel:${farmer.phone}`}>
                        <Phone size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-emerald-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => window.location.href = `/manager/farmers?uid=${farmer.id}`}
                        title="Farmer Task"
                      >
                        <ClipboardList size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-amber-600 hover:bg-white hover:shadow-sm" 
                        onClick={() => handleSendResetLink(farmer)}
                        title="Send Password Reset Link"
                      >
                        <Mail size={18} />
                      </Button>
                      <Button 
                        nativeButton={false}
                        render={<Link to={`/manager/farmers?uid=${farmer.id}`}><ArrowUpRight size={18} /></Link>} 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full hover:bg-white hover:shadow-sm" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Abandoned Carts List View */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="text-amber-600" />
              Abandoned Cart List
            </CardTitle>
            <CardDescription>Review items and potential commissions</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-3">
                {abandonedCarts.map(cart => {
                   const f = myFarmers.find(x => x.id === cart.userId);
                   const total = calculateCartTotal(cart.items || []);
                   return (
                     <div key={cart.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <p className="font-bold text-slate-900">{f?.name || 'User'}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">₹{total.toLocaleString()} • {cart.items?.length || 0} items</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs rounded-xl" onClick={() => setSelectedCart(cart)}>
                           View Cart
                        </Button>
                     </div>
                   );
                })}
                {abandonedCarts.length === 0 && (
                   <div className="text-center py-10 italic text-slate-400">No abandoned carts found.</div>
                )}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* --- ALL POPUP MODALS --- */}

      {/* Abandoned Carts Farmers Modal */}
      <Dialog open={isAbandonedCartModalOpen} onOpenChange={setIsAbandonedCartModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[600px] bg-white overflow-hidden p-0">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <DialogHeader className="p-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <ShoppingBag className="text-amber-600" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 leading-none">Abandoned Carts</DialogTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Pending Checkouts</p>
                </div>
              </div>
            </DialogHeader>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Commission</p>
              <p className="text-xl font-black text-indigo-600">
                ₹{abandonedCarts.reduce((sum, cart) => sum + calculateCartCommission(cart.items || []), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
            {myFarmers.map(farmer => {
              const farmerCarts = abandonedCarts.filter(c => c.userId === farmer.id);
              if (farmerCarts.length === 0) return null;
              const totalValue = farmerCarts.reduce((sum, c) => sum + calculateCartTotal(c.items || []), 0);
              
              return (
                <div key={farmer.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:border-amber-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:text-amber-600 transition-colors">
                      {farmer.name?.[0]}
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 leading-none">{farmer.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{farmer.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">₹{totalValue.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{farmerCarts.length} Cart(s)</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedCart(farmerCarts[0]);
                        setIsAbandonedCartModalOpen(false);
                      }}
                      className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-6"
                    >
                      VIEW CART
                    </Button>
                  </div>
                </div>
              );
            })}
            {stats.abandonedCartFarmers === 0 && (
              <div className="py-20 text-center text-slate-300 italic">No abandoned carts found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Carts Modal (Detailed Info) */}
      <Dialog open={!!selectedCart} onOpenChange={(open) => { if(!open) setSelectedCart(null); }}>
        <DialogContent className="rounded-[2rem] max-w-lg border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
               <ShoppingCart className="text-amber-500" size={24} />
               Cart Details - {myFarmers.find(f => f.id === selectedCart?.userId)?.name || 'Summary'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
              {selectedCart?.items?.map((item: any) => {
                const product = products.find(p => p.id === item.id);
                return (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <Package size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{product?.name || 'Product'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.quantity} {product?.unit} × ₹{product?.price}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-slate-900">₹{(Number(product?.price || 0) * Number(item.quantity)).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            <div className="pt-6 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center px-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Cart Value</p>
                <p className="text-2xl font-black text-emerald-600">
                  ₹{selectedCart?.items ? (selectedCart.items as any[]).reduce((sum, item) => {
                    const product = products.find(p => p.id === item.id);
                    return sum + (Number(product?.price || 0) * Number(item.quantity));
                  }, 0).toLocaleString() : '0'}
                </p>
              </div>
              <div className="bg-indigo-50 p-6 rounded-[2rem] flex justify-between items-center group overflow-hidden relative border border-indigo-100">
                <div className="relative z-10">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Potential Commission</p>
                   <p className="text-4xl font-black text-indigo-600 italic">
                     ₹{selectedCart?.items ? calculateCartCommission(selectedCart.items).toLocaleString() : '0'}
                   </p>
                </div>
                <IndianRupee size={80} className="absolute -right-4 -bottom-4 text-indigo-100 opacity-50 group-hover:scale-110 transition-transform -rotate-12" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Farmer Batches Modal */}
      <Dialog open={!!selectedFarmerForBatches} onOpenChange={() => setSelectedFarmerForBatches(null)}>
        <DialogContent className="rounded-[3rem] max-w-lg backdrop-blur-xl bg-white/90">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Running Batches: {selectedFarmerForBatches?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {farmerBatches.length === 0 ? (
              <div className="py-20 text-center text-slate-400 italic">No active batches found.</div>
            ) : (
              farmerBatches.map(batch => (
                <div key={batch.id} className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl group transition-all hover:border-indigo-200">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h4 className="font-bold text-slate-900 text-lg">{batch.name}</h4>
                        <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-bold uppercase py-1">{batch.breed}</Badge>
                     </div>
                     <div className="text-right">
                        <p className="text-2xl font-black text-slate-900">{batch.currentCount?.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Birds</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                     <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-300"/> {batch.placementDate}</span>
                     <span className="flex items-center gap-1.5"><Bird size={14} className="text-slate-300"/> Age: {Math.floor((new Date().getTime() - new Date(batch.placementDate).getTime()) / (1000 * 60 * 60 * 24))} Days</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Critical Alerts Modal */}
      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black">
               <AlertTriangle className="text-red-500" size={28} />
               Critical Field Alerts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
            {logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).map(log => {
              const f = myFarmers.find(x => x.id === log.userId);
              const alerts = [];
              if (log.alerts?.feedDrop) alerts.push('Feed Drop');
              if (log.alerts?.mortalityIncrease) alerts.push('Mortality Spike');
              if (log.alerts?.eggDrop) alerts.push('Egg Drop');
              
              return (
                <div key={log.id} className="p-5 bg-red-50/50 border border-red-100 rounded-3xl hover:bg-red-50 transition-colors flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-500 shadow-sm">
                        <AlertTriangle size={20} />
                     </div>
                     <div>
                       <p className="text-sm font-black text-slate-900 underline decoration-red-200 underline-offset-4">{f?.name}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{log.farmName} • {log.date}</p>
                     </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {alerts.map(a => <Badge key={a} variant="destructive" className="text-[8px] font-black uppercase tracking-tighter rounded-lg h-5">{a}</Badge>)}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-lg hover:bg-red-100 ml-2" onClick={() => window.location.href = `tel:${f?.phone}`}>
                       <Phone size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
            {logs.filter(l => l.alerts?.feedDrop || l.alerts?.mortalityIncrease || l.alerts?.eggDrop).length === 0 && (
               <div className="py-20 text-center text-slate-300 italic flex flex-col items-center">
                  <ShieldCheck size={60} className="mb-4 opacity-20" />
                  <p className="text-lg font-bold">Safe Zone</p>
                  <p className="text-sm font-medium">No critical alerts detected in your assigned farms.</p>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Logs Modal */}
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Missing Daily Reports (Today)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
            {myFarmers.filter(f => !logs.some(l => l.userId === f.id && l.date === format(new Date(), 'yyyy-MM-dd'))).map(farmer => (
              <div key={farmer.id} className="flex justify-between items-center p-5 bg-amber-50/50 rounded-[2rem] border border-amber-100 hover:border-amber-300 transition-all group">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-slate-400 border border-amber-100 group-hover:text-amber-600 group-hover:scale-105 transition-all shadow-sm">
                      {farmer.name?.[0]}
                   </div>
                   <div>
                      <p className="text-base font-black text-slate-900 leading-none">{farmer.name}</p>
                      <p className="text-[10px] text-amber-600 font-bold uppercase mt-1 tracking-tighter">{farmer.district || 'Location N/A'}</p>
                   </div>
                </div>
                <Button size="sm" variant="ghost" className="rounded-2xl h-10 px-4 bg-white text-amber-600 font-black text-[10px] hover:bg-amber-100 border border-amber-100 shadow-sm" onClick={() => window.location.href = `tel:${farmer.phone}`}>
                   CALL NOW
                </Button>
              </div>
            ))}
            {stats.missingLogs === 0 && (
               <div className="py-20 text-center text-emerald-600 flex flex-col items-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                     <CheckCircle2 size={40} />
                  </div>
                  <p className="text-xl font-black">Report Integrity 100%</p>
                  <p className="text-sm font-medium">All farmers have submitted logs for today.</p>
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Flock Directory Modal */}
      <Dialog open={isFlockModalOpen} onOpenChange={setIsFlockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-5xl bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-indigo-900">Active Flock Directory</DialogTitle>
            <DialogDescription className="font-bold text-slate-400">Comprehensive list of all running batches across assigned farms</DialogDescription>
          </DialogHeader>
          <div className="py-6 max-h-[75vh] overflow-y-auto pr-4 no-scrollbar">
             <div className="space-y-4">
               {flocks.length === 0 ? (
                 <div className="py-20 text-center text-slate-400 italic">No active flocks currently tracked.</div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow className="border-none hover:bg-transparent">
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14">Flock Name & Breed</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14">Farmer / Owner</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-center">Age (Days)</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-right">Population</TableHead>
                       <TableHead className="font-black text-xs uppercase tracking-widest text-slate-400 h-14 text-right pr-6">Placement Date</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {flocks.map(flock => {
                        const owner = myFarmers.find(f => f.id === flock.userId);
                        const days = Math.ceil((new Date().getTime() - new Date(flock.placementDate).getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <TableRow key={flock.id} className="bg-white border-b-[6px] border-slate-50 rounded-2xl overflow-hidden hover:bg-indigo-50/30 transition-colors">
                            <TableCell className="py-5 font-black text-slate-900">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                                  <Bird size={18} />
                                </div>
                                <div>
                                  <p>{flock.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{flock.breed}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <p className="font-bold text-slate-700">{owner?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{owner?.district || 'Location N/A'}</p>
                            </TableCell>
                            <TableCell className="py-5 text-center">
                              <Badge className="bg-indigo-600 text-white rounded-lg font-black h-8 px-4">
                                Day {days}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-5 text-right">
                              <div className="font-black text-slate-900 text-lg">{flock.currentCount?.toLocaleString()}</div>
                              <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">Initial: {flock.initialCount?.toLocaleString()}</div>
                            </TableCell>
                            <TableCell className="py-5 text-right pr-6 font-bold text-slate-500 font-mono text-xs">
                              {flock.placementDate}
                            </TableCell>
                          </TableRow>
                        );
                     })}
                   </TableBody>
                 </Table>
               )}
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Birds Location Summary */}
      <Dialog open={isBirdsModalOpen} onOpenChange={setIsBirdsModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-4xl max-h-[85vh] overflow-y-auto">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black">Bird Inventory by Location</DialogTitle>
           </DialogHeader>
           <div className="py-6">
              <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 border-slate-100 h-14">
                       <TableHead className="font-black text-[11px] uppercase tracking-widest px-8">Farmer / District</TableHead>
                       <TableHead className="font-black text-[11px] uppercase tracking-widest text-center">Active Batches</TableHead>
                       <TableHead className="font-black text-[11px] uppercase tracking-widest text-right px-8">Available Birds</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {myFarmers.map(farmer => {
                        const farmerFlocks = flocks.filter(f => f.userId === farmer.id);
                        const birdsCount = farmerFlocks.reduce((sum, f) => sum + (f.currentCount || 0), 0);
                        if (birdsCount === 0) return null;
                        return (
                           <TableRow key={farmer.id} className="border-slate-50 hover:bg-slate-50 transition-colors h-16 group">
                              <TableCell className="px-8 font-medium">
                                 <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{farmer.name}</p>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{farmer.district || 'Remote'}</p>
                              </TableCell>
                              <TableCell className="text-center font-black text-slate-400 text-lg group-hover:text-slate-900">{farmerFlocks.length}</TableCell>
                              <TableCell className="text-right px-8">
                                 <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-lg">
                                  {birdsCount.toLocaleString()}
                                 </span>
                              </TableCell>
                           </TableRow>
                        );
                     })}
                  </TableBody>
                </Table>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Feed Stock drill-down Modal */}
      <Dialog open={isFeedStockModalOpen} onOpenChange={setIsFeedStockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-3xl">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-2xl font-black text-orange-600">
                <Package size={28} />
                Managed Feed Inventory
             </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
             {myFarmers.map(farmer => {
                const farmerStocks = feedStocks.filter(s => s.userId === farmer.id);
                const total = farmerStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                if (total === 0) return null;

                return (
                  <div key={farmer.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center group hover:bg-orange-50 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-300 group-hover:text-orange-500">
                           {farmer.name?.[0]}
                        </div>
                        <div>
                           <p className="text-base font-black text-slate-900">{farmer.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer.district || 'Allotted District'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <p className="text-xl font-black text-slate-900">{total.toLocaleString()} KG</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{farmerStocks.length} Items</p>
                        </div>
                        <Button 
                           variant="outline" 
                           onClick={() => {
                             setSelectedFarmerForStock(farmer);
                             setStockType('feed');
                           }}
                           className="rounded-xl border-orange-200 text-orange-600 font-black text-[10px] px-4"
                        >
                           DETAILS
                        </Button>
                     </div>
                  </div>
                );
             })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Medicine Stock drill-down Modal */}
      <Dialog open={isMedicineStockModalOpen} onOpenChange={setIsMedicineStockModalOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-3xl">
          <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-2xl font-black text-purple-600">
                <Thermometer size={28} />
                Managed Medicine Inventory
             </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
             {myFarmers.map(farmer => {
                const farmerStocks = medicineStocks.filter(s => s.userId === farmer.id);
                const total = farmerStocks.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                if (total === 0) return null;

                return (
                  <div key={farmer.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex justify-between items-center group hover:bg-purple-50 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-300 group-hover:text-purple-500">
                           {farmer.name?.[0]}
                        </div>
                        <div>
                           <p className="text-base font-black text-slate-900">{farmer.name}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">{farmer.district || 'Allotted District'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="text-right">
                           <p className="text-xl font-black text-slate-900">{total.toLocaleString()} Items</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{farmerStocks.length} Categories</p>
                        </div>
                        <Button 
                           variant="outline" 
                           onClick={() => {
                             setSelectedFarmerForStock(farmer);
                             setStockType('medicine');
                           }}
                           className="rounded-xl border-purple-200 text-purple-600 font-black text-[10px] px-4"
                        >
                           DETAILS
                        </Button>
                     </div>
                  </div>
                );
             })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deep Stock Detail Modal */}
      <Dialog open={!!selectedFarmerForStock} onOpenChange={() => setSelectedFarmerForStock(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-3xl">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black">
                 {stockType === 'feed' ? 'Feed Inventory' : 'Medicine Inventory'}: {selectedFarmerForStock?.name}
              </DialogTitle>
           </DialogHeader>
           <div className="py-4">
              <Table>
                 <TableHeader>
                    <TableRow className="border-slate-100">
                       <TableHead className="font-bold">Item Name</TableHead>
                       {stockType === 'medicine' && <TableHead className="font-bold">Type</TableHead>}
                       <TableHead className="font-bold text-right">Quantity</TableHead>
                       <TableHead className="font-bold text-right pr-6">Cost</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    {(stockType === 'feed' ? feedStocks : medicineStocks)
                      .filter(s => s.userId === selectedFarmerForStock?.id)
                      .map(item => (
                        <TableRow key={item.id} className="border-slate-50">
                           <TableCell className="font-bold text-slate-900 py-4">{item.name}</TableCell>
                           {stockType === 'medicine' && (
                             <TableCell>
                               <Badge variant="secondary" className="bg-slate-100 text-[9px] font-bold uppercase">{item.type}</Badge>
                             </TableCell>
                           )}
                           <TableCell className="text-right font-black">
                             {item.quantity?.toLocaleString()} {item.unit || (stockType === 'feed' ? 'KG' : 'units')}
                           </TableCell>
                           <TableCell className="text-right pr-6 font-bold text-emerald-600">
                             ₹{Number(item.purchaseCost || 0).toLocaleString()}
                           </TableCell>
                        </TableRow>
                      ))
                    }
                 </TableBody>
              </Table>
           </div>
        </DialogContent>
      </Dialog>

      {/* Mortality Insights */}
      <Dialog open={isMortalityModalOpen} onOpenChange={(open) => { setIsMortalityModalOpen(open); if(!open) setSelectedFarmerForMortality(null); }}>
        <DialogContent className="rounded-[3rem] max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-rose-600">
               <Thermometer size={32} />
               Mortality Trend Analysis
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
             {!selectedFarmerForMortality ? (
                <div className="space-y-3">
                  {myFarmers.map(farmer => {
                    const farmerLogs = logs.filter(l => l.userId === farmer.id && (Number(l.health?.mortality) || 0) > 0);
                    const totalMortality = farmerLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
                    if (totalMortality === 0) return null;

                    return (
                      <div 
                        key={farmer.id} 
                        className="p-6 bg-rose-50/50 border border-rose-100 rounded-[2rem] flex justify-between items-center group cursor-pointer hover:bg-rose-50 transition-all shadow-sm"
                        onClick={() => setSelectedFarmerForMortality(farmer)}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-rose-100 flex items-center justify-center font-black text-rose-600 shadow-sm group-hover:scale-110 transition-transform">
                               {farmer.name?.[0]}
                            </div>
                            <div>
                               <p className="text-lg font-black text-slate-900 leading-none">{farmer.name}</p>
                               <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">Total {totalMortality} Deaths</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 text-rose-600 font-black text-[10px] bg-white px-4 py-2 rounded-xl border border-rose-100 group-hover:bg-rose-600 group-hover:text-white transition-all">
                            VIEW BATCHES
                            <ArrowUpRight size={14} />
                         </div>
                      </div>
                    );
                  })}
                  {logs.filter(l => (Number(l.health?.mortality) || 0) > 0).length === 0 && (
                    <div className="py-20 text-center text-slate-300 italic">No mortality reports found.</div>
                  )}
                </div>
             ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[2rem] border border-slate-100 mb-4">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFarmerForMortality(null)} className="rounded-full text-slate-400">
                      <ArrowUpRight className="rotate-180" size={20} />
                    </Button>
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">Farmer Statistics</p>
                      <p className="text-xl font-black text-slate-900">{selectedFarmerForMortality.name}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const farmerFlocks = flocks.filter(f => f.userId === selectedFarmerForMortality.id);
                      return farmerFlocks.map(flock => {
                        const flockLogs = logs.filter(l => l.flockId === flock.id);
                        const flockMortality = flockLogs.reduce((sum, l) => sum + (Number(l.health?.mortality) || 0), 0);
                        const mortalityRate = flock.initialCount > 0 ? ((flockMortality / flock.initialCount) * 100).toFixed(2) : 0;
                        
                        return (
                          <div key={flock.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-black text-slate-900 text-lg">{flock.name}</h4>
                                <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-bold uppercase">{flock.breed}</Badge>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black text-rose-600">{flockMortality}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Mortality</p>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-rose-50/50 rounded-2xl flex justify-between items-center">
                              <p className="text-xs font-bold text-rose-700">Mortality Percentage</p>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-rose-600 text-lg">{mortalityRate}%</span>
                                {Number(mortalityRate) > 5 && <AlertTriangle size={16} className="text-rose-600 animate-pulse" />}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                               <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between">
                                  <span>Initial</span>
                                  <span className="text-slate-900">{flock.initialCount?.toLocaleString()}</span>
                               </div>
                               <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between">
                                  <span>Current</span>
                                  <span className="text-slate-900">{flock.currentCount?.toLocaleString()}</span>
                               </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mortality Approval Action Modal */}
      <Dialog open={isMortalityApprovalOpen} onOpenChange={setIsMortalityApprovalOpen}>
        <DialogContent className="rounded-[3rem] max-w-2xl bg-slate-50">
           <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black text-emerald-700">
                 <ShieldCheck size={32} />
                 Mortality Verification Queue
              </DialogTitle>
              <DialogDescription className="font-bold text-slate-400">Review pending mortality updates before they are finalized in the system</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {logs.filter(l => (Number(l.health?.mortality) || 0) > 0 && l.approved === false).map(log => {
                 const owner = myFarmers.find(f => f.id === log.userId);
                 return (
                    <div key={log.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/20 flex flex-col gap-6 scale-up">
                       <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                             <div className="w-16 h-16 rounded-[2rem] bg-rose-50 flex items-center justify-center text-rose-600 shrink-0 border border-rose-100 shadow-inner">
                                <AlertTriangle size={32} />
                             </div>
                             <div>
                                <p className="text-lg font-black text-slate-900 leading-tight">{owner?.name || 'Farmer'}</p>
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">MORTALITY: {log.health?.mortality} BIRDS</p>
                             </div>
                          </div>
                          <Badge className="bg-slate-100 text-slate-400 border-none font-bold text-[9px] px-3 h-6 rounded-lg uppercase">{log.date}</Badge>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Farmer Observation</p>
                          <p className="text-sm text-slate-600 font-bold italic line-clamp-3">
                             {log.health?.symptoms ? `"${log.health.symptoms}"` : 'No symptoms reported by the farmer for this event.'}
                          </p>
                       </div>
                       <div className="flex gap-3 pt-2">
                          <Button className="flex-[2] rounded-[1.5rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-14 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1 active:translate-y-0" onClick={() => handleApproveMortality(log.id)}>
                             APPROVE LOG
                          </Button>
                          <Button variant="outline" className="flex-1 rounded-[1.5rem] border-slate-200 text-slate-400 font-black text-xs h-14 bg-slate-50 hover:bg-white hover:text-slate-600" onClick={() => window.location.href = `tel:${owner?.phone}`}>
                             CALL
                          </Button>
                       </div>
                    </div>
                 );
              })}
              {logs.filter(l => (Number(l.health?.mortality) || 0) > 0 && l.approved === false).length === 0 && (
                 <div className="py-20 text-center flex flex-col items-center">
                    <div className="w-24 h-24 bg-white rounded-[2.5rem] border border-slate-100 shadow-inner flex items-center justify-center mb-6">
                       <ShieldCheck size={48} className="text-emerald-300 opacity-50" />
                    </div>
                    <p className="text-xl font-black text-slate-900">Verification Queue Clear</p>
                    <p className="text-sm font-bold text-slate-400 mt-1 max-w-[250px] mx-auto">All mortality entries have been reviewed and verified for your team.</p>
                 </div>
              )}
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerDashboard;
