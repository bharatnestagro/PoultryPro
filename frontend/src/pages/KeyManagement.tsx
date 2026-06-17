import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  KeyRound, PlusCircle, Trash2, Search, CheckCircle2, 
  HelpCircle, Sparkles, Filter, Copy, ClipboardCheck, Edit2,
  Users, Calendar, AlertTriangle, ShieldCheck, ShieldAlert, X
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

const KeyManagement: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Key creation state
  const [newKeyPlan, setNewKeyPlan] = useState('Starter');
  const [newKeyAllotTo, setNewKeyAllotTo] = useState('None');

  // Key editing state
  const [editingKey, setEditingKey] = useState<any | null>(null);
  const [editPlan, setEditPlan] = useState('Starter');
  const [editStatus, setEditStatus] = useState('Unused');
  const [editAllotTo, setEditAllotTo] = useState('None');
  const [editDaysRemaining, setEditDaysRemaining] = useState(365);

  useEffect(() => {
    // 1. Fetch license keys in real-time
    const unsubKeys = onSnapshot(
      collection(db, 'licenseKeys'),
      (snap) => {
        setKeys(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback mock keys
        setKeys([
          {
            id: 'mock-key-1',
            key: 'AGRI-STAR-9022-7711',
            plan: 'Starter',
            status: 'Unused',
            createdAt: new Date().toISOString()
          },
          {
            id: 'mock-key-2',
            key: 'AGRI-COMM-4311-2099',
            plan: 'Commercial',
            status: 'Used',
            usedBy: 'farmer-101',
            createdAt: new Date().toISOString(),
            usedAt: new Date().toISOString()
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch farmers list in real-time
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubKeys();
      unsubFarmers();
    };
  }, []);

  const getFarmerDetails = (id: string) => {
    const farmer = farmers.find(f => f.id === id);
    if (!farmer) return { name: id || 'N/A', email: '', phone: '', active: false };
    return {
      id: farmer.id,
      name: farmer.name || farmer.displayName || 'N/A',
      email: farmer.email || '',
      phone: farmer.phone || farmer.mobile || '',
      active: !!farmer.licenseActive,
      activatedAt: farmer.licenseActivatedAt || null
    };
  };

  const getRemainingDays = (activatedAt: string | null, active: boolean) => {
    if (!active || !activatedAt) return 0;
    const ad = new Date(activatedAt);
    const daysUsed = Math.floor((Date.now() - ad.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, 365 - daysUsed);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create random key: AGRI-{PLAN}-{8 random hex characters}
      const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
      const planCode = newKeyPlan.slice(0, 4).toUpperCase();
      const generated = `AGRI-${planCode}-${hex.slice(0, 4)}-${hex.slice(4)}`;

      const allottedToFarmer = newKeyAllotTo !== 'None' ? farmers.find(f => f.id === newKeyAllotTo) : null;

      await addDoc(collection(db, 'licenseKeys'), {
        key: generated,
        plan: newKeyPlan,
        status: 'Unused',
        createdAt: new Date().toISOString(),
        creatorId: user?.uid,
        allottedToUserId: allottedToFarmer ? allottedToFarmer.id : null,
        allottedToUserEmail: allottedToFarmer ? allottedToFarmer.email : null,
        allottedToUserName: allottedToFarmer ? (allottedToFarmer.name || allottedToFarmer.displayName) : null,
      });

      toast.success(`License key generated successfully! Key: ${generated}`);
      setShowAdd(false);
      setNewKeyAllotTo('None');
    } catch (err) {
      toast.error('Failed to generate license key');
    }
  };

  const handleOpenEdit = (keyItem: any) => {
    setEditingKey(keyItem);
    setEditPlan(keyItem.plan || 'Starter');
    setEditStatus(keyItem.status || 'Unused');
    setEditAllotTo(keyItem.allottedToUserId || 'None');

    const associatedUser = farmers.find(u => u.id === keyItem.usedBy);
    if (associatedUser && associatedUser.licenseActivatedAt) {
      const ad = new Date(associatedUser.licenseActivatedAt);
      const daysUsed = Math.floor((Date.now() - ad.getTime()) / (1000 * 3600 * 24));
      setEditDaysRemaining(Math.max(0, 365 - daysUsed));
    } else {
      setEditDaysRemaining(365);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    try {
      const batch = writeBatch(db);
      const keyRef = doc(db, 'licenseKeys', editingKey.id);
      const isRedeemedStatus = editStatus === 'Used' || editStatus === 'Active';
      const isRevokedStatus = editStatus === 'Expired' || editStatus === 'Deactivated';

      const updateKeyPayload: any = {
        plan: editPlan,
        status: editStatus,
      };

      if (editAllotTo === 'None') {
        updateKeyPayload.allottedToUserId = null;
        updateKeyPayload.allottedToUserEmail = null;
        updateKeyPayload.allottedToUserName = null;
      } else {
        const allottedFarmer = farmers.find(f => f.id === editAllotTo);
        if (allottedFarmer) {
          updateKeyPayload.allottedToUserId = allottedFarmer.id;
          updateKeyPayload.allottedToUserEmail = allottedFarmer.email || '';
          updateKeyPayload.allottedToUserName = allottedFarmer.name || allottedFarmer.displayName || '';
        }
      }

      batch.update(keyRef, updateKeyPayload);

      // If key is used or associated with a user, propagate changes to their profile document
      const targetUserId = editingKey.usedBy || (editAllotTo !== 'None' ? editAllotTo : null);
      if (targetUserId) {
        const userRef = doc(db, 'users', targetUserId);
        const userPayload: any = {
          licenseKey: editingKey.key,
        };

        if (isRevokedStatus) {
          userPayload.licenseActive = false;
        } else if (isRedeemedStatus) {
          userPayload.licenseActive = true;
          
          // Back-calculate activation date based on remaining days entered
          const daysRemaining = Number(editDaysRemaining) || 0;
          const shiftMs = (365 - daysRemaining) * 24 * 3600 * 1000;
          userPayload.licenseActivatedAt = new Date(Date.now() - shiftMs).toISOString();
        }

        batch.update(userRef, userPayload);
      }

      await batch.commit();
      toast.success('License documentation updated successfully');
      setEditingKey(null);
    } catch (err: any) {
      toast.error(`Editing license key failed: ${err.message}`);
    }
  };

  const copyToClipboard = (keyStr: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKey(keyStr);
    toast.success('Key copied successfully');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async (item: any) => {
    try {
      const isUsed = item.status === 'Used' || item.status === 'Active' || !!item.usedBy;
      const warningMessage = isUsed
        ? `This key: "${item.key}" is currently registered as ACTIVE by ${getFarmerDetails(item.usedBy).name}. Purging it will revoke their license access instantly. Continue?`
        : `Are you positive you wish to remove this unused license key "${item.key}"?`;

      if (confirm(warningMessage)) {
        const batch = writeBatch(db);

        // Remove the key
        batch.delete(doc(db, 'licenseKeys', item.id));

        // Revoke associated user's profile access
        if (item.usedBy) {
          batch.update(doc(db, 'users', item.usedBy), {
            licenseActive: false,
            licenseKey: null
          });
        }

        await batch.commit();
        toast.success('License key purged successfully from directory');
      }
    } catch (err: any) {
      toast.error(`License key purge failed: ${err.message}`);
    }
  };

  // Farmer listing excluding admins/managers for selection options
  const onlyFarmers = farmers.filter(f => f.role !== 'admin' && f.role !== 'manager');

  const filtered = keys.filter(k => {
    const keyStr = (k.key || '').toLowerCase();
    const plan = (k.plan || '').toLowerCase();
    const status = (k.status || '').toLowerCase();
    const allottedName = (k.allottedToUserName || '').toLowerCase();
    const usedByEmail = (k.usedByEmail || '').toLowerCase();

    const matchesSearch = 
      keyStr.includes(searchTerm.toLowerCase()) || 
      plan.includes(searchTerm.toLowerCase()) || 
      status.includes(searchTerm.toLowerCase()) || 
      allottedName.includes(searchTerm.toLowerCase()) ||
      usedByEmail.includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none font-sans">
      
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <KeyRound size={32} className="text-[#0B2516]" />
            LICENSE KEY GENERATIONS & ACTIVATIONS
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Construct activation credentials, allocate standard quotas, edit active counts, and revoke logins.
          </p>
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-[#0B2516] hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Generate License Key
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6 font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">GENERATE LICENSE KEY</DialogTitle>
              <CardDescription className="text-xs">Create unique secure license key codes that unlock subscription tiers.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleGenerateKey} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-550 tracking-widest">Select Plan Tier</Label>
                <Select value={newKeyPlan} onValueChange={setNewKeyPlan}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold font-mono">
                    <SelectValue placeholder="Choose Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Standard Breeder (Starter Plan)</SelectItem>
                    <SelectItem value="Commercial">Commercial Hub Plan</SelectItem>
                    <SelectItem value="Enterprise">Enterprise High Growth Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-550 tracking-widest">Allot to Farmer (Optional)</Label>
                <Select value={newKeyAllotTo} onValueChange={setNewKeyAllotTo}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-mono">
                    <SelectValue placeholder="Select specific farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None - Open to Anyone</SelectItem>
                    {onlyFarmers.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name || f.displayName || f.email || f.id} ({f.phone || 'No phone'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-slate-400 font-medium">If allotted, only this specific account user can redeem the license key.</span>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest rounded-2xl text-xs text-white border-none">
                  Construct Authorization Key
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Database Table Registry */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Active Keys Database</CardTitle>
            <CardDescription className="text-xs">Provide these generated strings to breeders to unlock capabilities and reset limits.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search by keys, plan, email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-600">License Serial String</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-600">Target Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-600">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-600">Allotment / Conversion Info</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center text-slate-600 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs text-slate-450 font-bold uppercase tracking-wide">
                    No matching license authorization records found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const isRedeemed = item.status === 'Used' || item.status === 'Active' || !!item.usedBy;
                  const associatedDetails = isRedeemed ? getFarmerDetails(item.usedBy) : null;
                  const remainingDays = associatedDetails ? getRemainingDays(associatedDetails.activatedAt, associatedDetails.active) : 0;

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Key Code & Copier */}
                      <TableCell className="py-4 font-mono text-xs font-black select-text text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200">{item.key}</span>
                          <button 
                            onClick={() => copyToClipboard(item.key)}
                            className="text-slate-450 hover:text-emerald-600 transition-all p-1 hover:bg-slate-100 rounded-md"
                            title="Copy Key String"
                          >
                            {copiedKey === item.key ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </TableCell>
                      
                      {/* Plan Tier Badge */}
                      <TableCell>
                        <Badge className={`${
                          item.plan === 'Enterprise' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : item.plan === 'Commercial'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        } font-extrabold uppercase text-[9px] rounded-full px-2.5 py-0.5 shadow-none`}>
                          {item.plan || 'Starter'}
                        </Badge>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell>
                        <Badge className={`uppercase text-[9px] font-black rounded-full px-2.5 py-0.5 border shadow-none ${
                          item.status === 'Unused' 
                            ? 'bg-emerald-50/40 border-emerald-300 text-emerald-800 animate-pulse' 
                            : item.status === 'Expired'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : item.status === 'Deactivated'
                            ? 'bg-slate-100 border-slate-300 text-slate-600'
                            : 'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                          {item.status || 'Unused'}
                        </Badge>
                      </TableCell>

                      {/* Holder, Email, Phone, Expiry Days */}
                      <TableCell className="text-xs">
                        {isRedeemed && associatedDetails ? (
                          <div className="space-y-1 py-1 max-w-xs md:max-w-md">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900">{associatedDetails.name}</span>
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[8px] font-bold px-1 rounded shadow-none">Active User</Badge>
                            </div>
                            <div className="text-[10px] text-slate-500 space-y-0.5 font-medium leading-tight">
                              <p className="flex items-center gap-1"><span className="font-black text-slate-400 uppercase tracking-widest text-[8px]">Email:</span> {associatedDetails.email || 'N/A'}</p>
                              <p className="flex items-center gap-1"><span className="font-black text-slate-400 uppercase tracking-widest text-[8px]">Phone:</span> {associatedDetails.phone || 'N/A'}</p>
                              <p className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50 w-fit">
                                <Calendar size={10} />
                                <span>{remainingDays} days remaining of annual license limit</span>
                              </p>
                            </div>
                          </div>
                        ) : item.allottedToUserId ? (
                          <div className="space-y-1.5 py-1">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-slate-800">Reserved for:</span>
                              <Badge className="bg-amber-50 text-amber-700 border border-amber-250 text-[9px] font-black rounded-full px-2 py-0.5 shadow-none">{item.allottedToUserName}</Badge>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">Allotted user email: {item.allottedToUserEmail}</p>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">Available for open user registration</p>
                        )}
                      </TableCell>

                      {/* Action trigger columns */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenEdit(item)}
                            className="w-8 h-8 rounded-full text-slate-600 hover:bg-slate-100 hover:text-emerald-700 transition-colors"
                            title="Edit license key details"
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(item)}
                            className="w-8 h-8 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors animate-fade-in"
                            title="Delete license key"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Editing Dialog Configuration */}
      {editingKey && (
        <Dialog open={!!editingKey} onOpenChange={() => setEditingKey(null)}>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6 font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800 flex items-center gap-2">
                <Edit2 size={18} className="text-[#0B2516]" /> EDIT LICENSE KEY & STATUS
              </DialogTitle>
              <CardDescription className="text-xs">Adjust software limits, key reservation states, and reset user remaining days.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-3">
              {/* Key Code Representation */}
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Key serial code</Label>
                <div className="bg-slate-50 text-slate-700 font-mono text-sm font-bold p-3 rounded-2xl border border-slate-200 tracking-wider">
                  {editingKey.key}
                </div>
              </div>

              {/* Plan Choice Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest text-[#0B2516]">License Tier</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger className="h-11 rounded-2xl bg-white border-slate-200 text-xs font-bold font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Standard Breeder (Starter Plan)</SelectItem>
                    <SelectItem value="Commercial">Commercial Hub Plan</SelectItem>
                    <SelectItem value="Enterprise">Enterprise High Growth Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Selector Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest text-amber-800">License Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-11 rounded-2xl bg-white border-slate-200 text-xs font-bold font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unused">Unused (Available for conversion)</SelectItem>
                    <SelectItem value="Used">Used (Claimed/Active authorization)</SelectItem>
                    <SelectItem value="Expired">Expired (Revoke and prompt renewal)</SelectItem>
                    <SelectItem value="Deactivated">Deactivated (Suspended state)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allotment Allocation Selector Option */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest text-slate-700">Allotted Farmer reservation</Label>
                <Select value={editAllotTo} onValueChange={setEditAllotTo}>
                  <SelectTrigger className="h-11 rounded-2xl bg-white border-slate-200 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None - Open to Anyone</SelectItem>
                    {onlyFarmers.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name || f.displayName || f.email || f.id} ({f.phone || 'No phone'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reduce / Set Days remaining field */}
              {(editStatus === 'Used' || editStatus === 'Active') && (
                <div className="space-y-1.5 p-4 bg-amber-50/50 rounded-2xl border border-amber-100 animate-in slide-in-from-top-2 duration-250">
                  <Label htmlFor="daysRemainingEdit" className="text-[10px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1">
                    <Calendar size={12} /> Limit Days Remaining (out of 365)
                  </Label>
                  <Input 
                    type="number"
                    id="daysRemainingEdit"
                    min="0"
                    max="365"
                    value={editDaysRemaining}
                    onChange={e => setEditDaysRemaining(Math.min(365, Math.max(0, Number(e.target.value) || 0)))}
                    className="h-10 rounded-xl bg-white border-amber-200 text-slate-800 text-sm font-bold focus-visible:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-700 font-medium leading-tight block">
                    Modifying this decreases or increases days remaining in the user's active limit counter.
                  </span>
                </div>
              )}

              {/* Submit Buttons */}
              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingKey(null)}
                  className="rounded-2xl h-11 text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl h-11 text-xs font-bold uppercase tracking-wider text-white border-none"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};

export default KeyManagement;
