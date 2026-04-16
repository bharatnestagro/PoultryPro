import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Trash,
  ShoppingBag,
  Calendar,
  User,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AdminDeletedOrders: React.FC = () => {
  const [deletedOrders, setDeletedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'deletedOrders'), orderBy('deletedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeletedOrders(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const purgeOrder = async (id: string) => {
    if (!window.confirm('This will permanently remove the record from history. Continue?')) return;
    try {
      await deleteDoc(doc(db, 'deletedOrders', id));
      toast.success('Record purged');
    } catch (error) {
      toast.error('Failed to purge record');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Deleted Orders History</h1>
        <p className="text-slate-500 font-medium">View archived records of deleted orders and their deletion reasons.</p>
      </div>

      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ORDER ID</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CUSTOMER INFO</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ORDER DETAILS</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DELETION REASON</TableHead>
              <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DELETED AT</TableHead>
              <TableHead className="text-right px-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-slate-400">Loading history...</TableCell>
              </TableRow>
            ) : deletedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-slate-400">No deleted orders found</TableCell>
              </TableRow>
            ) : (
              deletedOrders.map((order) => (
                <TableRow key={order.id} className="group border-slate-50">
                  <TableCell className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-900">#{order.orderId?.substring(0, 8)?.toUpperCase() || 'N/A'}</p>
                    <Badge variant="outline" className="mt-1 text-[8px] bg-red-50 text-red-600 border-red-100 uppercase">Archive</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-bold text-slate-900">{order.customerName || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400">{order.customerEmail || order.userId}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">₹{order.totalAmount?.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">
                        {order.items?.length || 0} Items • Created {order.originalDate ? format(new Date(order.originalDate), 'MM/dd/yy') : 'N/A'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[250px] bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Info size={12} className="text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Reason for deletion</span>
                      </div>
                      <p className="text-xs text-amber-900 font-medium italic">"{order.deletionReason || 'No reason provided'}"</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <p className="text-xs text-slate-500 font-medium">
                        {order.deletedAt ? format(new Date(order.deletedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full"
                      onClick={() => purgeOrder(order.id)}
                    >
                      <Trash size={16} />
                    </Button>
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

export default AdminDeletedOrders;
