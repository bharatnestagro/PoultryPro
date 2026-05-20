import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  ClipboardList, Search, CheckSquare, Clock, PlusCircle, 
  User, CheckCircle2, ChevronRight, Activity, Calendar, Award
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

const AdminOperations: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  const [newTask, setNewTask] = useState({
    userId: '',
    title: '',
    category: 'Vaccination',
    description: '',
    scheduledDate: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    // 1. Fetch real tasks
    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(
      qTasks,
      (snap) => {
        setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default tasks if database is empty/offline
        setTasks([
          {
            id: 'task-101',
            userId: 'farmer-101',
            title: 'Newcastle (R2B) Vaccine administration',
            category: 'Vaccination',
            description: 'Provide vaccine inside purified water blocks, ensure no feed 2 hours prior.',
            scheduledDate: format(new Date(), 'yyyy-MM-dd'),
            status: 'Pending',
            createdAt: new Date().toISOString()
          },
          {
            id: 'task-102',
            userId: 'farmer-102',
            title: 'Biosecurity Lime Spray Disinfection',
            category: 'Biosecurity',
            description: 'Apply hydrated lime powder solution on exterior paths to sterilize access point.',
            scheduledDate: format(new Date(), 'yyyy-MM-dd'),
            status: 'Completed',
            createdAt: new Date().toISOString()
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
      unsubTasks();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'Team Farmer';
  };

  const handlePostTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.userId || !newTask.title || !newTask.scheduledDate) {
      toast.error('All task attributes are required');
      return;
    }

    try {
      await addDoc(collection(db, 'tasks'), {
        userId: newTask.userId,
        title: newTask.title,
        category: newTask.category,
        description: newTask.description,
        scheduledDate: newTask.scheduledDate,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        creatorId: user?.uid,
        creatorType: 'Admin'
      });

      // Dispatch real time user notifications as well
      await addDoc(collection(db, 'notifications'), {
        userId: newTask.userId,
        title: `New Task: ${newTask.title}`,
        message: newTask.description || `Assigned under category ${newTask.category}`,
        type: 'task',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Task scheduled and logged successfully for the farmer');
      setNewTask({ userId: '', title: '', category: 'Vaccination', description: '', scheduledDate: format(new Date(), 'yyyy-MM-dd') });
      setShowAddTask(false);
    } catch (err) {
      toast.error('Failed to register task');
    }
  };

  const toggleTaskState = async (taskId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
      await updateDoc(doc(db, 'tasks', taskId), { status: nextStatus });
      toast.success(`Task status labeled ${nextStatus}`);
    } catch (err) {
      toast.error('Failed to change task completion status');
    }
  };

  const filteredTasks = tasks.filter(t => {
    const fn = getFarmerName(t.userId).toLowerCase();
    const title = (t.title || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fn.includes(term) || title.includes(term) || cat.includes(term);
  });

  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const pendingCount = tasks.filter(t => t.status !== 'Completed').length;
  const complianceRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <ClipboardList size={32} className="text-[#4E46E5]" />
            FIELD OPERATIONS & COMPLIANCE
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Track daily routines, biosecurity checklists, and vaccination calendars
          </p>
        </div>

        <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-[#4E46E5] hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Assign Field Task
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">ASSIGN FIELD TASK</DialogTitle>
              <CardDescription className="text-xs">Dispatch schedule routines directly inside farmer dashboards.</CardDescription>
            </DialogHeader>

            <form onSubmit={handlePostTask} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Target Farmer</Label>
                <Select value={newTask.userId} onValueChange={(val) => setNewTask({ ...newTask, userId: val })} required>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                    <SelectValue placeholder="Choose Target Farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {farmers.filter(f => f.role === 'farmer' || !f.role).map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs font-bold">
                        {f.name || 'Untitled Agent'} ({f.farmName || 'Unassigned Farm'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 font-mono">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Scheduled Due Date</Label>
                <Input 
                  type="date"
                  required
                  value={newTask.scheduledDate}
                  onChange={e => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Operation Category</Label>
                  <Select value={newTask.category} onValueChange={(val: any) => setNewTask({ ...newTask, category: val })}>
                    <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold font-mono">
                      <SelectValue placeholder="Choose Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vaccination">Vaccination (Medical)</SelectItem>
                      <SelectItem value="Feeding">Feeding Adjustment</SelectItem>
                      <SelectItem value="Biosecurity">Biosecurity & Spraying</SelectItem>
                      <SelectItem value="Liftoff preparatives">Liftoff & Selling planning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Task Title</Label>
                <Input 
                  id="title"
                  required
                  placeholder="e.g. Broiler starter vaccine dose 3"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Detailed Instructions</Label>
                <textarea
                  id="desc"
                  required
                  placeholder="Provide precise execution directions..."
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 rounded-2xl border border-slate-150 bg-slate-55 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:font-normal"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Schedule Task
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Aggregate compliance rate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Rate</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{complianceRate}%</span>
              <span className="text-xs text-emerald-600 font-black flex items-center gap-0.5">
                <Award size={14} /> High Standards
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Daily routines</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-orange-650">{pendingCount} Tasks</span>
              <span className="text-xs text-slate-405 font-bold">Awaiting completed</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed routines</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-emerald-600">{completedCount} Tasks</span>
              <span className="text-xs text-slate-405 font-bold font-mono">Stable Operations</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main interactive Tasks list */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight">Active Operation Checkpoints</CardTitle>
            <CardDescription className="text-xs">Dynamic tracking of vaccine completion, biosecurity, and feed weights</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search tasks, categories..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Due Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Farmer</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Task specifics</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center font-mono">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Toggle Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching operation tasks currently loaded
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs font-bold text-slate-400 font-mono">
                      {t.scheduledDate || 'N/A'}
                    </TableCell>
                    <TableCell className="font-bold text-xs text-slate-700">
                      {getFarmerName(t.userId)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-indigo-50 text-indigo-800 font-extrabold border border-indigo-150 uppercase text-[9px] rounded-full">
                        {t.category || 'Vaccination'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="font-extrabold text-xs text-slate-850">{t.title}</p>
                      <p className="text-[11px] text-slate-500 leading-normal font-semibold mt-1">{t.description}</p>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge className={`uppercase text-[9px] font-black rounded-full px-2.5 border ${
                        t.status === 'Completed'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {t.status || 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={t.status === 'Completed' ? 'secondary' : 'default'}
                        onClick={() => toggleTaskState(t.id, t.status)}
                        className={`h-7 px-3 text-[10px] font-black uppercase tracking-wider rounded-full ${
                          t.status === 'Completed' ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-none'
                        }`}
                      >
                        {t.status === 'Completed' ? 'Pending' : 'Done'}
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

export default AdminOperations;
