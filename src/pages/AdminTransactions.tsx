import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PieChart
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { useSearchParams } from 'react-router-dom';

const AdminTransactions: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sourceFilter = searchParams.get('source'); // 'farmer' or 'shop'
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      toast.success('Transaction deleted');
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const filteredTransactions = transactions.filter(t => {
    // Apply source filter if present
    if (sourceFilter) {
      // If we don't have a source field yet, we'll assume farmer ones don't have it or have 'farmer'
      // And we'll start tagging shop ones.
      const tSource = t.source || 'farmer';
      if (tSource !== sourceFilter) return false;
    }

    const matchesSearch = (t.farmerName?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '') ||
      (t.category?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '') ||
      (t.description?.toLowerCase() || '').includes(searchTerm?.toLowerCase() || '');
    
    return matchesSearch;
  });

  const stats = {
    revenue: filteredTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0),
    expenses: filteredTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0),
    pending: filteredTransactions.filter(t => t.status === 'Pending').reduce((sum, t) => sum + t.amount, 0)
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            {sourceFilter === 'shop' ? 'Shop Transactions' : sourceFilter === 'farmer' ? 'Farmer Transactions' : 'Transactions & Finance'}
          </h1>
          <p className="text-slate-500 font-medium">
            {sourceFilter === 'shop' 
              ? 'View and manage financial records specifically for the supply shop.' 
              : 'Track revenue, expenses, and financial health across the farm network.'}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200 flex items-center gap-2 bg-white">
          <Download size={18} />
          <span>Financial Report</span>
        </Button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px] font-bold">+12.5%</Badge>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL REVENUE</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{stats.revenue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-red-50 p-3 rounded-2xl text-red-600">
              <TrendingDown size={24} />
            </div>
            <Badge className="bg-red-100 text-red-700 border-none text-[10px] font-bold">+4.2%</Badge>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL EXPENSES</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{stats.expenses.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NET PROFIT</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{(stats.revenue - stats.expenses).toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
              <CreditCard size={24} />
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENDING PAYMENTS</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{stats.pending.toLocaleString()}</h3>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Search by farmer, category, or description..." 
            className="pl-12 h-14 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="rounded-2xl h-14 px-6 border-slate-200 bg-white flex items-center gap-2">
          <Filter size={18} />
          <span>Filters</span>
        </Button>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">DATE</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FARMER / ENTITY</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TYPE</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CATEGORY</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AMOUNT</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">Loading transactions...</TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-slate-400">No transactions found</TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((t) => (
                <TableRow key={t.id} className="group border-slate-50">
                  <TableCell className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-900">{format(new Date(t.date), 'MMM dd, yyyy')}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold text-slate-900">{t.farmerName || 'System'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-none rounded-lg text-[10px] font-bold px-2 py-1 ${
                      t.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.type?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-500 font-medium">{t.category}</p>
                  </TableCell>
                  <TableCell>
                    <p className={`text-xs font-bold ${t.type === 'Income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'Income' ? '+' : '-'} ₹{t.amount.toLocaleString()}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={`border-none rounded-lg text-[10px] font-bold px-2 py-1 ${
                      t.status === 'Completed' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.status?.toUpperCase() || 'PENDING'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" />}>
                        <MoreHorizontal size={18} className="text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer">
                          <Edit2 size={16} />
                          Edit Transaction
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 size={16} />
                          Delete Transaction
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminTransactions;
