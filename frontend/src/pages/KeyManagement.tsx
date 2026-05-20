import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { 
  KeyRound, PlusCircle, Trash2, Search, CheckCircle2, 
  HelpCircle, Sparkles, Filter, Copy, ClipboardCheck
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

  const [newKeyPlan, setNewKeyPlan] = useState('Starter');

  useEffect(() => {
    // 1. Fetch license keys
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

    // 2. Fetch farmers list
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubKeys();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'N/A';
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create random key: AGRI-{PLAN}-{8 random hex characters}
      const hex = Math.random().toString(16).slice(2, 10).toUpperCase();
      const planCode = newKeyPlan.slice(0, 4).toUpperCase();
      const generated = `AGRI-${planCode}-${hex.slice(0, 4)}-${hex.slice(4)}`;

      await addDoc(collection(db, 'licenseKeys'), {
        key: generated,
        plan: newKeyPlan,
        status: 'Unused',
        createdAt: new Date().toISOString(),
        creatorId: user?.uid
      });

      toast.success(`License key generated successfully! Key: ${generated}`);
      setShowAdd(false);
    } catch (err) {
      toast.error('Failed to generate license key');
    }
  };

  const copyToClipboard = (keyStr: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKey(keyStr);
    toast.success('Key copied successfully');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm('Are you certain you wish to purge this unused license key item?')) {
        await deleteDoc(doc(db, 'licenseKeys', id));
        toast.success('License key purged successfully');
      }
    } catch (err) {
      toast.error('License key purge failed');
    }
  };

  const filtered = keys.filter(k => {
    const keyStr = (k.key || '').toLowerCase();
    const plan = (k.plan || '').toLowerCase();
    const status = (k.status || '').toLowerCase();
    const matchesSearch = keyStr.includes(searchTerm.toLowerCase()) || plan.includes(searchTerm.toLowerCase()) || status.includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none font-sans">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <KeyRound size={32} className="text-[#0B2516]" />
            LICENSE KEY GENERATIONS & ACTIVATIONS
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Construct activation credentials, review subscriber conversions, and revoke active licenses
          </p>
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-[#0B2516] hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Generate License Key
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-sm bg-white p-6 font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">GENERATE LICENSE KEY</DialogTitle>
              <CardDescription className="text-xs">Create unique secure license key unlocks subscription plans.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleGenerateKey} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Select Plan Tier to unlock</Label>
                <Select value={newKeyPlan} onValueChange={setNewKeyPlan}>
                  <SelectTrigger className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold font-mono">
                    <SelectValue placeholder="Choose Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Standard Breeder (Starter Plan)</SelectItem>
                    <SelectItem value="Commercial">Commercial Hub Plan</SelectItem>
                    <SelectItem value="Enterprise font-bold text-indigo-700">Enterprise High Growth Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-opacity-95 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Construct Authorization Key
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tables layout registry */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Active Keys Database</CardTitle>
            <CardDescription className="text-xs">Provide these created strings to new breeder signups to convert and initiate software limits</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search keys, status, plan..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">License Serial String</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Target plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Breeder Conversion</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching license authorization records found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-4 font-mono text-xs font-black select-text text-slate-800 flex items-center gap-2">
                      <span>{item.key}</span>
                      <button 
                        onClick={() => copyToClipboard(item.key)}
                        className="text-slate-400 hover:text-[#4F46E5] transition-all p-1 hover:bg-slate-50 rounded"
                        title="Copy Key String"
                      >
                        {copiedKey === item.key ? <ClipboardCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className="bg-indigo-50 text-[#4E46E5] border border-indigo-150 font-extrabold uppercase text-[9px] rounded-full px-2">
                        {item.plan || 'Starter'}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono">
                      <Badge className={`uppercase text-[9px] font-black rounded-full px-2 border ${
                        item.status === 'Unused' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 animate-pulse' 
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {item.status || 'Unused'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs font-bold text-slate-650">
                      {item.status === 'Used' ? (
                        <span>Converted by <span className="font-black text-slate-800">{getFarmerName(item.usedBy)}</span></span>
                      ) : (
                        <span className="text-slate-400 italic">Available</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      {item.status === 'Unused' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
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

export default KeyManagement;
