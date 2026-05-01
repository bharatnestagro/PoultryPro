import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Activity, Bell, Trash2, CheckCircle, ExternalLink, Zap, BrainCircuit, Edit2, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const AdminAutoAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rules, setRules] = useState<any[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  const [ruleFormData, setRuleFormData] = useState({
    name: '',
    logic: '',
    priority: 'Medium',
    active: true
  });

  const [settings, setSettings] = useState({
    enabled: true,
    geminiApiKey: '',
    aiPrompt: 'As a Poultry Health AI, analyze this daily log data and provide a smart diagnosis alert if needed.\nFarm Type: {{farmType}}\nChicks Data: {{data}}\nWeather Data: {{weather}}\n\nIf you detect an issue (like heat stroke, diarrhea, nutritional deficiency) based on mortality, feed/water ratio, and symptoms, return a JSON object:\n{\n  "title": "Short title",\n  "description": "Short explanation",\n  "priority": "Low/Medium/High",\n  "condition": "The detected problem",\n  "treatment": "Recommended action"\n}\nIf no major issue, return {"priority": "None"}. Only return valid JSON.',
    thresholds: {
      feedMin: 0.11,
      feedMax: 0.13,
      heatStressTemp: 38,
      criticalMortalityRate: 0.02,
      badEggThreshold: 0.05
    }
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    condition: '',
    treatment: '',
    priority: 'Medium',
    target: 'All',
    active: true
  });

  const [stats, setStats] = useState({
    total: 0,
    highPriority: 0,
    active: 0
  });

  useEffect(() => {
    const q = query(
      collection(db, 'systemAlerts'), 
      where('isAuto', '==', true),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setAlerts(list);
      setStats({
        total: list.length,
        highPriority: list.filter(a => a.priority === 'High').length,
        active: list.filter(a => a.active).length
      });
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'systemAlerts'));

    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'system', 'autoAlertSettings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          enabled: data.enabled ?? true,
          geminiApiKey: data.geminiApiKey || '',
          aiPrompt: data.aiPrompt || settings.aiPrompt,
          thresholds: data.thresholds || settings.thresholds
        });
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'alertRules'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'alertRules'));
    return () => unsub();
  }, []);

  const handleOpenAddRule = () => {
    setRuleFormData({ name: '', logic: '', priority: 'Medium', active: true });
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule: any) => {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name || '',
      logic: rule.logic || '',
      priority: rule.priority || 'Medium',
      active: rule.active ?? true
    });
    setIsRuleModalOpen(true);
  };

  const handleSubmitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingRule) {
        await updateDoc(doc(db, 'alertRules', editingRule.id), {
          ...ruleFormData,
          updatedAt: serverTimestamp()
        });
        toast.success('Logic rule updated');
      } else {
        await addDoc(collection(db, 'alertRules'), {
          ...ruleFormData,
          createdAt: serverTimestamp()
        });
        toast.success('Logic rule created');
      }
      setIsRuleModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingRule ? OperationType.UPDATE : OperationType.CREATE, 'alertRules');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this logic rule?')) return;
    try {
      await deleteDoc(doc(db, 'alertRules', id));
      toast.success('Rule removed');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `alertRules/${id}`);
    }
  };

  const toggleRuleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'alertRules', id), { active: !current });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `alertRules/${id}`);
    }
  };

  const saveSettings = async () => {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'system', 'autoAlertSettings'), {
        enabled: settings.enabled,
        geminiApiKey: settings.geminiApiKey,
        aiPrompt: settings.aiPrompt,
        thresholds: settings.thresholds,
        updatedAt: serverTimestamp()
      });
      toast.success('Engine settings saved');
      setIsSettingsOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'system/autoAlertSettings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      condition: '',
      treatment: '',
      priority: 'Medium',
      target: 'All',
      active: true
    });
    setEditingAlert(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (alert: any) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title || '',
      description: alert.description || '',
      condition: alert.condition || '',
      treatment: alert.treatment || '',
      priority: alert.priority || 'Medium',
      target: alert.target || 'All',
      active: alert.active ?? true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingAlert) {
        await updateDoc(doc(db, 'systemAlerts', editingAlert.id), {
          ...formData,
          isAuto: true, // Keep as auto
          updatedAt: serverTimestamp()
        });
        toast.success('Auto alert updated');
      } else {
        await addDoc(collection(db, 'systemAlerts'), {
          ...formData,
          isAuto: true,
          createdAt: serverTimestamp()
        });
        toast.success('Manual auto alert created');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingAlert ? OperationType.UPDATE : OperationType.CREATE, 'systemAlerts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    try {
      await deleteDoc(doc(db, 'systemAlerts', id));
      toast.success('Alert deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `systemAlerts/${id}`);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'systemAlerts', id), { active: !current });
      toast.success('Alert status updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `systemAlerts/${id}`);
    }
  };

  const toggleAutoAlerts = async () => {
    const newVal = !settings.enabled;
    setSettings(prev => ({ ...prev, enabled: newVal }));
    try {
      await updateDoc(doc(db, 'system', 'autoAlertSettings'), {
        enabled: newVal,
        updatedAt: serverTimestamp()
      });
      toast.success(`Auto alerts turned ${newVal ? 'ON' : 'OFF'}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'system/autoAlertSettings');
      setSettings(prev => ({ ...prev, enabled: !newVal })); // Rollback
    }
  };

  return (
    <div className="space-y-8 pb-20 px-4 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BrainCircuit className="text-emerald-600" size={36} />
            Auto Alert Engine
          </h1>
          <p className="text-slate-500 font-medium mt-1">Rule-based automated diagnostics and notifications</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm mr-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${settings.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                {settings.enabled ? 'Auto Alerts ON' : 'Auto Alerts OFF'}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleAutoAlerts}
                className={`h-8 w-14 rounded-full p-1 transition-colors ${settings.enabled ? 'bg-emerald-100' : 'bg-slate-100'}`}
              >
                <div className={`w-6 h-6 rounded-full transition-transform shadow-sm ${settings.enabled ? 'translate-x-6 bg-emerald-500' : 'translate-x-0 bg-slate-400'}`} />
              </Button>
            </div>
            <Button 
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-2xl border-slate-200 py-6 px-6 font-bold text-xs uppercase tracking-widest gap-2"
            >
              <Zap size={18} className="text-amber-500" />
              Settings
            </Button>
            <Button 
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-6 px-8 gap-2 font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-900/20"
            >
              <Plus size={18} />
              Add Manual Alert
            </Button>
            <div className="hidden sm:flex bg-emerald-50 text-emerald-700 px-4 py-3 rounded-2xl border border-emerald-100 items-center gap-2 font-bold text-xs">
                <Zap size={14} className="animate-pulse" /> Live Mode
            </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Generated Alerts', value: stats.total, icon: Bell, color: 'bg-blue-500' },
          { label: 'High Priority', value: stats.highPriority, icon: AlertCircle, color: 'bg-red-500' },
          { label: 'Active Alerts', value: stats.active, icon: CheckCircle, color: 'bg-emerald-500' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm rounded-[2rem] overflow-hidden group">
            <CardContent className="p-6 flex items-center gap-5">
              <div className={`p-4 rounded-2xl ${stat.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logic Rules List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Zap size={20} className="text-amber-500" /> Custom Logic Rules
            </h2>
            <Button 
                onClick={handleOpenAddRule}
                variant="outline" 
                className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs uppercase tracking-widest gap-2"
            >
                <Plus size={14} /> Add Logic
            </Button>
        </div>
        
        {rules.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none rounded-[2rem]">
                <CardContent className="p-10 text-center">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No custom logic defined yet</p>
                </CardContent>
            </Card>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map((rule) => (
                    <Card key={rule.id} className={`border-none shadow-sm rounded-3xl overflow-hidden ${!rule.active ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">{rule.name}</h3>
                                    <Badge variant="secondary" className="text-[9px] font-bold uppercase">{rule.priority} Priority</Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button 
                                        variant="ghost" size="icon" className="h-8 w-8 rounded-lg" 
                                        onClick={() => toggleRuleActive(rule.id, rule.active)}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${rule.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400" onClick={() => handleOpenEditRule(rule)}>
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500" onClick={() => handleDeleteRule(rule.id)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-xs font-medium text-slate-600 italic">"AI logic: {rule.logic}"</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>

      {/* Alerts Table-style List */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <Activity size={20} className="text-emerald-500" /> Recent Auto Alerts
        </h2>

        {loading ? (
          <div className="p-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Analyzing logs...</p>
          </div>
        ) : alerts.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none rounded-[2rem]">
            <CardContent className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-300">
                <Bell size={24} />
              </div>
              <p className="text-slate-500 font-medium">No automated alerts have been generated yet.</p>
              <Button onClick={handleOpenAdd} variant="outline" className="mt-4 rounded-xl">Create Manual Test Alert</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`border-none shadow-sm rounded-3xl overflow-hidden group ${
                    !alert.active ? 'opacity-50' : ''
                  }`}>
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        {/* Priority Sidebar */}
                        <div className={`w-2 shrink-0 ${
                          alert.priority === 'High' ? 'bg-red-500' : 
                          alert.priority === 'Medium' ? 'bg-amber-500' : 
                          'bg-blue-500'
                        }`} />
                        
                        <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`p-3 rounded-2xl ${
                              alert.priority === 'High' ? 'bg-red-50 text-red-500' : 
                              alert.priority === 'Medium' ? 'bg-amber-50 text-amber-500' : 
                              'bg-blue-50 text-blue-500'
                            }`}>
                              <Bell size={24} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-slate-900 uppercase tracking-tight">{alert.title}</h3>
                                <Badge className={
                                  alert.priority === 'High' ? 'bg-red-100 text-red-600' : 
                                  alert.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                                  'bg-blue-100 text-blue-600'
                                }>
                                  {alert.priority}
                                </Badge>
                                {!alert.active && <Badge variant="outline">Hidden</Badge>}
                              </div>
                              <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">{alert.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`rounded-xl h-10 px-4 font-bold transition-all ${
                                alert.active ? 'text-blue-600 hover:bg-blue-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              onClick={() => toggleActive(alert.id, alert.active)}
                            >
                              {alert.active ? 'Hide' : 'Show'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              onClick={() => handleOpenEdit(alert)}
                            >
                              <Edit2 size={16} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50"
                              onClick={() => handleDelete(alert.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {(alert.condition || alert.treatment) && (
                        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex flex-col md:flex-row gap-6">
                            {alert.condition && (
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        Logic
                                    </p>
                                    <p className="text-xs font-bold text-slate-700 italic">"{alert.condition}"</p>
                                </div>
                            )}
                            {alert.treatment && (
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                        Action
                                    </p>
                                    <p className="text-xs font-bold text-emerald-700">{alert.treatment}</p>
                                </div>
                            )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-3xl max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              {editingAlert ? 'Edit Auto Alert' : 'Create Manual Auto Alert'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Title</Label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="rounded-xl"
                  placeholder="e.g. Heat stress detected"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Target Segment</Label>
                <Input 
                  value={formData.target} 
                  onChange={e => setFormData({...formData, target: e.target.value})}
                  className="rounded-xl"
                  placeholder="e.g. Broiler Farm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Message Description</Label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="rounded-xl"
                placeholder="Explain the situation briefly..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Condition Logic</Label>
                    <Input 
                        value={formData.condition} 
                        onChange={e => setFormData({...formData, condition: e.target.value})}
                        className="rounded-xl"
                        placeholder="e.g. Temp > 40C"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Recommended Action</Label>
                    <Input 
                        value={formData.treatment} 
                        onChange={e => setFormData({...formData, treatment: e.target.value})}
                        className="rounded-xl"
                        placeholder="e.g. Administer Stress-Care"
                    />
                </div>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-black uppercase text-xs tracking-widest"
              >
                {isSubmitting ? 'Saving...' : (editingAlert ? 'Update Alert' : 'Create Alert')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-3xl max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Zap size={24} className="text-amber-500" /> AI Engine Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Gemini API Key</Label>
              <Input 
                type="password"
                value={settings.geminiApiKey} 
                onChange={e => setSettings({...settings, geminiApiKey: e.target.value})}
                className="rounded-xl border-slate-200"
                placeholder="Paste your Gemini API Key here"
              />
              <p className="text-[10px] text-slate-500 font-medium italic">Your key is stored securely in your private Firestore database.</p>
            </div>

            <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <Label className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                <Activity size={16} className="text-blue-500" />
                Baseline Logic Thresholds
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Min Feed (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={settings.thresholds.feedMin} 
                    onChange={e => setSettings({...settings, thresholds: {...settings.thresholds, feedMin: parseFloat(e.target.value)}})}
                    className="rounded-lg h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Max Feed (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={settings.thresholds.feedMax} 
                    onChange={e => setSettings({...settings, thresholds: {...settings.thresholds, feedMax: parseFloat(e.target.value)}})}
                    className="rounded-lg h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Heat Temp (°C)</Label>
                  <Input 
                    type="number"
                    value={settings.thresholds.heatStressTemp} 
                    onChange={e => setSettings({...settings, thresholds: {...settings.thresholds, heatStressTemp: parseFloat(e.target.value)}})}
                    className="rounded-lg h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Mortality (%)</Label>
                  <Input 
                    type="number"
                    step="0.001"
                    value={settings.thresholds.criticalMortalityRate} 
                    onChange={e => setSettings({...settings, thresholds: {...settings.thresholds, criticalMortalityRate: parseFloat(e.target.value)}})}
                    className="rounded-lg h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Bad Egg (%)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={settings.thresholds.badEggThreshold} 
                    onChange={e => setSettings({...settings, thresholds: {...settings.thresholds, badEggThreshold: parseFloat(e.target.value)}})}
                    className="rounded-lg h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Design Logic (Prompt Template)</Label>
              <Textarea 
                value={settings.aiPrompt} 
                onChange={e => setSettings({...settings, aiPrompt: e.target.value})}
                className="rounded-xl border-slate-200 h-64 font-mono text-xs leading-relaxed"
                placeholder="Configure how AI analyzes farmer data..."
              />
              <div className="flex flex-wrap gap-2">
                 <Badge variant="secondary" className="text-[9px] font-bold">{"{{farmType}}"}</Badge>
                 <Badge variant="secondary" className="text-[9px] font-bold">{"{{data}}"}</Badge>
                 <Badge variant="secondary" className="text-[9px] font-bold">{"{{weather}}"}</Badge>
                 <span className="text-[9px] text-slate-400 self-center">Use these placeholders in your prompt</span>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <Button 
                variant="ghost"
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 rounded-xl font-bold uppercase text-xs"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveSettings}
                disabled={isSubmitting}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-black uppercase text-xs tracking-widest text-white"
              >
                {isSubmitting ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={isRuleModalOpen} onOpenChange={setIsRuleModalOpen}>
        <DialogContent className="rounded-3xl max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              {editingRule ? 'Edit Logic Rule' : 'New Logic Rule'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitRule} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Rule Name</Label>
              <Input 
                value={ruleFormData.name} 
                onChange={e => setRuleFormData({...ruleFormData, name: e.target.value})}
                className="rounded-xl"
                placeholder="e.g. Excessive Mortality"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Natural Language Logic (Prompt)</Label>
              <Textarea 
                value={ruleFormData.logic} 
                onChange={e => setRuleFormData({...ruleFormData, logic: e.target.value})}
                className="rounded-xl h-32"
                placeholder="Describe when AI should trigger this... (e.g. If mortality is more than 3% or if feed intake drops by half suddenly)"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Alert Priority</Label>
                    <select 
                        value={ruleFormData.priority}
                        onChange={e => setRuleFormData({...ruleFormData, priority: e.target.value})}
                        className="w-full bg-slate-50 border-none rounded-xl h-10 px-3 text-xs font-bold"
                    >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                    </select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                     <Button 
                        type="button"
                        variant={ruleFormData.active ? "default" : "outline"}
                        className="rounded-xl h-10"
                        onClick={() => setRuleFormData({...ruleFormData, active: !ruleFormData.active})}
                     >
                        {ruleFormData.active ? "Enabled" : "Disabled"}
                     </Button>
                </div>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 h-12 rounded-xl font-black uppercase text-xs tracking-widest text-white"
              >
                {isSubmitting ? 'Processing...' : (editingRule ? 'Update Rule' : 'Save Rule')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAutoAlerts;
