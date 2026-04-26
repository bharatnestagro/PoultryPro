import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  History, 
  CheckCircle2, 
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Briefcase,
  Shield,
  ShoppingBag
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  getDocs,
  where,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ManagerPayment {
  id: string;
  managerId: string;
  managerName: string;
  amount: number;
  date: any;
  status: 'Paid' | 'Processing' | 'Pending';
  description: string;
}

interface ManagerEarning {
  id: string;
  name: string;
  totalEarned: number;
  totalPaid: number;
  pendingBalance: number;
  assignedFarmers: number;
}

const AdminPayments: React.FC = () => {
  const [managers, setManagers] = useState<ManagerEarning[]>([]);
  const [payments, setPayments] = useState<ManagerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isCommissionConfigOpen, setIsCommissionConfigOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [managerCommissions, setManagerCommissions] = useState<Record<string, { value: number, type: 'fixed' | 'percentage' }>>({});
  const [isSavingCommission, setIsSavingCommission] = useState(false);
  const [newPayment, setNewPayment] = useState({
    managerId: '',
    amount: '',
    description: ''
  });

  const fetchShopItemsAndCommissions = async (managerId: string) => {
    try {
      const shopSnap = await getDocs(collection(db, 'shopItems'));
      const items = shopSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopItems(items);

      const commDoc = await getDoc(doc(db, 'managerCommissions', managerId));
      if (commDoc.exists()) {
        const data = commDoc.data().productCommissions || {};
        // Migration: handle old flat number format
        const formattedData: Record<string, { value: number, type: 'fixed' | 'percentage' }> = {};
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (typeof val === 'number') {
            formattedData[key] = { value: val, type: 'fixed' };
          } else {
            formattedData[key] = val;
          }
        });
        setManagerCommissions(formattedData);
      } else {
        setManagerCommissions({});
      }
    } catch (error) {
      console.error("Error fetching items/commissions:", error);
    }
  };

  const handleOpenCommissionConfig = (manager: any) => {
    setSelectedManager(manager);
    fetchShopItemsAndCommissions(manager.id);
    setIsCommissionConfigOpen(true);
  };

  const handleSaveProductCommissions = async () => {
    if (!selectedManager) return;
    setIsSavingCommission(true);
    try {
      await setDoc(doc(db, 'managerCommissions', selectedManager.id), {
        managerId: selectedManager.id,
        managerName: selectedManager.name,
        productCommissions: managerCommissions,
        updatedAt: serverTimestamp()
      });
      toast.success('Commissions updated successfully');
      setIsCommissionConfigOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update commissions');
    } finally {
      setIsSavingCommission(false);
    }
  };

  useEffect(() => {
    // Fetch Managers & Calculate Stats
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'manager')), 
      async (snapshot) => {
        try {
          const managerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          // Fetch all farmers
          const usersSnap = await getDocs(collection(db, 'users'));
          const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          const allFarmers = allUsers.filter((u: any) => u.role === 'farmer' || !u.role);
          
          // Fetch additional collections needed for calculation
          const ordersSnap = await getDocs(collection(db, 'orders'));
          const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const commsSnap = await getDocs(collection(db, 'managerCommissions'));
          const allCommissions = commsSnap.docs.reduce((acc, d) => {
            acc[d.id] = d.data().productCommissions || {};
            return acc;
          }, {} as Record<string, any>);

          // Fetch all payments to calculate totals
          const paymentsSnap = await getDocs(collection(db, 'managerPayments'));
          const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

          const earnings = managerList.map(m => {
            const assignedFarmers = allFarmers.filter(f => f.managerId === m.id || f.assignedManagerId === m.id);
            const farmerIds = assignedFarmers.map(f => f.id);
            const managerOrders = orders.filter(o => {
              const isFarmerAssigned = farmerIds.includes(o.userId);
              const isDirectlyAssigned = o.assignedManagerId === m.id;
              const isNotCancelled = o.status !== 'Cancelled';
              return (isFarmerAssigned || isDirectlyAssigned) && isNotCancelled;
            });
            
            const managerComms = allCommissions[m.id] || {};
            
            let totalEarned = 0;
            managerOrders.forEach(order => {
              order.items?.forEach((item: any) => {
                const commConfig = managerComms[item.id];
                if (commConfig) {
                  const quantity = Number(item.quantity) || 1;
                  const price = Number(item.price) || 0;
                  
                  if (typeof commConfig === 'number') {
                    // Legacy support
                    totalEarned += commConfig * quantity;
                  } else if (commConfig.type === 'percentage') {
                    totalEarned += (price * quantity * commConfig.value) / 100;
                  } else {
                    // fixed
                    totalEarned += commConfig.value * quantity;
                  }
                }
              });
            });

            const managerTotalPaid = allPayments
              .filter(p => p.managerId === m.id && p.status === 'Paid')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            
            return {
              id: m.id,
              name: m.name || m.email,
              totalEarned,
              totalPaid: managerTotalPaid,
              pendingBalance: totalEarned - managerTotalPaid,
              assignedFarmers: assignedFarmers.length
            };
          });

          setManagers(earnings);
        } catch (error) {
          console.error("Error in managers snapshot process:", error);
          toast.error("Failed to sync manager data");
        }
      },
      (error) => {
        console.error("Snapshot error (users):", error);
        toast.error("Permission denied or connection error");
        setLoading(false);
      }
    );

    // Fetch Payment History
    const unsubPayments = onSnapshot(
      query(collection(db, 'managerPayments'), orderBy('date', 'desc')), 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date()
        } as any));
        setPayments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Snapshot error (payments):", error);
        // If sorting fails (e.g. index missing), try fetching without sort
        setLoading(false);
      }
    );

    return () => {
      unsubUsers();
      unsubPayments();
    };
  }, []);

  const handleAddPayment = async () => {
    if (!newPayment.managerId || !newPayment.amount || !newPayment.description) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const manager = managers.find(m => m.id === newPayment.managerId);
      await addDoc(collection(db, 'managerPayments'), {
        managerId: newPayment.managerId,
        managerName: manager?.name || 'Unknown',
        amount: Number(newPayment.amount),
        description: newPayment.description,
        status: 'Paid',
        date: serverTimestamp()
      });

      toast.success('Payment recorded successfully');
      setIsAddPaymentOpen(false);
      setNewPayment({ managerId: '', amount: '', description: '' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to record payment');
    }
  };

  const filteredManagers = managers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>;
  }

  const totals = {
    totalEarned: managers.reduce((sum, m) => sum + m.totalEarned, 0),
    totalPaid: managers.reduce((sum, m) => sum + m.totalPaid, 0),
    totalPending: managers.reduce((sum, m) => sum + m.pendingBalance, 0)
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* Commission Config Full Page Overlay */}
      {isCommissionConfigOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-600 text-white rounded-3xl shadow-lg">
                <Shield size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Manager Product Commissions</h2>
                <p className="text-slate-500 font-medium tracking-wide uppercase text-xs mt-1">Configure earnings for {selectedManager?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsCommissionConfigOpen(false)}
                className="rounded-2xl px-8 h-12 font-bold text-slate-400 hover:bg-slate-50"
              >
                Close Without Saving
              </Button>
              <Button 
                className="bg-[#122B21] text-white rounded-2xl px-12 h-14 font-bold shadow-2xl shadow-emerald-900/40 hover:bg-[#122B21]/90"
                onClick={handleSaveProductCommissions}
                disabled={isSavingCommission}
              >
                {isSavingCommission ? 'Saving...' : 'Confirm & Save All Changes'}
              </Button>
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
            <div className="max-w-7xl mx-auto space-y-4 pb-20">
              <div className="grid grid-cols-12 px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 sticky top-0 bg-white rounded-2xl shadow-sm z-10 border border-slate-100">
                <div className="col-span-1">Preview</div>
                <div className="col-span-5">Product Details</div>
                <div className="col-span-3 text-center">Commission Type</div>
                <div className="col-span-3 text-right">Commission Value</div>
              </div>

              {shopItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 items-center p-6 rounded-[2.5rem] bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all group">
                  <div className="col-span-1">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-slate-300 font-bold text-xl">{item.name[0]}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-5 pl-4">
                    <p className="font-bold text-xl text-slate-900 group-hover:text-emerald-600 transition-colors uppercase">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase border-none">{item.category}</Badge>
                      <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">₹{item.price.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="col-span-3 flex justify-center">
                    <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                      <button
                        onClick={() => setManagerCommissions({
                          ...managerCommissions,
                          [item.id]: { value: managerCommissions[item.id]?.value || 0, type: 'fixed' }
                        })}
                        className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                          (managerCommissions[item.id]?.type || 'fixed') === 'fixed'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-400'
                        }`}
                      >
                        Fixed (₹)
                      </button>
                      <button
                        onClick={() => setManagerCommissions({
                          ...managerCommissions,
                          [item.id]: { value: managerCommissions[item.id]?.value || 0, type: 'percentage' }
                        })}
                        className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                          managerCommissions[item.id]?.type === 'percentage'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-400'
                        }`}
                      >
                        Percentage (%)
                      </button>
                    </div>
                  </div>

                  <div className="col-span-3 flex justify-end">
                    <div className="relative w-48">
                      <Input 
                        type="number"
                        placeholder="0.00"
                        className="h-14 rounded-2xl text-right font-mono text-xl font-bold pr-12 focus:ring-emerald-500"
                        value={managerCommissions[item.id]?.value || ''}
                        onChange={(e) => setManagerCommissions({
                          ...managerCommissions,
                          [item.id]: { 
                            value: Number(e.target.value), 
                            type: managerCommissions[item.id]?.type || 'fixed' 
                          }
                        })}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">
                        {managerCommissions[item.id]?.type === 'percentage' ? '%' : '₹'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {shopItems.length === 0 && (
                <div className="py-40 text-center">
                  <ShoppingBag size={80} className="mx-auto text-slate-100 mb-4" />
                  <p className="text-slate-400 font-bold text-2xl">No products found in the shop.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Commission & Payments</h2>
          <p className="text-slate-500 font-medium mt-1">Manage field manager earnings and payout history</p>
        </div>
        <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
          <DialogTrigger render={
            <Button className="bg-[#122B21] hover:bg-[#122B21]/90 text-white rounded-2xl px-6 py-6 h-auto transition-all shadow-lg hover:shadow-emerald-900/20 group">
              <Plus className="mr-2 group-hover:rotate-90 transition-transform" />
              Record New Payment
            </Button>
          } />
          <DialogContent className="max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Manager</Label>
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={newPayment.managerId}
                  onChange={(e) => setNewPayment({...newPayment, managerId: e.target.value})}
                >
                  <option value="">Choose a manager...</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Bal: {m.pendingBalance})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="rounded-xl p-6"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Description / Note</Label>
                <Input 
                  placeholder="e.g. Monthly Commission - April" 
                  className="rounded-xl p-6"
                  value={newPayment.description}
                  onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsAddPaymentOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddPayment}
                className="bg-[#122B21] text-white rounded-xl px-8"
              >
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 border-none shadow-sm bg-[#122B21] text-white rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute right-0 top-0 p-8 opacity-10">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100/60 text-xs font-bold uppercase tracking-widest mb-2">Total Commission Earned</p>
            <h3 className="text-4xl font-bold font-mono text-emerald-400">₹{totals.totalEarned.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-200/50">
              <Users size={14} />
              <span>Across {managers.length} managers</span>
            </div>
          </div>
        </Card>

        <Card className="p-8 border-none shadow-sm bg-white rounded-[2.5rem] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <DollarSign size={24} />
            </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold">Verified</Badge>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Paid Out</p>
          <h3 className="text-4xl font-bold text-slate-900 font-mono">₹{totals.totalPaid.toLocaleString()}</h3>
        </Card>

        <Card className="p-8 border-none shadow-sm bg-white rounded-[2.5rem] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <History size={24} />
            </div>
            {totals.totalPending > 0 && <Badge className="bg-red-50 text-red-600 border-none animate-pulse">Action Required</Badge>}
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Pending Balance</p>
          <h3 className="text-4xl font-bold text-slate-900 font-mono">₹{totals.totalPending.toLocaleString()}</h3>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Manager Summary */}
        <div className="lg:col-span-12">
          <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Manager Earnings Ledger</h3>
                <p className="text-sm text-slate-400 font-medium">Detailed breakdown by assigned portfolio</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Search manager..." 
                  className="pl-10 rounded-2xl bg-slate-50 border-none w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="px-8 font-bold text-slate-400 text-[11px] uppercase tracking-widest">Manager</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Portfolio Size</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Total Earned</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Paid to Date</TableHead>
                    <TableHead className="px-8 text-right font-bold text-slate-400 text-[11px] uppercase tracking-widest">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManagers.map(m => (
                    <TableRow key={m.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="px-8 py-6">
                        <div 
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => handleOpenCommissionConfig(m)}
                        >
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            {m.name[0]}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block group-hover:text-emerald-600 transition-colors">{m.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Configure Commissions</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-lg border-slate-200 text-slate-600 font-bold">
                          {m.assignedFarmers} Farmers
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">₹{m.totalEarned.toLocaleString()}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-600">₹{m.totalPaid.toLocaleString()}</TableCell>
                      <TableCell className="px-8 text-right">
                        <Badge className={`rounded-xl px-4 py-1 border-none font-bold ${
                          m.pendingBalance > 1000 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          ₹{m.pendingBalance.toLocaleString()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-12">
          <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Recent Payouts</h3>
                <p className="text-sm text-slate-400 font-medium">History of manager commission transfers</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="px-8 font-bold text-slate-400 text-[11px] uppercase tracking-widest">Date</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Manager</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Amount</TableHead>
                    <TableHead className="font-bold text-slate-400 text-[11px] uppercase tracking-widest">Status</TableHead>
                    <TableHead className="px-8 font-bold text-slate-400 text-[11px] uppercase tracking-widest">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id} className="hover:bg-slate-50/30">
                      <TableCell className="px-8 py-5 text-sm font-medium text-slate-500">
                        {format(p.date, 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">{p.managerName}</TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">₹{p.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500 text-white border-none rounded-lg px-3 py-1 font-bold">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 text-sm text-slate-400 font-medium italic">{p.description}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center text-slate-300 italic font-medium">
                        No payment history found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
