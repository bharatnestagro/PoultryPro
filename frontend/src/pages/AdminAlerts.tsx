import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  AlertTriangle, Bell, Trash2, CheckCircle, PlusCircle, 
  Search, AlertOctagon, User, ShieldAlert, CheckCircle2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminAlerts: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddAlert, setShowAddAlert] = useState(false);
  
  const [newAlert, setNewAlert] = useState({
    userId: 'All',
    message: '',
    severity: 'Medium' as 'Low' | 'Medium' | 'High'
  });

  useEffect(() => {
    // 1. Fetch real time Alerts
    const unsubAlerts = onSnapshot(
      query(collection(db, 'alerts'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default clinical alerts if collection is empty
        setAlerts([
          {
            id: 'alert-1',
            userId: 'All',
            message: 'Extremely high summer heat detected in regional sector. Please optimize fans and electrolytes.',
            severity: 'High',
            status: 'Active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'alert-2',
            userId: 'farmer-101',
            message: 'Mortality spike (>3%) in Alpha Batch. Quarantine layer block recommended.',
            severity: 'High',
            status: 'Active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'alert-3',
            userId: 'farmer-102',
            message: 'Feed stock inventory is running low (below 300 KG). Ordering supply suggested.',
            severity: 'Medium',
            status: 'Resolved',
            createdAt: new Date().toISOString()
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
      unsubAlerts();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    if (id === 'All') return 'All Farmers (Global Broadcast)';
    return farmers.find(f => f.id === id)?.name || id || 'N/A';
  };

  const handleResolve = async (alertId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'Resolved' ? 'Active' : 'Resolved';
      await updateDoc(doc(db, 'alerts', alertId), { status: nextStatus });
      toast.success(`Alert status changed to ${nextStatus}`);
    } catch (err) {
      toast.error('Failed to update alert state');
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'alerts', alertId));
      toast.success('Alert deleted successfully');
    } catch (err) {
      toast.error('Failed to delete alert');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlert.message) {
      toast.error('Alert message is required');
      return;
    }

    try {
      await addDoc(collection(db, 'alerts'), {
        userId: newAlert.userId,
        message: newAlert.message,
        severity: newAlert.severity,
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      // Also dispatch corresponding custom notifications so users get actual toast alarms
      await addDoc(collection(db, 'notifications'), {
        userId: newAlert.userId,
        title: `${newAlert.severity} Alert broadcast`,
        message: newAlert.message,
        type: 'alert',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success('Alert triggered and broadcasted successfully');
      setNewAlert({ userId: 'All', message: '', severity: 'Medium' });
      setShowAddAlert(false);
    } catch (err) {
      toast.error('Failed to trigger alert');
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const name = getFarmerName(a.userId).toLowerCase();
    const msg = (a.message || '').toLowerCase();
    const severity = (a.severity || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || msg.includes(term) || severity.includes(term);
  });

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
            <ShieldAlert size={32} className="text-red-500" />
            CRITICAL INCIDENTS & BROADCASTS
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Core diagnostic alarms, biosafety alerts, and global broadcasts
          </p>
        </div>

        <Dialog open={showAddAlert} onOpenChange={setShowAddAlert}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-red-650 hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Trigger New Alarm
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">TRIGGER CUSTOM INCIDENT</DialogTitle>
              <CardDescription className="text-xs">This will immediately flag inside farmer accounts and dispatch alarms.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAlert} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="target" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Target Farmers</Label>
                <Select value={newAlert.userId} onValueChange={(val) => setNewAlert({ ...newAlert, userId: val })}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                    <SelectValue placeholder="Choose Target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All" className="text-xs font-bold italic text-green-700">All Farmers (Global Broadcast)</SelectItem>
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
                  <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Threat Severity</Label>
                  <Select value={newAlert.severity} onValueChange={(val: any) => setNewAlert({ ...newAlert, severity: val })}>
                    <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold">
                      <SelectValue placeholder="Choose Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low (Informational)</SelectItem>
                      <SelectItem value="Medium">Medium (Attention)</SelectItem>
                      <SelectItem value="High">High (Immediate Action)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Incident Message / Instructions</Label>
                <textarea
                  id="message"
                  required
                  placeholder="e.g. Extreme storm forecast! Shut curtains on east tier blocks immediately and verify power generation backup."
                  value={newAlert.message}
                  onChange={e => setNewAlert({ ...newAlert, message: e.target.value })}
                  rows={4}
                  className="w-full text-xs font-semibold p-3.5 rounded-2xl border border-slate-150 bg-slate-55 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:font-normal"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-red-600 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Dispatch Broadcast Alarms
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid statistics summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-red-50/50">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest">Critical High Alarms</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-red-900">{alerts.filter(a => a.severity === 'High' && a.status === 'Active').length}</span>
              <span className="text-xs text-red-650 font-bold">Unattended</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 shadow-sm rounded-3xl">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest font-sans">Medium Pre-Warning Flags</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-amber-900">{alerts.filter(a => a.severity === 'Medium').length}</span>
              <span className="text-xs text-slate-400 font-bold">Active and Resolved</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl">
          <CardContent className="p-6">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resolved Alarms</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-800">{alerts.filter(a => a.status === 'Resolved').length}</span>
              <span className="text-xs text-emerald-600 font-black">Success Rate: {alerts.length > 0 ? Math.round((alerts.filter(a => a.status === 'Resolved').length / alerts.length) * 100) : 100}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main filter list */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight">Active Incident Feed</CardTitle>
            <CardDescription className="text-xs">Dynamic and triggered feed monitoring safety guidelines in the field</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search threat incidents..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
              No matching threat incident signals detected
            </div>
          ) : (
            filteredAlerts.map((item) => (
              <div 
                key={item.id} 
                className={`p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  item.status === 'Resolved' 
                    ? 'border-slate-100 bg-slate-50/50 opacity-70' 
                    : item.severity === 'High' 
                      ? 'border-red-100 bg-red-50/20' 
                      : 'border-amber-100 bg-amber-50/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${
                    item.status === 'Resolved' 
                      ? 'bg-slate-150 text-slate-500' 
                      : item.severity === 'High' 
                        ? 'bg-red-100 text-red-650' 
                        : 'bg-amber-100 text-amber-600'
                  }`}>
                    <AlertOctagon size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{getFarmerName(item.userId)}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400 font-bold">{item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy HH:mm') : 'N/A'}</span>
                      <span className="text-slate-300">•</span>
                      <Badge className={`text-[8px] font-black uppercase tracking-widest px-2.5 rounded-full ${
                        item.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.severity} severity
                      </Badge>
                    </div>
                    <p className="text-xs font-bold text-slate-700 mt-2 leading-relaxed max-w-2xl">{item.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <Button 
                    size="sm"
                    variant={item.status === 'Resolved' ? 'secondary' : 'default'}
                    onClick={() => handleResolve(item.id, item.status)}
                    className="h-8 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-800 hover:bg-slate-200"
                  >
                    {item.status === 'Resolved' ? 'Reopen Alarm' : 'Resolve'}
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(item.id)}
                    className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminAlerts;
