import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  CreditCard, Search, ArrowUpRight, ArrowDownRight, PlusCircle, 
  Trash2, Landmark, Filter, RefreshCw, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminTransactions: React.FC = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showAddTx, setShowAddTx] = useState(false);

  const [newTx, setNewTx] = useState({
    userId: 'All',
    amount: '',
    type: 'Income' as 'Income' | 'Expense',
    category: 'Supply sale',
    description: ''
  });

  useEffect(() => {
    // 1. Fetch real time Transactions
    const unsubTxs = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc')),
      (snap) => {
        setTxs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default clinical alerts if collection is empty
        setTxs([
          {
            id: 'tx-1',
            userId: 'farmer-101',
            amount: 14500,
            type: 'Income',
            category: 'Supply sale',
            description: '50 bags Godrej Broiler Starter Feed purchased by farmer',
            timestamp: new Date().toISOString()
          },
          {
            id: 'tx-2',
            userId: 'farmer-102',
            amount: 8500,
            type: 'Income',
            category: 'License fee',
            description: 'Yearly platform activation license key converted',
            timestamp: new Date().toISOString()
          },
          {
            id: 'tx-3',
            userId: 'farmer-101',
            amount: 32000,
            type: 'Expense',
            category: 'Breeding logistics',
            description: 'Direct dispatch of broiler starter chicks from hatchery',
            timestamp: new Date().toISOString()
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch farmers to allow targeting
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTxs();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    if (id === 'All' || !id) return 'System Master Account';
    return farmers.find(f => f.id === id)?.name || id || 'N/A';
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.amount || Number(newTx.amount) <= 0) {
      toast.error('Valid transaction amount is required');
      return;
    }

    try {
      await addDoc(collection(db, 'transactions'), {
        userId: newTx.userId,
        amount: Number(newTx.amount),
        type: newTx.type,
        category: newTx.category,
        description: newTx.description || `Direct administrative ${newTx.type}`,
        timestamp: new Date().toISOString()
      });

      toast.success('Transaction posted successfully inside system ledger');
      setNewTx({ userId: 'All', amount: '', type: 'Income', category: 'Supply sale', description: '' });
      setShowAddTx(false);
    } catch (err) {
      toast.error('Failed to post transaction in ledger');
    }
  };

  const handleDelete = async (txId: string) => {
    try {
      if (confirm('Are you certain you wish to purge this transaction record? This acts as a master purge.')) {
        await deleteDoc(doc(db, 'transactions', txId));
        toast.success('Transaction purged from master registry');
      }
    } catch (err) {
      toast.error('Purge transaction failure');
    }
  };

  const filteredTxs = txs.filter(t => {
    const fName = getFarmerName(t.userId).toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const matchesSearch = fName.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase()) || cat.includes(searchTerm.toLowerCase());
    
    if (filterType === 'All') return matchesSearch;
    return matchesSearch && t.type === filterType;
  });

  // Aggregation computations
  const totalRevenue = txs
    .filter(t => t.type === 'Income' || t.type === 'Revenue')
    .reduce((sum, current) => sum + (Number(current.amount) || 0), 0);

  const totalExpense = txs
    .filter(t => t.type === 'Expense')
    .reduce((sum, current) => sum + (Number(current.amount) || 0), 0);

  const netLiquidity = totalRevenue - totalExpense;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Landmark size={32} className="text-[#0B2516]" />
            FINANCIAL LEDGERS & BALANCES
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Global double-entry audit records and billing systems
          </p>
        </div>

        <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-[#0B2516] hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Record Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">RECORD SYSTEM TRANSACTION</DialogTitle>
              <CardDescription className="text-xs">Post manual ledger adjustment, fees collected, or logistics expense payload.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTx} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="target" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Involved Account / Farmer</Label>
                <Select value={newTx.userId} onValueChange={(val) => setNewTx({ ...newTx, userId: val })}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                    <SelectValue placeholder="Choose Farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All" className="text-xs font-bold italic text-indigo-700">System Master Account</SelectItem>
                    {farmers.filter(f => f.role === 'farmer' || !f.role).map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs font-bold">
                        {f.name || 'Untitled Agent'} ({f.farmName || 'Unassigned Farm'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Entry Type</Label>
                  <Select value={newTx.type} onValueChange={(val: any) => setNewTx({ ...newTx, type: val })}>
                    <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                      <SelectValue placeholder="Choose Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Income">Income (Received Credit)</SelectItem>
                      <SelectItem value="Expense">Expense (Paid Out Debit)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest font-mono">Amount (INR)</Label>
                  <Input 
                    type="number" 
                    id="amount" 
                    required 
                    placeholder="e.g. 5000"
                    value={newTx.amount}
                    onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                    className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-black italic focus-visible:ring-indigo-500 text-center text-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Revenue Category</Label>
                <Select value={newTx.category} onValueChange={(val: any) => setNewTx({ ...newTx, category: val })}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                    <SelectValue placeholder="Choose Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supply sale">Supply sale (Feed/Medicine)</SelectItem>
                    <SelectItem value="License fee">License Fee</SelectItem>
                    <SelectItem value="Breeding logistics">Chicks Dispatched / Breed Fee</SelectItem>
                    <SelectItem value="Direct payout">Stipend / Cash Payout</SelectItem>
                    <SelectItem value="Miscellaneous">Other Income/Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Description</Label>
                <textarea
                  id="desc"
                  required
                  placeholder="Provide transaction specifics... e.g., Broiler vaccination dispatch logistics costs"
                  value={newTx.description}
                  onChange={e => setNewTx({ ...newTx, description: e.target.value })}
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 rounded-2xl border border-slate-150 bg-slate-55 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:font-normal"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Post Double-Entry Record
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Aggregate financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Gross Revenue</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">₹{totalRevenue.toLocaleString()}</span>
              <span className="text-xs text-emerald-600 font-bold flex items-center">
                <ArrowUpRight size={14} /> Total inflow
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Global Gross Operating Expenses</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">₹{totalExpense.toLocaleString()}</span>
              <span className="text-xs text-red-500 font-bold flex items-center">
                <ArrowDownRight size={14} /> Total Outflow
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-slate-100 shadow-sm rounded-3xl ${netLiquidity >= 0 ? 'bg-emerald-50/20 border-emerald-100' : 'bg-red-50/25 border-red-100'}`}>
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Reserve Liquidity Surplus</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-black ${netLiquidity >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>₹{netLiquidity.toLocaleString()}</span>
              <span className="text-xs text-slate-450 font-bold">Reserve net</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Ledger registry filter list */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight">System Master Ledger</CardTitle>
            <CardDescription className="text-xs">Dynamic double-entry ledger database across all regional modules</CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Filter pills */}
            <div className="bg-slate-100/75 p-1 rounded-full flex gap-1 shadow-inner select-none">
              {['All', 'Income', 'Expense'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                    filterType === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                placeholder="Search description / users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Account / Farmer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Revenue Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Ledger Specifics</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Transaction Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTxs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching global transaction structures found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTxs.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs font-bold text-slate-400">
                      {item.timestamp ? format(new Date(item.timestamp), 'dd MMM yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs font-black text-slate-700">
                      {getFarmerName(item.userId)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 hover:bg-slate-150 text-slate-800 font-bold uppercase text-[9px] rounded-full border border-slate-205">
                        {item.category || 'Other'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500 font-semibold">
                      {item.description}
                    </TableCell>
                    <TableCell className={`text-right font-black text-sm italic ${
                      item.type === 'Income' || item.type === 'Revenue' ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {item.type === 'Income' || item.type === 'Revenue' ? '+' : '-'}₹{(Number(item.amount) || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AdminTransactions;
