import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown,
  ChevronUp,
  Cpu,
  Box,
  Settings, 
  Shield, 
  Bell, 
  Database, 
  Globe, 
  Lock,
  Save,
  RefreshCw,
  UserCheck,
  Download,
  Users,
  Activity,
  DollarSign,
  Plus,
  Trash2,
  FileText,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";

const ADMIN_UID = "OQb1NF7095Qep0tLoijpSZNZRcl2";

const AdminSettings: React.FC = () => {
  const { profile, user: currentUser } = useAuth();
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationOpen: true,
    emailAlerts: true,
    smsNotifications: false,
    inAppAlerts: true,
    timezone: 'Asia/Kolkata (IST)',
    minRewardWithdraw: 500,
    termsAndConditions: '',
    termsList: [],
    footer: {
      logo: '',
      contactNumber: '',
      contactEmail: '',
      address: '',
      socialLinks: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: ''
      },
      footerText: 'Empowering farmers with modern technology.',
      copyrightText: '© 2026 PoultryPro Management System. All rights reserved.',
      googleMapLink: '',
      pages: []
    },
    paymentGateways: {
      razorpay: { enabled: false, apiKey: '', apiSecret: '', mode: 'sandbox' },
      cashfree: { enabled: false, appId: '', secretKey: '', mode: 'sandbox' },
      payu: { enabled: false, merchantKey: '', merchantSalt: '', mode: 'sandbox' },
      cashOnDelivery: { enabled: true }
    },
    googleApis: {
      maps: { enabled: false, apiKey: '' },
      gemini: { enabled: false, apiKey: '' },
      vision: { enabled: false, apiKey: '' },
      translate: { enabled: false, apiKey: '' }
    }
  });
  const [activeSection, setActiveSection] = useState<string | null>('general');
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [newTerm, setNewTerm] = useState({ title: '', content: '' });
  const [editingTerm, setEditingTerm] = useState<any>(null);
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);

  useEffect(() => {
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings(prev => ({ ...prev, ...data }));
        
        // Push to server for backend availability
        fetch('/.netlify/functions/sync-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(err => console.error("Initial sync error:", err));
      }
      setLoading(false);
    });

    // Fetch admins
    const unsubAdmins = onSnapshot(query(collection(db, 'users'), where('role', '==', 'admin')), (snap) => {
      setAdmins(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch all users for role management
    const unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSettings();
      unsubAdmins();
      unsubAllUsers();
    };
  }, []);

  const handleRecalculateAllCosts = async () => {
    setIsRecalculating(true);
    try {
      const flocksSnap = await getDocs(collection(db, 'flocks'));
      const logsSnap = await getDocs(collection(db, 'dailyLogs'));
      const feedStockSnap = await getDocs(collection(db, 'feedStock'));
      const medStockSnap = await getDocs(collection(db, 'medicineStock'));

      const allFlocks = flocksSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const allLogs = logsSnap.docs.map(d => d.data() as any);
      const allFeedStock = feedStockSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const allMedStock = medStockSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let updatedCount = 0;

      // --- Healing Passive: Restore initialQuantity if missing ---
      for (const stock of allFeedStock as any[]) {
        if (!stock.initialQuantity || !stock.unitPrice) {
          const userLogs = allLogs.filter((l: any) => l.userId === stock.userId && l.consumption?.feedType === stock.type);
          const totalConsumed = userLogs.reduce((sum, log: any) => sum + (Number(log.consumption?.feedIntake) || 0), 0);
          const estimatedInitial = Number(stock.quantity) + totalConsumed;
          
          if (estimatedInitial > 0 && stock.purchaseCost > 0) {
            const unitPrice = stock.purchaseCost / estimatedInitial;
            await updateDoc(doc(db, 'feedStock', stock.id), {
              initialQuantity: estimatedInitial,
              unitPrice: unitPrice
            });
            // Update local copy
            stock.initialQuantity = estimatedInitial;
            stock.unitPrice = unitPrice;
          }
        }
      }

      for (const stock of allMedStock as any[]) {
        if (!stock.initialQuantity || !stock.unitPrice) {
          const userLogs = allLogs.filter((l: any) => l.userId === stock.userId && (l.health?.medicines === stock.name || l.health?.vaccines === stock.name));
          const totalConsumed = userLogs.reduce((sum, log: any) => {
            if (log.health?.medicines === stock.name) return sum + (Number(log.health?.medicineDoses) || 0);
            if (log.health?.vaccines === stock.name) return sum + (Number(log.health?.vaccineDoses) || 0);
            return sum;
          }, 0);
          const estimatedInitial = Number(stock.quantity) + totalConsumed;

          if (estimatedInitial > 0 && stock.purchaseCost > 0) {
            const unitPrice = stock.purchaseCost / estimatedInitial;
            await updateDoc(doc(db, 'medicineStock', stock.id), {
              initialQuantity: estimatedInitial,
              unitPrice: unitPrice
            });
            // Update local copy
            stock.initialQuantity = estimatedInitial;
            stock.unitPrice = unitPrice;
          }
        }
      }
      // --- End Healing ---

      for (const flock of allFlocks as any[]) {
        const flockLogs = allLogs.filter((l: any) => l.flockId === flock.id);
        const farmerFeedStock = allFeedStock.filter((s: any) => s.userId === flock.userId);
        const farmerMedStock = allMedStock.filter((m: any) => m.userId === flock.userId);

        const chicksCost = Number(flock.chicksCost) || 0;
        let consumedFeedCost = 0;
        let consumedMedCost = 0;

        flockLogs.forEach((log: any) => {
          // Feed
          const intake = Number(log.consumption?.feedIntake) || 0;
          const fType = log.consumption?.feedType;
          if (intake > 0 && fType) {
            const stock = farmerFeedStock.find((s: any) => s.type === fType) as any;
            if (stock && typeof stock.purchaseCost === 'number') {
              const unitPrice = stock.unitPrice || (stock.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : (stock.purchaseCost / (stock.quantity || 1)));
              consumedFeedCost += intake * unitPrice;
            }
          }
          // Med
          const mName = log.health?.medicines;
          const mDoses = Number(log.health?.medicineDoses) || 0;
          if (mDoses > 0 && mName && mName !== 'none') {
            const stock = farmerMedStock.find((s: any) => s.name === mName) as any;
            if (stock && typeof stock.purchaseCost === 'number') {
              const unitPrice = stock.unitPrice || (stock.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : (stock.purchaseCost / (stock.quantity || 1)));
              consumedMedCost += mDoses * unitPrice;
            }
          }
          // Vac
          const vName = log.health?.vaccines;
          const vDoses = Number(log.health?.vaccineDoses) || 0;
          if (vDoses > 0 && vName && vName !== 'none') {
            const stock = farmerMedStock.find((s: any) => s.name === vName) as any;
            if (stock && typeof stock.purchaseCost === 'number') {
              const unitPrice = stock.unitPrice || (stock.initialQuantity ? (stock.purchaseCost / stock.initialQuantity) : (stock.purchaseCost / (stock.quantity || 1)));
              consumedMedCost += vDoses * unitPrice;
            }
          }
        });

        const totalOperationalCost = chicksCost + consumedFeedCost + consumedMedCost;
        const currentCount = Number(flock.currentCount) || Number(flock.initialCount) || 1;
        const costPerBird = totalOperationalCost / currentCount;

        await updateDoc(doc(db, 'flocks', flock.id), {
          costPerBird: Number(costPerBird.toFixed(2))
        });
        updatedCount++;
      }

      toast.success(`Successfully recalculated costs for ${updatedCount} flocks`);
    } catch (error) {
      console.error('Recalculation error:', error);
      toast.error('Failed to recalculate costs');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'system', 'settings'), settings);
      // Sync to server for backend access
      try {
        await fetch('/.netlify/functions/sync-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch (syncError) {
        console.error("Sync to server failed:", syncError);
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleBackup = async () => {
    setIsBackupLoading(true);
    try {
      const collections = ['users', 'flocks', 'dailyLogs', 'transactions', 'feedStock', 'medicineStock', 'orders', 'shopItems'];
      const backupData: any = {};

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poultry_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup completed successfully');
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Backup failed');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (newRole === 'admin' && userId !== ADMIN_UID) {
      toast.error('Only one designated administrator is allowed');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteTerm = async (id: string) => {
    const updatedList = Array.isArray(settings.termsList) ? settings.termsList.filter((t: any) => t.id !== id) : [];
    try {
      await updateDoc(doc(db, 'system', 'settings'), {
        termsList: updatedList
      });
      toast.success('Terms document removed');
    } catch (error) {
      toast.error('Failed to delete terms');
    }
  };

  const handleAddTerm = async () => {
    if (!newTerm.title || !newTerm.content) {
      toast.error('Title and content are required');
      return;
    }

    const term = {
      id: editingTerm ? editingTerm.id : Date.now().toString(),
      title: newTerm.title,
      content: newTerm.content,
      createdAt: editingTerm ? editingTerm.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let updatedList;
    if (editingTerm) {
      updatedList = settings.termsList.map((t: any) => t.id === editingTerm.id ? term : t);
    } else {
      updatedList = Array.isArray(settings.termsList) ? [...settings.termsList, term] : [term];
    }
    
    try {
      await updateDoc(doc(db, 'system', 'settings'), {
        termsList: updatedList
      });
      setNewTerm({ title: '', content: '' });
      setEditingTerm(null);
      setIsTermDialogOpen(false);
      toast.success(editingTerm ? 'Terms document updated' : 'Terms document published');
    } catch (error) {
      toast.error('Failed to save terms');
    }
  };

  const handleAddFooterPage = () => {
    const newPage = {
      id: Date.now().toString(),
      title: 'New Page',
      slug: 'new-page',
      content: ''
    };
    setSettings(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        pages: [...(prev.footer.pages || []), newPage]
      }
    }));
  };

  const handleUpdateFooterPage = (id: string, updates: any) => {
    setSettings(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        pages: (prev.footer.pages || []).map((p: any) => p.id === id ? { ...p, ...updates } : p)
      }
    }));
  };

  const handleDeleteFooterPage = (id: string) => {
    setSettings(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        pages: (prev.footer.pages || []).filter((p: any) => p.id !== id)
      }
    }));
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">System Control</h1>
        <p className="text-slate-500 font-medium">Configure global application settings, manage security protocols, and system maintenance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {/* General Settings */}
          <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'general' ? 'p-8' : 'p-0'}`}>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setActiveSection(activeSection === 'general' ? null : 'general')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'general' ? null : 'general'); }}
              className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'general' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
                  <Settings size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-900">General Configuration</h3>
                  <p className="text-xs text-slate-400 font-medium">Basic system-wide operational settings.</p>
                </div>
              </div>
              {activeSection === 'general' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </div>

            {activeSection === 'general' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-slate-900">Maintenance Mode</Label>
                    <p className="text-xs text-slate-500">Disable public access for scheduled maintenance.</p>
                  </div>
                  <Switch 
                    checked={settings.maintenanceMode} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maintenanceMode: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-slate-900">Farmer Registration</Label>
                    <p className="text-xs text-slate-500">Allow new farmers to sign up on the platform.</p>
                  </div>
                  <Switch 
                    checked={settings.registrationOpen} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, registrationOpen: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">SYSTEM TIMEZONE</Label>
                  <select 
                    className="w-full h-12 bg-slate-50 border-slate-100 rounded-xl px-4 text-sm font-medium"
                    value={settings.timezone}
                    onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  >
                    <option>Asia/Kolkata (IST)</option>
                    <option>UTC</option>
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* System Configuration (Google APIs) */}
          {profile?.role === 'admin' && (
            <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'system' ? 'p-8' : 'p-0'}`}>
              <div 
                role="button"
                tabIndex={0}
                onClick={() => setActiveSection(activeSection === 'system' ? null : 'system')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'system' ? null : 'system'); }}
                className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'system' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                    <Cpu size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-slate-900">System Configuration</h3>
                    <p className="text-xs text-slate-400 font-medium">Manage Google Cloud & AI service integrations.</p>
                  </div>
                </div>
                {activeSection === 'system' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>

              {activeSection === 'system' && (
                <div className="space-y-8">
                  {Object.entries(settings.googleApis || {}).map(([key, config]: [string, any]) => (
                    <div key={key} className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Box size={16} />
                          </div>
                          <Label className="font-bold text-slate-900 capitalize">{key} API</Label>
                        </div>
                        <Switch 
                          checked={config.enabled} 
                          onCheckedChange={(checked) => setSettings(prev => ({ 
                            ...prev, 
                            googleApis: { 
                              ...prev.googleApis, 
                              [key]: { ...prev.googleApis[key as keyof typeof prev.googleApis], enabled: checked } 
                            } 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API KEY / CREDENTIALS</Label>
                        <Input 
                          placeholder={`Enter ${key} API Key`}
                          type="password"
                          className="rounded-xl h-12 bg-white"
                          value={config.apiKey}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            googleApis: { 
                              ...prev.googleApis, 
                              [key]: { ...prev.googleApis[key as keyof typeof prev.googleApis], apiKey: e.target.value } 
                            } 
                          }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Manage Terms & Conditions */}
          <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'terms' ? 'p-8' : 'p-0'}`}>
            <div className={`transition-all duration-300 ${activeSection === 'terms' ? '' : 'hover:bg-slate-50'}`}>
              <div 
                role="button"
                tabIndex={0}
                onClick={() => setActiveSection(activeSection === 'terms' ? null : 'terms')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'terms' ? null : 'terms'); }}
                className={`w-full flex items-center justify-between cursor-pointer ${activeSection === 'terms' ? 'mb-8' : 'p-8'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                    <FileText size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-slate-900">Terms & Conditions</h3>
                    <p className="text-xs text-slate-400 font-medium">Manage legal agreements for farmers.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {activeSection === 'terms' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {activeSection === 'terms' && (
                <div className="space-y-6">
                  <div className="flex justify-end">
                    <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          className="bg-[#122B21] hover:bg-[#1a3d2e] rounded-xl font-bold gap-2"
                          onClick={() => {
                            setEditingTerm(null);
                            setNewTerm({ title: '', content: '' });
                            setIsTermDialogOpen(true);
                          }}
                        >
                          <Plus size={18} />
                          <span>Create New</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[2rem] sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
                      <DialogHeader className="p-8 pb-4">
                        <DialogTitle className="text-2xl font-black italic">{editingTerm ? 'Edit Agreement' : 'New Agreement'}</DialogTitle>
                        <DialogDescription>{editingTerm ? 'Update existing terms and conditions document.' : 'Create a new terms and conditions document for your farmers.'}</DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DOCUMENT TITLE</Label>
                          <Input 
                            placeholder="e.g. Data Privacy Policy v1.0" 
                            className="rounded-2xl h-14 bg-slate-50 border-slate-100 border-2 focus:ring-slate-900"
                            value={newTerm.title}
                            onChange={(e) => setNewTerm({ ...newTerm, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2 flex-1 flex flex-col min-h-0">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CONTENT (MARKDOWN SUPPORTED)</Label>
                          <div className="flex-1 min-h-[300px] border-2 border-slate-100 rounded-3xl bg-slate-50 overflow-hidden flex flex-col">
                            <textarea 
                              className="flex-1 p-6 bg-transparent border-none focus:ring-0 text-sm font-medium resize-none"
                              placeholder="Enter terms content... Use markdown for headers, lists, and bold text."
                              value={newTerm.content}
                              onChange={(e) => setNewTerm({ ...newTerm, content: e.target.value })}
                            />
                            <div className="bg-white border-t border-slate-100 p-3 flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                              <span># Header</span>
                              <span>**Bold**</span>
                              <span>- List</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          className="rounded-xl px-6" 
                          onClick={() => setNewTerm({ title: '', content: '' })}
                        >
                          Reset
                        </Button>
                        <Button 
                          className="bg-[#122B21] hover:bg-[#1a3d2e] rounded-xl px-8 font-bold"
                          onClick={handleAddTerm}
                        >
                          Save & Publish
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                {Array.isArray(settings.termsList) && settings.termsList.length > 0 ? (
                  <div className="grid gap-3">
                    {settings.termsList.map((term: any) => (
                      <div key={term.id} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-slate-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-400">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{term.title}</p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Updated: {new Date(term.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-emerald-500 rounded-xl" 
                            onClick={() => {
                              setEditingTerm(term);
                              setNewTerm({ title: term.title, content: term.content });
                              setIsTermDialogOpen(true);
                            }}
                          >
                            <Pencil size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 rounded-xl" onClick={() => handleDeleteTerm(term.id)}>
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <FileText className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-slate-400 font-bold">No agreements found</p>
                    <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-1">Create your first terms & conditions document</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Footer Management */}
      <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'footer' ? 'p-8' : 'p-0'}`}>
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setActiveSection(activeSection === 'footer' ? null : 'footer')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'footer' ? null : 'footer'); }}
          className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'footer' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
              <Globe size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-slate-900">Footer Management</h3>
              <p className="text-xs text-slate-400 font-medium">Manage site footer, contact info and custom pages.</p>
            </div>
          </div>
          {activeSection === 'footer' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
        </div>

        {activeSection === 'footer' && (
          <div className="space-y-8">
            {/* Branding & Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FOOTER LOGO URL</Label>
                  <div className="relative">
                    <Input 
                      placeholder="https://example.com/logo.png"
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 pl-10"
                      value={settings.footer?.logo}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        footer: { ...prev.footer, logo: e.target.value } 
                      }))}
                    />
                    <ImageIcon className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ABOUT TEXT</Label>
                  <textarea 
                    className="w-full rounded-xl bg-slate-50 border-slate-100 p-3 text-sm focus:ring-0 min-h-[100px]"
                    placeholder="Short description about the platform..."
                    value={settings.footer?.footerText}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, footerText: e.target.value } 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COPYRIGHT TEXT</Label>
                  <Input 
                    placeholder="© 2026 PoultryPro Management System. All rights reserved."
                    className="rounded-xl h-12 bg-slate-50 border-slate-100"
                    value={settings.footer?.copyrightText}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, copyrightText: e.target.value } 
                    }))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CONTACT NUMBER</Label>
                  <div className="relative">
                    <Input 
                      placeholder="+91 12345 67890"
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 pl-10"
                      value={settings.footer?.contactNumber}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        footer: { ...prev.footer, contactNumber: e.target.value } 
                      }))}
                    />
                    <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CONTACT EMAIL</Label>
                  <div className="relative">
                    <Input 
                      placeholder="contact@poultrypro.com"
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 pl-10"
                      value={settings.footer?.contactEmail}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        footer: { ...prev.footer, contactEmail: e.target.value } 
                      }))}
                    />
                    <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OFFICE ADDRESS</Label>
                  <div className="relative">
                    <Input 
                      placeholder="123 Farm Street, Agrotech Nagar"
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 pl-10"
                      value={settings.footer?.address}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        footer: { ...prev.footer, address: e.target.value } 
                      }))}
                    />
                    <MapPin className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GOOGLE MAP LINK</Label>
                  <div className="relative">
                    <Input 
                      placeholder="https://goo.gl/maps/..."
                      className="rounded-xl h-12 bg-slate-50 border-slate-100 pl-10"
                      value={settings.footer?.googleMapLink}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        footer: { ...prev.footer, googleMapLink: e.target.value } 
                      }))}
                    />
                    <Globe className="absolute left-3 top-3.5 text-slate-400" size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SOCIAL MEDIA LINKS</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="relative">
                  <Input 
                    placeholder="Facebook URL"
                    className="rounded-xl h-11 bg-slate-50 border-slate-100 pl-10"
                    value={settings.footer?.socialLinks?.facebook}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, socialLinks: { ...prev.footer.socialLinks, facebook: e.target.value } } 
                    }))}
                  />
                  <Facebook className="absolute left-3 top-3 text-slate-400" size={16} />
                </div>
                <div className="relative">
                  <Input 
                    placeholder="Instagram URL"
                    className="rounded-xl h-11 bg-slate-50 border-slate-100 pl-10"
                    value={settings.footer?.socialLinks?.instagram}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, socialLinks: { ...prev.footer.socialLinks, instagram: e.target.value } } 
                    }))}
                  />
                  <Instagram className="absolute left-3 top-3 text-slate-400" size={16} />
                </div>
                <div className="relative">
                  <Input 
                    placeholder="Twitter URL"
                    className="rounded-xl h-11 bg-slate-50 border-slate-100 pl-10"
                    value={settings.footer?.socialLinks?.twitter}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, socialLinks: { ...prev.footer.socialLinks, twitter: e.target.value } } 
                    }))}
                  />
                  <Twitter className="absolute left-3 top-3 text-slate-400" size={16} />
                </div>
                <div className="relative">
                  <Input 
                    placeholder="LinkedIn URL"
                    className="rounded-xl h-11 bg-slate-50 border-slate-100 pl-10"
                    value={settings.footer?.socialLinks?.linkedin}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, socialLinks: { ...prev.footer.socialLinks, linkedin: e.target.value } } 
                    }))}
                  />
                  <Linkedin className="absolute left-3 top-3 text-slate-400" size={16} />
                </div>
                <div className="relative">
                  <Input 
                    placeholder="YouTube URL"
                    className="rounded-xl h-11 bg-slate-50 border-slate-100 pl-10"
                    value={settings.footer?.socialLinks?.youtube}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      footer: { ...prev.footer, socialLinks: { ...prev.footer.socialLinks, youtube: e.target.value } } 
                    }))}
                  />
                  <Youtube className="absolute left-3 top-3 text-slate-400" size={16} />
                </div>
              </div>
            </div>

            {/* Custom Pages */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CUSTOM PAGES (T&C, PRIVACY, ETC.)</Label>
                  <p className="text-[10px] text-slate-400 font-medium italic">Footer links for legal documents and info.</p>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="rounded-xl gap-2 font-black text-[10px] uppercase tracking-tighter text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <FileText size={14} /> Import from T&C
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2rem] max-w-md">
                      <DialogHeader>
                        <DialogTitle>Import from Terms & Conditions</DialogTitle>
                        <DialogDescription>Quickly add an existing T&C document as a footer page.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 max-h-[40vh] overflow-y-auto p-2">
                        {settings.termsList?.map((term: any) => (
                          <div 
                            key={term.id} 
                            className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
                            onClick={() => {
                              const slug = term.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                              const exists = settings.footer?.pages?.some((p: any) => p.slug === slug);
                              if (exists) {
                                toast.error('A page with this name already exists in the footer');
                                return;
                              }
                              const newPage = {
                                id: Date.now().toString(),
                                title: term.title,
                                slug: slug,
                                content: term.content
                              };
                              setSettings(prev => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  pages: [...(prev.footer.pages || []), newPage]
                                }
                              }));
                              toast.success('Page imported to footer');
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="text-slate-400 group-hover:text-emerald-500" size={18} />
                              <span className="font-bold text-slate-900">{term.title}</span>
                            </div>
                            <Plus size={16} className="text-slate-300" />
                          </div>
                        ))}
                        {(!settings.termsList || settings.termsList.length === 0) && (
                          <div className="text-center py-8">
                            <p className="text-xs text-slate-400">No terms documents available to import.</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-xl gap-2 font-bold text-xs"
                    onClick={handleAddFooterPage}
                  >
                    <Plus size={14} /> Add New
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                {settings.footer?.pages?.map((page: any) => (
                  <div key={page.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-center gap-4">
                      <Input 
                        placeholder="Page Title"
                        className="bg-white rounded-xl h-10 font-bold"
                        value={page.title}
                        onChange={(e) => handleUpdateFooterPage(page.id, { title: e.target.value })}
                      />
                      <Input 
                        placeholder="Slug (e.g. privacy-policy)"
                        className="bg-white rounded-xl h-10 text-xs"
                        value={page.slug}
                        onChange={(e) => handleUpdateFooterPage(page.id, { slug: e.target.value })}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                        onClick={() => handleDeleteFooterPage(page.id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                    <textarea 
                      className="w-full bg-white border border-slate-100 rounded-xl p-4 text-sm min-h-[150px] focus:ring-0"
                      placeholder="Page Content (HTML/Markdown supported)..."
                      value={page.content}
                      onChange={(e) => handleUpdateFooterPage(page.id, { content: e.target.value })}
                    />
                  </div>
                ))}

                {(!settings.footer?.pages || settings.footer.pages.length === 0) && (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-bold">No custom footer pages added.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Role Management */}
          <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'roles' ? 'p-8' : 'p-0'}`}>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setActiveSection(activeSection === 'roles' ? null : 'roles')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'roles' ? null : 'roles'); }}
              className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'roles' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                  <Shield size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-900">Role & Permissions</h3>
                  <p className="text-xs text-slate-400 font-medium">Define access levels for different user types.</p>
                </div>
              </div>
              {activeSection === 'roles' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </div>

            {activeSection === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Administrator</p>
                      <p className="text-xs text-slate-500">Full system access and control.</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-500 border-none">{admins.length} USERS</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Sub-Admin / Roles</p>
                      <p className="text-xs text-slate-500">Manage user access levels.</p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs">MANAGE</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl rounded-[2rem]">
                      <DialogHeader>
                        <DialogTitle>User Role Management</DialogTitle>
                      </DialogHeader>
                      <div className="max-h-[400px] overflow-y-auto space-y-4 p-2">
                        {allUsers.map(user => (
                          <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <div>
                              <p className="font-bold text-slate-900">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                              <Badge variant="outline" className="mt-1 text-[10px] uppercase">{user.role}</Badge>
                            </div>
                              {user.id === ADMIN_UID ? (
                                <Badge className="bg-emerald-100 text-emerald-600 border-none">SYSTEM ADMIN</Badge>
                              ) : (
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant={user.role === 'admin' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateRole(user.id, 'admin')}
                                    className="text-[10px] h-8"
                                    disabled={true} // Strict mode: no other admins
                                  >
                                    Admin
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant={user.role === 'manager' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateRole(user.id, 'manager')}
                                    className="text-[10px] h-8 transition-all hover:bg-slate-900 hover:text-white"
                                  >
                                    Manager
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant={user.role === 'farmer' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateRole(user.id, 'farmer')}
                                    className="text-[10px] h-8 transition-all hover:bg-slate-900 hover:text-white"
                                  >
                                    Farmer
                                  </Button>
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Globe size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Farmer</p>
                      <p className="text-xs text-slate-500">Standard farm operational access.</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-500 border-none">ACTIVE</Badge>
                </div>
              </div>
            )}
          </Card>

          {/* Wallet & Rewards Config */}
          <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'wallet_settings' ? 'p-8' : 'p-0'}`}>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setActiveSection(activeSection === 'wallet_settings' ? null : 'wallet_settings')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'wallet_settings' ? null : 'wallet_settings'); }}
              className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'wallet_settings' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                  <DollarSign size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-slate-900">Wallet & Withdrawals</h3>
                  <p className="text-xs text-slate-400 font-medium">Configure withdrawal limits and reward settings.</p>
                </div>
              </div>
              {activeSection === 'wallet_settings' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </div>

            {activeSection === 'wallet_settings' && (
              <div className="space-y-6">
                <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MINIMUM REWARD WITHDRAWAL (₹)</Label>
                    <Input 
                      type="number"
                      placeholder="e.g. 500"
                      className="rounded-xl h-12 bg-white"
                      value={settings.minRewardWithdraw || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, minRewardWithdraw: Number(e.target.value) }))}
                    />
                    <p className="text-[10px] text-slate-400 font-medium">Minimum amount required in reward wallet to request a withdrawal.</p>
                  </div>
                </div>

                <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WALLET WITHDRAWAL POLICY</Label>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Main wallet withdrawal has no lower limit (₹0+) if balance is available. Reward wallet withdrawals are subject to the limit set above.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Payment Gateways */}
          {profile?.role === 'admin' && (
            <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'payments' ? 'p-8' : 'p-0'}`}>
              <div 
                role="button"
                tabIndex={0}
                onClick={() => setActiveSection(activeSection === 'payments' ? null : 'payments')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveSection(activeSection === 'payments' ? null : 'payments'); }}
                className={`w-full flex items-center justify-between transition-all duration-300 cursor-pointer ${activeSection === 'payments' ? 'mb-8' : 'p-8 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                    <DollarSign size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-slate-900">Payment Gateways</h3>
                    <p className="text-xs text-slate-400 font-medium">Configure payment integration for shop transactions.</p>
                  </div>
                </div>
                {activeSection === 'payments' ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>

              {activeSection === 'payments' && (
                <div className="space-y-8">
                  {/* Razorpay */}
                  <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">RZ</div>
                        <div className="text-left">
                          <Label className="font-bold text-slate-900 block">Razorpay</Label>
                          <p className="text-[10px] text-slate-500 font-medium">Standard Indian payment gateway.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select 
                          className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold px-2 h-7 focus:ring-0"
                          value={settings.paymentGateways?.razorpay?.mode || 'sandbox'}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, razorpay: { ...prev.paymentGateways.razorpay, mode: e.target.value } } 
                          }))}
                        >
                          <option value="sandbox">SANDBOX</option>
                          <option value="production">PRODUCTION</option>
                        </select>
                        <Switch 
                          checked={settings.paymentGateways?.razorpay?.enabled} 
                          onCheckedChange={(checked) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, razorpay: { ...prev.paymentGateways.razorpay, enabled: checked } } 
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API KEY</Label>
                        <Input 
                          placeholder="rzp_test_..." 
                          className="rounded-xl"
                          value={settings.paymentGateways?.razorpay?.apiKey}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, razorpay: { ...prev.paymentGateways.razorpay, apiKey: e.target.value } } 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API SECRET</Label>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="rounded-xl"
                          value={settings.paymentGateways?.razorpay?.apiSecret}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, razorpay: { ...prev.paymentGateways.razorpay, apiSecret: e.target.value } } 
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cashfree */}
                  <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white text-[10px] font-bold">CF</div>
                        <div className="text-left">
                          <Label className="font-bold text-slate-900 block">Cashfree</Label>
                          <p className="text-[10px] text-slate-500 font-medium">Fast settlements and wide range of payments.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select 
                          className="bg-white border border-slate-200 rounded-lg text-[10px] font-bold px-2 h-7 focus:ring-0"
                          value={settings.paymentGateways?.cashfree?.mode || 'sandbox'}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, cashfree: { ...prev.paymentGateways.cashfree, mode: e.target.value } } 
                          }))}
                        >
                          <option value="sandbox">SANDBOX</option>
                          <option value="production">PRODUCTION</option>
                        </select>
                        <Switch 
                          checked={settings.paymentGateways?.cashfree?.enabled} 
                          onCheckedChange={(checked) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, cashfree: { ...prev.paymentGateways.cashfree, enabled: checked } } 
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">APP ID</Label>
                        <Input 
                          placeholder="Enter App ID" 
                          className="rounded-xl"
                          value={settings.paymentGateways?.cashfree?.appId}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, cashfree: { ...prev.paymentGateways.cashfree, appId: e.target.value } } 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SECRET KEY</Label>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="rounded-xl"
                          value={settings.paymentGateways?.cashfree?.secretKey}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, cashfree: { ...prev.paymentGateways.cashfree, secretKey: e.target.value } } 
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* PayU */}
                  <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">PU</div>
                        <Label className="font-bold text-slate-900">PayU</Label>
                      </div>
                      <Switch 
                        checked={settings.paymentGateways?.payu?.enabled} 
                        onCheckedChange={(checked) => setSettings(prev => ({ 
                          ...prev, 
                          paymentGateways: { ...prev.paymentGateways, payu: { ...prev.paymentGateways.payu, enabled: checked } } 
                        }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MERCHANT KEY</Label>
                        <Input 
                          placeholder="Enter Key" 
                          className="rounded-xl"
                          value={settings.paymentGateways?.payu?.merchantKey}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, payu: { ...prev.paymentGateways.payu, merchantKey: e.target.value } } 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MERCHANT SALT</Label>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="rounded-xl"
                          value={settings.paymentGateways?.payu?.merchantSalt}
                          onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            paymentGateways: { ...prev.paymentGateways, payu: { ...prev.paymentGateways.payu, merchantSalt: e.target.value } } 
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cash on Delivery */}
                  <div className="p-6 rounded-[1.5rem] bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold">COD</div>
                        <div className="text-left">
                          <Label className="font-bold text-slate-900 block">Cash on Delivery (COD)</Label>
                          <p className="text-[10px] text-slate-500 font-medium tracking-tight">Allow farmers to pay upon delivery.</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.paymentGateways?.cashOnDelivery?.enabled} 
                        onCheckedChange={(checked) => setSettings(prev => ({ 
                          ...prev, 
                          paymentGateways: { ...prev.paymentGateways, cashOnDelivery: { ...prev.paymentGateways.cashOnDelivery, enabled: checked } } 
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* Notifications */}
          <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'notifs' ? 'p-8' : 'p-0'}`}>
            <button 
              onClick={() => setActiveSection(activeSection === 'notifs' ? null : 'notifs')}
              className={`w-full flex items-center justify-between transition-all duration-300 ${activeSection === 'notifs' ? 'mb-6' : 'p-8 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                  <Bell size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Alert Settings</h3>
              </div>
              {activeSection === 'notifs' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {activeSection === 'notifs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Email Alerts</span>
                  <Switch 
                    checked={settings.emailAlerts} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, emailAlerts: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">SMS Notifications</span>
                  <Switch 
                    checked={settings.smsNotifications} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, smsNotifications: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">In-App Alerts</span>
                  <Switch 
                    checked={settings.inAppAlerts} 
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, inAppAlerts: checked }))}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Backup */}
          {profile?.role === 'admin' && (
            <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'backup' ? 'p-8' : 'p-0'}`}>
              <button 
                onClick={() => setActiveSection(activeSection === 'backup' ? null : 'backup')}
                className={`w-full flex items-center justify-between transition-all duration-300 ${activeSection === 'backup' ? 'mb-6' : 'p-8 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                    <Database size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Data Backup</h3>
                </div>
                {activeSection === 'backup' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {activeSection === 'backup' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Last backup performed: <span className="font-bold">Just now</span>. Automatic backups are scheduled daily at 02:00 AM.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="rounded-xl flex items-center gap-2">
                      <RefreshCw size={16} />
                      <span>Sync</span>
                    </Button>
                    <Button 
                      className="bg-[#122B21] text-white rounded-xl"
                      onClick={handleBackup}
                      disabled={isBackupLoading}
                    >
                      {isBackupLoading ? 'Backing up...' : 'Backup Now'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* System Maintenance */}
          {profile?.role === 'admin' && (
            <Card className={`border-none shadow-sm bg-white rounded-[2rem] overflow-hidden transition-all duration-300 ${activeSection === 'maintenance' ? 'p-8' : 'p-0'}`}>
              <button 
                onClick={() => setActiveSection(activeSection === 'maintenance' ? null : 'maintenance')}
                className={`w-full flex items-center justify-between transition-all duration-300 ${activeSection === 'maintenance' ? 'mb-6' : 'p-8 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-red-50 p-3 rounded-2xl text-red-600">
                    <Activity size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">System Maintenance</h3>
                </div>
                {activeSection === 'maintenance' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {activeSection === 'maintenance' && (
                <div className="space-y-4 px-8 pb-8">
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Recalculate and update the <span className="font-bold italic">Cost per Bird</span> for all flocks across all users using the new formula.
                  </p>
                  <Button 
                    variant="destructive"
                    className="w-full rounded-xl flex items-center justify-center gap-2"
                    onClick={handleRecalculateAllCosts}
                    disabled={isRecalculating}
                  >
                    <RefreshCw className={isRecalculating ? "animate-spin" : ""} size={16} />
                    {isRecalculating ? 'Recalculating...' : 'Recalculate All costs'}
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Button 
            className="w-full h-16 rounded-2xl bg-[#122B21] hover:bg-[#1a3d2e] text-white font-bold text-lg flex items-center justify-center gap-3 shadow-xl"
            onClick={handleSave}
          >
            <Save size={24} />
            Save All Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
