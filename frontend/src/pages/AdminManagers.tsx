import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, where, setDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Shield, UserCog, Search, Mail, Phone, MapPin, Plus, Trash2, Edit2, List, MoreVertical } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const AdminManagers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewingManager, setViewingManager] = useState<any>(null);
  const [editingManager, setEditingManager] = useState<any>(null);
  const [assignedFarmers, setAssignedFarmers] = useState<any[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);

  const [newManager, setNewManager] = useState({
    name: '',
    email: '',
    role: 'manager',
    phone: '',
    district: '',
    state: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(allUsers);
      setManagers(allUsers.filter((u: any) => u.role === 'manager' || u.role === 'admin' || u.role === 'sub-admin'));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedFarmers = async (managerId: string) => {
    setLoadingFarmers(true);
    try {
      const q = query(collection(db, 'users'), where('managerId', '==', managerId));
      const snap = await getDocs(q);
      const farmers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch running batch counts for each farmer
      const farmersWithBatches = await Promise.all(farmers.map(async (farmer: any) => {
        const batchQ = query(collection(db, 'flocks'), where('farmerId', '==', farmer.id), where('status', '==', 'Active'));
        const batchSnap = await getDocs(batchQ);
        return { ...farmer, activeBatchCount: batchSnap.size };
      }));
      
      setAssignedFarmers(farmersWithBatches);
    } catch (e) {
      toast.error('Failed to load assigned farmers');
    } finally {
      setLoadingFarmers(false);
    }
  };

  const generateManagerCode = () => 'MN' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const handleAddManager = async () => {
    if (!newManager.email || !newManager.name) {
      toast.error('Name and Email are required');
      return;
    }
    setLoading(true);
    try {
      const code = generateManagerCode();
      // Check if user already exists
      const existing = users.find(u => u.email === newManager.email);
      if (existing) {
        await updateDoc(doc(db, 'users', existing.id), {
          ...newManager,
          role: newManager.role,
          managerCode: existing.managerCode || code
        });
        toast.success('Existing user role updated');
      } else {
        const tempId = 'temp-' + Date.now();
        await setDoc(doc(db, 'users', tempId), {
          ...newManager,
          role: newManager.role,
          managerCode: code,
          createdAt: Timestamp.now(),
          isPlaceholder: true
        });
        toast.success(`New ${newManager.role === 'admin' ? 'Admin' : 'Manager'} profile created.`);
      }
      setShowAddDialog(false);
      setNewManager({ name: '', email: '', role: 'manager', phone: '', district: '', state: '' });
      fetchUsers();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'users');
      toast.error('Failed to add manager');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateManager = async () => {
    if (!editingManager) return;
    setLoading(true);
    try {
      const code = editingManager.managerCode || generateManagerCode();
      await updateDoc(doc(db, 'users', editingManager.id), {
        name: editingManager.name,
        phone: editingManager.phone,
        district: editingManager.district,
        state: editingManager.state,
        email: editingManager.email,
        role: editingManager.role,
        managerCode: code
      });
      toast.success('Manager updated');
      setEditingManager(null);
      fetchUsers();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
      toast.error('Update failed');
    } finally {
      setLoading(false);
    }
  };

  const promoteFarmer = async (farmer: any) => {
    if (!confirm(`Promote ${farmer.name} to Manager?`)) return;
    try {
      const code = generateManagerCode();
      await updateDoc(doc(db, 'users', farmer.id), { 
        role: 'manager',
        managerCode: farmer.managerCode || code
      });
      toast.success('Farmer promoted to Manager');
      fetchUsers();
    } catch (e) {
      toast.error('Promotion failed');
    }
  };

  const deleteManager = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this manager?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), { role: 'farmer' });
      toast.success('Manager removed');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to remove manager');
    }
  };

  const handleReassignFarmer = async (farmerId: string, newManagerId: string) => {
    try {
      await updateDoc(doc(db, 'users', farmerId), {
        managerId: newManagerId || '',
        assignedManagerId: newManagerId || ''
      });
      toast.success('Farmer reassigned');
      fetchUsers();
      if (viewingManager) {
        fetchAssignedFarmers(viewingManager.id);
      }
    } catch (error) {
      toast.error('Failed to reassign farmer');
    }
  };

  const availableFarmers = users.filter(u => u.role === 'farmer');

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manager Management</h1>
          <p className="text-slate-500">Add, promote, and manage Area Managers</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2 h-11 px-6">
                <Plus size={20} />
                Add New Manager
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl max-w-lg w-[95vw]">
              <Tabs defaultValue="new">
                <DialogHeader>
                  <DialogTitle>Add Area Manager</DialogTitle>
                  <TabsList className="mt-4 w-full bg-slate-100 rounded-xl p-1">
                    <TabsTrigger value="new" className="flex-1 rounded-lg">Invite New</TabsTrigger>
                    <TabsTrigger value="promote" className="flex-1 rounded-lg">Promote Farmer</TabsTrigger>
                  </TabsList>
                </DialogHeader>
                
                <TabsContent value="new" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</Label>
                    <Input 
                      value={newManager.name}
                      onChange={e => setNewManager({...newManager, name: e.target.value})}
                      placeholder="Manager Name"
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</Label>
                      <Input 
                        value={newManager.email}
                        onChange={e => setNewManager({...newManager, email: e.target.value})}
                        className="rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</Label>
                      <Input 
                        value={newManager.phone}
                        onChange={e => setNewManager({...newManager, phone: e.target.value})}
                        className="rounded-xl h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Default Role</Label>
                    <select
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={newManager.role}
                      onChange={e => setNewManager({...newManager, role: e.target.value})}
                    >
                      <option value="manager">Manager</option>
                      <option value="admin">Sub Admin</option>
                    </select>
                  </div>
                  <Button onClick={handleAddManager} disabled={loading} className="w-full bg-indigo-600 rounded-xl py-6 font-bold">
                    Create Profile
                  </Button>
                </TabsContent>

                <TabsContent value="promote" className="space-y-4 py-4">
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {availableFarmers.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">No farmers available to promote</p>
                    ) : (
                      availableFarmers.map(f => (
                        <div key={f.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{f.name}</p>
                            <p className="text-[10px] text-slate-500">{f.email}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 rounded-lg text-xs"
                            onClick={() => promoteFarmer(f)}
                          >
                            Promote
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Detail View Dialog */}
      <Dialog open={!!viewingManager} onOpenChange={(open) => !open && setViewingManager(null)}>
        <DialogContent className="rounded-3xl max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="text-indigo-600" size={20} />
              Farmers Assigned to {viewingManager?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {loadingFarmers ? (
              <div className="text-center py-10 text-slate-400 animate-pulse">Loading farmers...</div>
            ) : assignedFarmers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic">No farmers assigned to this manager.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Active Batches</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedFarmers.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-bold text-slate-800">{f.name}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p>{f.email}</p>
                          <p className="text-slate-400">{f.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin size={12} className="text-slate-300" />
                          {f.district || f.state ? `${f.district}, ${f.state}` : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          {f.activeBatchCount} Running
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <select
                          className="bg-slate-50 border-none rounded-lg text-xs font-bold text-slate-700 p-2 focus:ring-0 cursor-pointer w-[130px]"
                          value={f.assignedManagerId || f.managerId || ''}
                          onChange={(e) => handleReassignFarmer(f.id, e.target.value)}
                        >
                          <option value="">No Manager</option>
                          {managers.map(m => (
                            <option key={m.id} value={m.uid || m.id}>{m.name}</option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit View Dialog */}
      <Dialog open={!!editingManager} onOpenChange={(open) => !open && setEditingManager(null)}>
        <DialogContent className="rounded-3xl max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Manager Details</DialogTitle>
          </DialogHeader>
          {editingManager && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</Label>
                <Input 
                  value={editingManager.name}
                  onChange={e => setEditingManager({...editingManager, name: e.target.value})}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Email</Label>
                <Input 
                  value={editingManager.email}
                  disabled
                  className="rounded-xl h-11 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Role</Label>
                  <select
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={editingManager.role}
                    onChange={e => setEditingManager({...editingManager, role: e.target.value})}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Sub Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Phone</Label>
                  <Input 
                    value={editingManager.phone}
                    onChange={e => setEditingManager({...editingManager, phone: e.target.value})}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">District</Label>
                    <Input 
                      value={editingManager.district}
                      onChange={e => setEditingManager({...editingManager, district: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">State</Label>
                    <Input 
                      value={editingManager.state}
                      onChange={e => setEditingManager({...editingManager, state: e.target.value})}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateManager} className="w-full bg-indigo-600 rounded-xl py-6 font-bold" disabled={loading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder="Search managers..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 rounded-xl border-none h-11 bg-slate-50/50"
              />
            </div>
            <Button onClick={fetchUsers} disabled={loading} variant="outline" className="rounded-xl h-11">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-20 text-slate-400 animate-pulse">Loading managers...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Manager Name</TableHead>
                  <TableHead>Contact Details</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.filter(m => 
                  m.name?.toLowerCase().includes(search.toLowerCase()) || 
                  m.email?.toLowerCase().includes(search.toLowerCase())
                ).map((m: any) => (
                  <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <button 
                        onClick={() => {
                          setViewingManager(m);
                          fetchAssignedFarmers(m.id);
                        }}
                        className="flex items-center gap-3 text-left group"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${m.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                          {m.name?.[0] || 'M'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{m.name}</p>
                          <div className="flex items-center gap-2">
                             <p className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded uppercase tracking-tighter">ID: {m.managerCode || 'PENDING'}</p>
                             <p className="text-[10px] text-slate-400 font-medium">Click to view farmers</p>
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail size={12} className="text-slate-400" />
                          {m.email}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone size={12} className="text-slate-400" />
                          {m.phone || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin size={12} className="text-slate-400" />
                        {m.district || m.state ? `${m.district}, ${m.state}` : 'Not Set'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg uppercase text-[9px] tracking-widest font-black ${m.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          onClick={() => setEditingManager(m)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => deleteManager(m.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManagers;
