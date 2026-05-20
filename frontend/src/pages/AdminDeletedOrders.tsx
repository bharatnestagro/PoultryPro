import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Trash2, Search, RotateCcw, ShieldX, CheckCircle, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminDeletedOrders: React.FC = () => {
  const [deletedOrders, setDeletedOrders] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 1. Fetch Deleted Orders
    const unsub = onSnapshot(
      collection(db, 'deletedOrders'),
      (snap) => {
        setDeletedOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        setDeletedOrders([
          {
            id: 'mock-del-1',
            orderId: 'ord-9092',
            userId: 'farmer-101',
            finalTotal: 42000,
            deletedBy: 'Admin master',
            deletedAt: new Date().toISOString(),
            reason: 'Farmer duplicates request'
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch farmers
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsub();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'System Farm';
  };

  const restoreOrder = async (item: any) => {
    try {
      // Re-add to orders collection
      await addDoc(collection(db, 'orders'), {
        userId: item.userId,
        finalTotal: item.finalTotal,
        total: item.finalTotal,
        status: 'Processing',
        date: new Date().toISOString()
      });

      // Remove from trash bin
      await deleteDoc(doc(db, 'deletedOrders', item.id));
      toast.success('Order successfully restored to active order registry. Status processing.');
    } catch (err) {
      toast.error('Failed to restore order');
    }
  };

  const hardPurge = async (id: string) => {
    try {
      if (confirm('Are you absolutely certain you wish to HARD PURGE this cancelled order permanently? This cannot be reversed.')) {
        await deleteDoc(doc(db, 'deletedOrders', id));
        toast.success('Order hard purged permanently from filesystem database.');
      }
    } catch (err) {
      toast.error('Hard purge operation failed');
    }
  };

  const filteredDeletes = deletedOrders.filter(d => {
    const fn = getFarmerName(d.userId).toLowerCase();
    const oid = (d.orderId || '').toLowerCase();
    const reason = (d.reason || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fn.includes(term) || oid.includes(term) || reason.includes(term);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <ShieldX size={32} className="text-red-650" />
          CANCELLED & PURGED CONTRACTS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Master order trash bin, contract cancellations, and permanent ledger purges
        </p>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">CANCELS ARCHIVE BIN</CardTitle>
            <CardDescription className="text-xs">Restore misidentified cancellation logs to active processing orders</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search cancelled logs..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Cancellation Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Order ID Reference</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Affected Farmer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Contract Value</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Cancellation Reason / Specifics</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Safety Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeletes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    Cancellation log trash bin is currently empty
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeletes.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs font-bold text-slate-405">
                      {item.deletedAt ? format(new Date(item.deletedAt), 'dd MMM yyyy HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-xs font-black text-slate-700 font-mono">
                      #{item.orderId || 'Direct Cancel'}
                    </TableCell>
                    <TableCell className="text-xs font-extrabold text-slate-850">
                      {getFarmerName(item.userId)}
                    </TableCell>
                    <TableCell className="text-xs font-black text-slate-800 font-sans">
                      ₹{(item.finalTotal || item.total || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-slate-500 leading-normal font-semibold">
                      {item.reason || 'Requested by farmer'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button 
                          size="sm"
                          onClick={() => restoreOrder(item)}
                          className="h-8 rounded-full text-[10px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-none uppercase tracking-wider flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Restore Contract
                        </Button>
                        <Button 
                          size="icon"
                          variant="ghost"
                          onClick={() => hardPurge(item.id)}
                          className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Flame size={13} />
                        </Button>
                      </div>
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

export default AdminDeletedOrders;
