import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, Timestamp, deleteDoc, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trophy, Users, Search, Calendar, Phone, CheckCircle2, XCircle, Clock, Filter, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

const AdminChallenges: React.FC = () => {
  const [participations, setParticipations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'userChallenges'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setParticipations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'userChallenges', id), { status, updatedAt: Timestamp.now() });
      toast.success(`Challenge marked as ${status}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const filtered = participations.filter(p => {
    const matchesSearch = 
      (p.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.challengeTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: participations.length,
    active: participations.filter(p => p.status === 'Active').length,
    completed: participations.filter(p => p.status === 'Completed').length,
    failed: participations.filter(p => p.status === 'Failed').length,
    totalRewards: participations.reduce((acc, p) => acc + (p.totalEarned || 0), 0)
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black italic text-slate-900 uppercase flex items-center gap-2">
            <Trophy className="text-amber-500" />
            Challenge Management
          </h1>
          <p className="text-slate-500 font-bold italic text-sm">Monitor farmer participation and earnings</p>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black italic text-slate-400 uppercase">Total Participation</p>
            <p className="text-xl font-black italic text-slate-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black italic text-emerald-500 uppercase">Active Now</p>
            <p className="text-xl font-black italic text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black italic text-indigo-500 uppercase">Completed</p>
            <p className="text-xl font-black italic text-indigo-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-black italic text-red-400 uppercase">Failed</p>
            <p className="text-xl font-black italic text-red-600">{stats.failed}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-none shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-[10px] font-black italic text-amber-600 uppercase">Total Rewards Distributed</p>
            <p className="text-xl font-black italic text-slate-900">₹{stats.totalRewards.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search farmer or challenge..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-12 rounded-2xl border-slate-100 bg-slate-50 h-12 font-bold italic"
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
          {['All', 'Active', 'Completed', 'Failed'].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus(s)}
              className={`rounded-xl px-4 py-2 text-[10px] font-black italic uppercase transition-all ${
                filterStatus === s 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <Card key={p.id} className="bg-white border-none shadow-sm group hover:shadow-md transition-all rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black italic">
                    {p.userName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic uppercase text-slate-900 leading-tight">{p.userName || 'Unknown Farmer'}</h3>
                    <p className="text-[10px] font-bold italic text-slate-400 flex items-center gap-1 uppercase">
                      <Phone size={10} /> {p.userPhone || 'No Phone'}
                    </p>
                  </div>
                </div>
                <Badge className={`rounded-xl px-3 py-1 font-black italic uppercase text-[9px] ${
                  p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  p.status === 'Completed' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                  'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {p.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div>
                   <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">Ongoing Challenge</p>
                      <p className="text-[10px] font-black italic text-indigo-600 uppercase">Progress: {Object.keys(p.dailyEntries || {}).length} / {p.durationDays || '--'} Days</p>
                   </div>
                   <div className="flex justify-between items-end">
                     <p className="font-black italic text-slate-900 uppercase text-sm leading-tight">{p.challengeTitle || 'Specific Challenge'}</p>
                     <p className="font-black italic text-emerald-600 text-lg">₹{p.totalEarned || 0}</p>
                   </div>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                     style={{ width: `${Math.min(100, (Object.keys(p.dailyEntries || {}).length / (p.durationDays || 90)) * 100)}%` }}
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px] font-bold italic uppercase text-slate-500">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-300" />
                  <div>
                    <p className="text-[8px] text-slate-300">Started</p>
                    <p>{p.startDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-300" />
                  <div>
                    <p className="text-[8px] text-slate-300">Ends</p>
                    <p>{p.endDate}</p>
                  </div>
                </div>
              </div>

              {p.status === 'Active' && (
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl font-black italic uppercase text-[10px] gap-2 h-10 border border-emerald-200"
                    onClick={() => handleUpdateStatus(p.id, 'Completed')}
                  >
                    <CheckCircle2 size={14} />
                    Complete
                  </Button>
                  <Button 
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black italic uppercase text-[10px] gap-2 h-10 border border-red-200"
                    onClick={() => handleUpdateStatus(p.id, 'Failed')}
                  >
                    <XCircle size={14} />
                    Fail
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <Users className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-black italic uppercase text-xs">No records found matching your selection.</p>
        </div>
      )}
    </div>
  );
};

export default AdminChallenges;
