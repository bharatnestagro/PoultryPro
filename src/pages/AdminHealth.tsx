import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  ShieldCheck, 
  Activity, 
  AlertTriangle,
  FileText,
  Search,
  Filter
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

const AdminHealth: React.FC = () => {
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'vaccinations'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVaccinations(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'vaccinations', id));
      toast.success('Record deleted');
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Health & Medication</h1>
          <p className="text-slate-500 font-medium">Monitor vaccination schedules, medicine usage, and disease reports across all flocks.</p>
        </div>
        <Button className="bg-[#122B21] text-white rounded-xl flex items-center gap-2">
          <Plus size={18} />
          <span>New Health Record</span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">94%</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VACCINATION COMPLIANCE</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">12</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE TREATMENTS</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="bg-red-50 p-3 rounded-2xl text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">2</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DISEASE OUTBREAK ALERTS</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Search by flock, vaccine, or medicine..." 
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vaccination Records */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Vaccination Records</h3>
              <p className="text-xs text-slate-400 font-medium">Recent vaccination activities across all farms.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-emerald-600 font-bold text-xs">VIEW ALL</Button>
          </div>
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">DATE</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FLOCK</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VACCINE</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">METHOD</TableHead>
                <TableHead className="text-right px-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-slate-400">Loading records...</TableCell>
                </TableRow>
              ) : vaccinations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-slate-400">No vaccination records found</TableCell>
                </TableRow>
              ) : (
                vaccinations.map((v) => (
                  <TableRow key={v.id} className="group border-slate-50">
                    <TableCell className="px-8 py-6">
                      <p className="text-xs font-bold text-slate-900">{format(new Date(v.date), 'MMM dd, yyyy')}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-bold text-slate-700">{v.flockName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none rounded-lg text-[10px] font-bold px-2 py-1">
                        {v.vaccineName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-slate-500 font-medium">{v.method}</p>
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" />}>
                          <MoreHorizontal size={18} className="text-slate-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-2">
                          <DropdownMenuItem className="rounded-lg gap-2 font-medium cursor-pointer">
                            <Edit2 size={16} />
                            Edit Record
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="rounded-lg gap-2 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            onClick={() => handleDelete(v.id)}
                          >
                            <Trash2 size={16} />
                            Delete Record
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

        {/* Disease Reports */}
        <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Disease Reports</h3>
              <p className="text-xs text-slate-400 font-medium">Active health issues and disease tracking.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-red-600 font-bold text-xs">VIEW ALL</Button>
          </div>
          <div className="p-8 space-y-4">
            <div className="p-6 rounded-2xl bg-red-50 border border-red-100 flex gap-4">
              <div className="bg-red-100 p-3 rounded-xl text-red-600 h-fit">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900">Suspected Coccidiosis</h4>
                  <Badge className="bg-red-200 text-red-700 border-none text-[10px] font-bold">URGENT</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">Reported in <span className="font-bold">Green Valley Flock B</span>. High mortality observed in the last 24 hours.</p>
                <div className="flex items-center gap-4 mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REPORTED: 2 HOURS AGO</p>
                  <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline">VIEW FULL REPORT</button>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4">
              <div className="bg-amber-100 p-3 rounded-xl text-amber-600 h-fit">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900">Respiratory Stress</h4>
                  <Badge className="bg-amber-200 text-amber-700 border-none text-[10px] font-bold">MONITORING</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-1">Reported in <span className="font-bold">Sunrise Farm Flock 1</span>. Linked to recent humidity spike.</p>
                <div className="flex items-center gap-4 mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">REPORTED: 1 DAY AGO</p>
                  <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline">VIEW FULL REPORT</button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminHealth;
