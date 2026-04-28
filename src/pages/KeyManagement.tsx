import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, Timestamp, setDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Key, Plus, Trash2, ShieldCheck, Clock, User, Calendar, History, List, Edit2, Send, Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const KeyManagement: React.FC = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [deletedKeys, setDeletedKeys] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [expiryDays, setExpiryDays] = useState<string>('365');
  const [targetFarmerId, setTargetFarmerId] = useState<string>('none');
  const [description, setDescription] = useState<string>('');
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGenDialog, setShowGenDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [assigningKey, setAssigningKey] = useState<any>(null);
  const [newValidity, setNewValidity] = useState<string>('');
  const [filterFarmer, setFilterFarmer] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'licenseKeys'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter for managers
      if (isManager && !isAdmin) {
        list = list.filter((k: any) => 
          k.createdBy === user?.uid || 
          farmers.some(f => f.id === k.usedBy)
        );
      }
      
      list.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setKeys(list);
    });

    const deletedQ = query(collection(db, 'deletedKeys'));
    const unsubscribeDeleted = onSnapshot(deletedQ, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => (b.deletedAt?.toMillis?.() || 0) - (a.deletedAt?.toMillis?.() || 0));
      setDeletedKeys(list);
    });

    return () => {
      unsubscribe();
      unsubscribeDeleted();
    };
  }, []);

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        let q = query(collection(db, 'users'), where('role', '==', 'farmer'));
        if (isManager && !isAdmin) {
          q = query(collection(db, 'users'), where('role', '==', 'farmer'), where('managerId', '==', user?.uid));
        }
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFarmers(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchFarmers();
  }, [showGenDialog, assigningKey, user?.uid, isManager, isAdmin]);

  const generateKey = async () => {
    if (!isManager) {
      toast.error('Only managers or admins can generate keys');
      return;
    }

    setLoading(true);
    try {
      const randomKey = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + 
                        Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const batch = writeBatch(db);
      const keyRef = doc(db, 'licenseKeys', randomKey);
      
      const keyData: any = {
        id: randomKey,
        key: randomKey,
        status: targetFarmerId !== 'none' ? 'Active' : 'Unused',
        createdAt: Timestamp.now(),
        createdBy: user?.uid,
        createdByEmail: user?.email,
        type: 'Standard',
        description: description,
        validityDays: Number(expiryDays)
      };

      if (targetFarmerId !== 'none') {
        const farmer = farmers.find(f => f.id === targetFarmerId);
        keyData.usedBy = targetFarmerId;
        keyData.usedByEmail = farmer?.email || 'Farmer';
        keyData.activatedAt = Timestamp.now();
        keyData.source = 'Admin Allotment';

        // Update farmer profile
        batch.update(doc(db, 'users', targetFarmerId), {
          licenseActive: true,
          licenseKey: randomKey,
          licenseActivatedAt: new Date().toISOString()
        });
      }

      batch.set(keyRef, keyData);
      await batch.commit();
      
      toast.success(targetFarmerId !== 'none' ? `Key generated and allotted to ${keyData.usedByEmail}` : `License Key generated (${expiryDays} days validity)`);
      setShowGenDialog(false);
      setTargetFarmerId('none');
      setDescription('');
      setExpiryDays('365');
      setIsCustomDays(false);
    } catch (error: any) {
      console.error('Key Gen Error:', error);
      toast.error(`Failed to generate key: ${error.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteKey = async (id: string) => {
    console.log('Final confirmation to delete key:', id);
    if (!isAdmin && !isManager) {
      toast.error('Only admins or managers can delete keys');
      return;
    }
    
    const keyToDelete = keys.find(k => k.id === id);
    if (!keyToDelete) {
      toast.error('Key not found');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const deletedRef = doc(db, 'deletedKeys', id);
      batch.set(deletedRef, {
        ...keyToDelete,
        deletedAt: Timestamp.now(),
        deletedBy: user?.uid,
        deletedByEmail: user?.email
      });
      
      // Update farmer profile if key was in use
      if (keyToDelete.usedBy) {
        batch.update(doc(db, 'users', keyToDelete.usedBy), {
          licenseActive: false,
          licenseKey: null
        });
      }
      
      batch.delete(doc(db, 'licenseKeys', id));
      
      await batch.commit();
      toast.success('Key moved to Trash');
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      toast.error(`Delete failed: ${error.message || 'Check permissions'}`);
    } finally {
      setLoading(false);
    }
  };

  const restoreKey = async (keyData: any) => {
    if (!isAdmin) {
      toast.error('Only admins can restore keys');
      return;
    }
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const { deletedAt, deletedBy, deletedByEmail, ...originalData } = keyData;
      
      // Move back to licenseKeys
      batch.set(doc(db, 'licenseKeys', keyData.id), originalData);
      // Remove from deletedKeys
      batch.delete(doc(db, 'deletedKeys', keyData.id));
      
      await batch.commit();
      toast.success('Key restored successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to restore key');
    } finally {
      setLoading(false);
    }
  };

  const permanentDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error('Only admins can permanently delete');
      return;
    }
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'deletedKeys', id));
      toast.success('Permanently deleted');
      setDeletingPermId(null);
    } catch (e) {
      toast.error('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const [deletingPermId, setDeletingPermId] = useState<string | null>(null);

  const assignKey = async (keyData: any, farmerId: string) => {
    if (!farmerId || farmerId === 'none') {
      toast.error('Please select a farmer');
      return;
    }
    
    setLoading(true);
    try {
      const farmer = farmers.find(f => f.id === farmerId);
      const batch = writeBatch(db);
      
      const updateData: any = {
        status: 'Active',
        usedBy: farmerId,
        usedByEmail: farmer?.email || 'Farmer',
        activatedAt: Timestamp.now(),
        source: 'Admin Assigned'
      };

      // If assigning from Trash (restoring + assigning)
      const isFromTrash = deletedKeys.some(dk => dk.id === keyData.id);
      
      batch.set(doc(db, 'licenseKeys', keyData.id), {
        ...keyData,
        ...updateData
      });
      
      if (isFromTrash) {
        batch.delete(doc(db, 'deletedKeys', keyData.id));
      }
      
      batch.update(doc(db, 'users', farmerId), {
        licenseActive: true,
        licenseKey: keyData.key,
        licenseActivatedAt: new Date().toISOString()
      });
      
      await batch.commit();
      toast.success(`Key ${keyData.key} assigned to ${farmer?.name}`);
      setAssigningKey(null);
      setTargetFarmerId('none');
    } catch (e) {
      console.error(e);
      toast.error('Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (keyId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'licenseKeys', keyId), {
        paymentStatus: status
      });
      toast.success('Payment status updated');
    } catch (e) {
      toast.error('Failed to update payment status');
    }
  };

  const updateKeyValidity = async () => {
    if (!editingKey || !newValidity) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'licenseKeys', editingKey.id), {
        validityDays: Number(newValidity)
      });
      toast.success('Key validity updated');
      setEditingKey(null);
    } catch (e) {
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to Trash?</DialogTitle>
            <DialogDescription>
              This will move the key to trash. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && deleteKey(confirmDeleteId)} disabled={loading}>
              {loading ? 'Deleting...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingPermId} onOpenChange={(open) => !open && setDeletingPermId(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Permanent Delete?</DialogTitle>
            <DialogDescription>This action is irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingPermId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingPermId && permanentDelete(deletingPermId)} disabled={loading}>
              {loading ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">License Key Management</h1>
          <p className="text-slate-500 text-sm">Generate and manage activation keys for farmers</p>
        </div>
        {isManager && (
          <Dialog open={showGenDialog} onOpenChange={setShowGenDialog}>
            <DialogTrigger render={
              <Button className="bg-indigo-600 hover:bg-indigo-700 h-10 gap-2 rounded-xl px-5">
                <Plus size={18} />
                Generate Key
              </Button>
            } />
            <DialogContent className="rounded-3xl max-w-md w-[95vw]">
              <DialogHeader>
                <DialogTitle>Generate Activation Key</DialogTitle>
                <CardDescription>Create a new license key with custom validity</CardDescription>
              </DialogHeader>
              <div className="py-4 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-400 uppercase">Validity Period</Label>
                  {!isCustomDays ? (
                    <Select value={expiryDays} onValueChange={(val) => {
                      if (val === 'custom') {
                        setIsCustomDays(true);
                        setExpiryDays('');
                      } else {
                        setExpiryDays(val);
                      }
                    }}>
                      <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 focus:ring-indigo-500">
                        <SelectValue placeholder="Select validity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                        <SelectItem value="180">180 Days</SelectItem>
                        <SelectItem value="365">365 Days (1 Year)</SelectItem>
                        <SelectItem value="730">730 Days (2 Years)</SelectItem>
                        <SelectItem value="9999">Lifetime</SelectItem>
                        <SelectItem value="custom" className="text-indigo-600 font-bold">Custom Validity...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                       <Input 
                        type="number" 
                        placeholder="Enter days" 
                        value={expiryDays} 
                        onChange={(e) => setExpiryDays(e.target.value)}
                        className="h-12 rounded-xl border-slate-200"
                        autoFocus
                       />
                       <Button variant="ghost" onClick={() => setIsCustomDays(false)} className="h-12">Cancel</Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-400 uppercase text-left block">Purpose / Description</Label>
                  <Input 
                    placeholder="E.g. Gift for premium farmer, Promotional key, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-12 rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-400 uppercase">Direct Allotment (Optional)</Label>
                  <Select value={targetFarmerId} onValueChange={setTargetFarmerId}>
                    <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 focus:ring-indigo-500">
                      <SelectValue placeholder="Select a farmer to allot directly" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Create and keep unused</SelectItem>
                      {farmers.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({f.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-400 font-medium px-1">
                    * Showing only farmers without an active license.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={generateKey} 
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl py-6 font-bold"
                >
                  {loading ? 'Processing...' : targetFarmerId !== 'none' ? 'Generate & Allot' : 'Generate Key'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editingKey} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="rounded-3xl max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Update Validity</DialogTitle>
            <CardDescription>Change validity for key: <span className="font-mono text-indigo-600 font-bold">{editingKey?.key}</span></CardDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Validity (Days)</Label>
              <Input 
                type="number" 
                value={newValidity} 
                onChange={e => setNewValidity(e.target.value)}
                placeholder="Enter days"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={updateKeyValidity} 
              className="w-full bg-indigo-600 rounded-xl py-6 font-bold"
              disabled={loading || !newValidity}
            >
              Update Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningKey} onOpenChange={(open) => !open && setAssigningKey(null)}>
        <DialogContent className="rounded-3xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Assign License Key</DialogTitle>
            <CardDescription>Allot key <span className="font-mono text-indigo-600 font-bold">{assigningKey?.key}</span> to a farmer</CardDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Search & Select Farmer</Label>
              <Input 
                placeholder="Search by name or email..."
                value={filterFarmer}
                onChange={e => setFilterFarmer(e.target.value)}
                className="h-10 rounded-xl mb-2"
              />
              <Select value={targetFarmerId} onValueChange={setTargetFarmerId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select farmer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a farmer</SelectItem>
                  {farmers
                    .filter(f => 
                      !f.licenseActive && 
                      ((f.name || '').toLowerCase().includes((filterFarmer || '').toLowerCase()) || 
                       (f.email || '').toLowerCase().includes((filterFarmer || '').toLowerCase()))
                    )
                    .map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name || 'Unknown'} ({f.email || 'No email'})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => assignKey(assigningKey, targetFarmerId)} 
              className="w-full bg-indigo-600 rounded-xl py-6 font-bold"
              disabled={loading || targetFarmerId === 'none'}
            >
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Keys</CardTitle>
            <div className="text-2xl font-bold">{keys.length}</div>
          </CardHeader>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Unused Keys</CardTitle>
            <div className="text-2xl font-bold text-emerald-600">
              {keys.filter(k => k.status === 'Unused').length}
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Licenses</CardTitle>
            <div className="text-2xl font-bold text-indigo-600">
              {keys.filter(k => k.status === 'Active').length}
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Purchased Directly</CardTitle>
            <div className="text-2xl font-bold text-amber-600">
              {keys.filter(k => k.source === 'Farmer Purchase').length}
            </div>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-4 flex-wrap h-auto">
          <TabsTrigger value="available" className="rounded-lg gap-2">
            <List size={14} />
            Available Keys
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg gap-2">
            <History size={14} />
            Key History (Used)
          </TabsTrigger>
          <TabsTrigger value="trash" className="rounded-lg gap-2 text-red-600">
            <Trash2 size={14} />
            Trash ({deletedKeys.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg gap-2">
            <CreditCard size={14} />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <Card className="bg-white overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>License Key</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.filter(k => k.status === 'Unused').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">
                      No unused license keys found.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.filter(k => k.status === 'Unused').map((k) => (
                    <TableRow key={k.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono font-bold text-indigo-600 cursor-pointer" onClick={() => setAssigningKey(k)}>
                        <div className="flex items-center gap-2">
                          <Key size={14} />
                          {k.key}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                          {k.validityDays} Days
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {k.createdAt?.toDate ? format(k.createdAt.toDate(), 'PPP p') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs text-center">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-slate-700">{k.createdByEmail?.split('@')[0]}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{k.source || 'Standard'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-indigo-500 hover:text-indigo-600"
                            title="Assign to Farmer"
                            onClick={() => setAssigningKey(k)}
                          >
                            <User size={14} />
                          </Button>
                          {isManager && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-400 hover:text-indigo-600"
                                onClick={() => {
                                  setEditingKey(k);
                                  setNewValidity(k.validityDays?.toString() || '');
                                }}
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => setConfirmDeleteId(k.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {/* Keep history as is, but maybe add Assign button for keys that became Expired? */}
          <Card className="bg-white overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>License Key</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Activated At</TableHead>
                  <TableHead>Expiry / Remaining</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.filter(k => k.status !== 'Unused').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400 italic">
                      No key history found.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.filter(k => k.status !== 'Unused').map((k) => {
                    const isExpired = k.activatedAt?.toDate && k.validityDays && addDays(k.activatedAt.toDate(), k.validityDays) < new Date();
                    return (
                      <TableRow key={k.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono font-bold text-slate-600">
                          <div className="flex items-center gap-2">
                            <Key size={14} className="text-slate-400" />
                            {k.key}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-900">{k.usedByEmail || 'Farmer'}</span>
                            <span className="text-[10px] text-slate-400">ID: {k.usedBy?.substring(0, 10)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {k.activatedAt?.toDate ? format(k.activatedAt.toDate(), 'PPP p') : 'Pending'}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {k.activatedAt?.toDate && k.validityDays ? (
                            <div className="flex flex-col">
                              <span className={isExpired ? 'text-red-500 font-bold' : 'text-slate-500'}>
                                {format(addDays(k.activatedAt.toDate(), k.validityDays), 'PPP')}
                              </span>
                              {!isExpired && (
                                <span className="text-[10px] text-emerald-600 font-bold">
                                  {Math.max(0, Math.ceil((addDays(k.activatedAt.toDate(), k.validityDays).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days left
                                </span>
                              )}
                            </div>
                          ) : 'Unlimited'}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs font-medium">
                          {k.createdByEmail || 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isExpired ? "destructive" : "secondary"} className={!isExpired && k.source === 'Farmer Purchase' ? 'bg-amber-50 text-amber-700' : ''}>
                            {isExpired ? 'Expired' : k.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400 hover:text-indigo-600"
                              onClick={() => {
                                setEditingKey(k);
                                setNewValidity(k.validityDays?.toString() || '');
                              }}
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Select 
                              value={k.status} 
                              onValueChange={async (val) => {
                                try {
                                  await updateDoc(doc(db, 'licenseKeys', k.id), { status: val });
                                  toast.success('Status updated');
                                } catch (e) {
                                  toast.error('Failed to update status');
                                }
                              }}
                            >
                              <SelectTrigger className="w-[100px] h-8 text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Expired">Expired</SelectItem>
                                <SelectItem value="Unused">Unused</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => setConfirmDeleteId(k.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="trash">
          <Card className="bg-white overflow-hidden border-none shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700">Trashed & Expired Keys</h3>
              <p className="text-[10px] text-slate-400 font-medium">Deleted keys and system-detected expired licenses</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>License Key</TableHead>
                  <TableHead>Status/Type</TableHead>
                  <TableHead>Reason/Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedKeys.length === 0 && keys.filter(k => k.activatedAt?.toDate && k.validityDays && addDays(k.activatedAt.toDate(), k.validityDays) < new Date()).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">
                      No deleted or expired keys found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* Expired Keys from main list */}
                    {keys
                      .filter(k => k.activatedAt?.toDate && k.validityDays && addDays(k.activatedAt.toDate(), k.validityDays) < new Date())
                      .map((k) => (
                        <TableRow key={k.id} className="hover:bg-amber-50/30">
                          <TableCell className="font-mono font-bold text-amber-700">
                            {k.key}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 uppercase text-[9px]">Expired</Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs">
                            {k.activatedAt?.toDate ? format(addDays(k.activatedAt.toDate(), k.validityDays), 'dd MMM yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-indigo-600 hover:bg-white"
                              onClick={() => {
                                setEditingKey(k);
                                setNewValidity(k.validityDays?.toString() || '');
                              }}
                            >
                              Renew
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    }
                    {/* Trashed Keys */}
                    {deletedKeys.map((k) => (
                      <TableRow key={k.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono font-bold text-slate-500 line-through decoration-red-300">
                          {k.key}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-slate-400 uppercase text-[9px]">Deleted</Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs">
                          {k.deletedAt?.toDate ? format(k.deletedAt.toDate(), 'dd MMM yyyy') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs text-emerald-600 border-emerald-100 hover:bg-emerald-50 rounded-lg gap-1"
                              onClick={() => restoreKey(k)}
                              disabled={loading}
                            >
                              <History size={12} />
                              Restore
                            </Button>
                            {isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                                onClick={() => setDeletingPermId(k.id)}
                              >
                                Final Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="bg-white overflow-hidden border-none shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Farmer / User</TableHead>
                  <TableHead>Key Used</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.filter(k => k.status !== 'Unused').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.filter(k => k.status !== 'Unused').map((k) => (
                    <TableRow key={k.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{k.usedByEmail || 'Farmer'}</span>
                          <span className="text-[10px] text-slate-400">Allotted: {k.activatedAt?.toDate ? format(k.activatedAt.toDate(), 'dd MMM yyyy') : 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-indigo-600">
                        {k.key}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            k.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                            k.paymentStatus === 'Failed' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }
                        >
                          {k.paymentStatus || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {k.validityDays} Days
                      </TableCell>
                      <TableCell className="text-right">
                        <Select 
                          value={k.paymentStatus || 'Pending'} 
                          onValueChange={(v) => updatePaymentStatus(k.id, v)}
                        >
                          <SelectTrigger className="w-24 h-8 text-[10px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KeyManagement;
