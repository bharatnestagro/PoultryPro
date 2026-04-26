import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Send, 
  AlertCircle,
  FileText,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  Database,
  Activity,
  Stethoscope,
  Edit2
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const AdminAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target: 'All',
    condition: '',
    treatment: '',
    priority: 'Medium',
    type: 'General',
    active: true
  });

  useEffect(() => {
    const q = query(collection(db, 'systemAlerts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      // Manual alerts are not isAuto
      setAlerts(snap.docs.filter(d => !d.data().isAuto).map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'systemAlerts'));
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('Title and message are required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAlertId) {
        await updateDoc(doc(db, 'systemAlerts', editingAlertId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Alert updated successfully');
      } else {
        await addDoc(collection(db, 'systemAlerts'), {
          ...formData,
          isAuto: false,
          createdAt: serverTimestamp(),
          active: true
        });
        toast.success('Alert created and broadcast successfully');
      }
      setFormData({
        title: '',
        description: '',
        target: 'All',
        condition: '',
        treatment: '',
        priority: 'Medium',
        type: 'General',
        active: true
      });
      setShowAddForm(false);
      setEditingAlertId(null);
    } catch (err) {
      handleFirestoreError(err, editingAlertId ? OperationType.UPDATE : OperationType.CREATE, 'systemAlerts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (alert: any) => {
    setFormData({
      title: alert.title,
      description: alert.description,
      target: alert.target || 'All',
      condition: alert.condition || '',
      treatment: alert.treatment || '',
      priority: alert.priority || 'Medium',
      type: alert.type || 'General',
      active: alert.active ?? true
    });
    setEditingAlertId(alert.id);
    setShowAddForm(true);
  };

  const toggleAlertActive = async (alert: any) => {
    try {
      await updateDoc(doc(db, 'systemAlerts', alert.id), {
        active: !alert.active
      });
      toast.success(`Alert ${!alert.active ? 'activated' : 'deactivated'}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `systemAlerts/${alert.id}`);
    }
  };

  const toggleForm = () => {
    if (showAddForm) {
      setEditingAlertId(null);
      setFormData({
        title: '',
        description: '',
        target: 'All',
        condition: '',
        treatment: '',
        priority: 'Medium',
        type: 'General',
        active: true
      });
    }
    setShowAddForm(!showAddForm);
  };

  const deleteAlert = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert? This will remove it for all farmers.')) return;
    try {
      await deleteDoc(doc(db, 'systemAlerts', id));
      toast.success('Alert deleted from system');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `systemAlerts/${id}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Make Alerts</h1>
          <p className="text-slate-500">Create and broadcast alerts based on Database, Condition, Logic, and Treatment</p>
        </div>
        <Button 
          onClick={toggleForm}
          className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 px-6 gap-2"
        >
          {showAddForm ? <Clock size={18} /> : <Plus size={18} />}
          <span>{showAddForm ? 'View History' : 'Create New Alert'}</span>
        </Button>
      </div>

      {showAddForm ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8"
        >
          <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configure Alert logic</h2>
              <p className="text-xs text-slate-400 font-medium">Broadcast smart treatment advice to farmers</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Alert Title</Label>
                <Input 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Excessive Summer Heat Warning"
                  className="rounded-xl border-slate-200 h-12"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">Detailed Message</Label>
                <Textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Explain the situation and what farmers need to double check..."
                  className="rounded-xl border-slate-200 min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Target Farmers</Label>
                  <Select value={formData.target} onValueChange={v => setFormData({...formData, target: v})}>
                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Farmers</SelectItem>
                      <SelectItem value="Gavthi Farm">Gavthi Only</SelectItem>
                      <SelectItem value="Sonali Farm">Sonali Only</SelectItem>
                      <SelectItem value="Broiler Farm">Broiler Only</SelectItem>
                      <SelectItem value="Layer Farm">Layer Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Priority Level</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})}>
                    <SelectTrigger className="rounded-xl border-slate-200 h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low (Informational)</SelectItem>
                      <SelectItem value="Medium">Medium (Caution)</SelectItem>
                      <SelectItem value="High">High (Immediate Action)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Advanced Logic */}
            <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-dashed border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Database & Condition Logic</h3>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Activity size={14} />
                  Condition & Logic
                </Label>
                <Textarea 
                  value={formData.condition}
                  onChange={e => setFormData({...formData, condition: e.target.value})}
                  placeholder="e.g. IF Mortality > 5% AND Age < 14 Days"
                  className="rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Stethoscope size={14} />
                  Treatment / Action Required
                </Label>
                <Textarea 
                  value={formData.treatment}
                  onChange={e => setFormData({...formData, treatment: e.target.value})}
                  placeholder="e.g. Administer Stress-Care 5ml/liter, increase ventilation"
                  className="rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-[#122B21] hover:bg-[#1a3d2e] py-6 rounded-xl font-bold gap-2 text-white shadow-lg shadow-emerald-900/10"
                >
                  {isSubmitting ? 'Processing...' : (editingAlertId ? 'Update Broadcast Alert' : 'Broadcast Alert to Farmers')}
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-slate-900">Recent Alerts Sent</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-slate-400 h-8 px-3 rounded-lg hover:bg-slate-100">
                <Filter size={14} className="mr-2" />
                Filter
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
              <Bell size={40} className="text-slate-200 mx-auto mb-4" />
              <h3 className="font-bold text-slate-900 mb-1">No alerts sent yet</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">Create your first database-driven alert to notify farmers</p>
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(true)}
                className="mt-6 rounded-xl border-slate-200"
              >
                Start Creating
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alert) => (
                <motion.div 
                  layout
                  key={alert.id}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl scale-95 ${
                        alert.priority === 'High' ? 'bg-red-50 text-red-600' :
                        alert.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <h3 className={`font-bold text-sm tracking-tight uppercase ${alert.active === false ? 'text-slate-400 line-through' : 'text-slate-900 group-hover:text-indigo-600 transition-colors'}`}>
                             {alert.title}
                           </h3>
                           {alert.active === false && <Badge variant="outline" className="text-[8px] h-4">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <Badge variant="secondary" className="text-[10px] font-bold uppercase py-0 px-2 h-4 border-none bg-slate-100 text-slate-500">
                            {alert.target}
                           </Badge>
                           <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{alert.createdAt?.toDate ? new Date(alert.createdAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleAlertActive(alert)}
                        className={`rounded-xl h-8 w-8 ${alert.active === false ? 'text-slate-300 hover:text-emerald-500' : 'text-emerald-500 hover:text-slate-400'}`}
                        title={alert.active === false ? "Activate" : "Deactivate"}
                      >
                        <CheckCircle2 size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => startEdit(alert)}
                        className="text-slate-300 hover:text-indigo-600 rounded-xl h-8 w-8"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteAlert(alert.id)}
                        className="text-slate-300 hover:text-red-500 rounded-xl h-8 w-8"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
                    {alert.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-auto border-t border-slate-50 pt-4">
                    <div className="bg-slate-50 p-3 rounded-2xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Condition</p>
                      <p className="text-[10px] text-slate-700 font-medium truncate">{alert.condition || 'N/A'}</p>
                    </div>
                    <div className="bg-emerald-50/50 p-3 rounded-2xl">
                      <p className="text-[9px] font-bold text-emerald-600 opacity-60 uppercase mb-1">Treatment</p>
                      <p className="text-[10px] text-emerald-700 font-bold truncate">{alert.treatment || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Live & Broadcasted</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAlerts;
