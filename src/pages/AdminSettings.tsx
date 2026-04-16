import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
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
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationOpen: true,
    emailAlerts: true,
    smsNotifications: false,
    inAppAlerts: true,
    timezone: 'Asia/Kolkata (IST)'
  });
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  useEffect(() => {
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
      if (doc.exists()) {
        setSettings(prev => ({ ...prev, ...doc.data() }));
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

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'system', 'settings'), settings);
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
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update role');
    }
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
        <div className="lg:col-span-2 space-y-8">
          {/* General Settings */}
          <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">General Configuration</h3>
                <p className="text-xs text-slate-400 font-medium">Basic system-wide operational settings.</p>
              </div>
            </div>

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
          </Card>

          {/* Role Management */}
          <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Role & Permissions</h3>
                <p className="text-xs text-slate-400 font-medium">Define access levels for different user types.</p>
              </div>
            </div>

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
                <Dialog>
                  <DialogTrigger render={
                    <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs">MANAGE</Button>
                  } />
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
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant={user.role === 'admin' ? 'default' : 'outline'}
                              onClick={() => handleUpdateRole(user.id, 'admin')}
                              className="text-[10px] h-8"
                            >
                              Admin
                            </Button>
                            <Button 
                              size="sm" 
                              variant={user.role === 'farmer' ? 'default' : 'outline'}
                              onClick={() => handleUpdateRole(user.id, 'farmer')}
                              className="text-[10px] h-8"
                            >
                              Farmer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
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
          </Card>
        </div>

        <div className="space-y-8">
          {/* Notifications */}
          <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
                <Bell size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Alert Settings</h3>
            </div>
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
          </Card>

          {/* Backup */}
          <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                <Database size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Data Backup</h3>
            </div>
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
          </Card>

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
