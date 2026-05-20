import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Truck, Users, Search, PlusCircle, Trash2, Phone, BadgeAlert, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const AdminDeliveryPartners: React.FC = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    agency: 'Rail Express Logistics',
    vehicleNumber: 'MH-14-GH-2200',
    assignedZone: 'North Sector'
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'deliveryPartners'),
      (snap) => {
        setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default partners
        setPartners([
          {
            id: 'mock-p-1',
            name: 'Sunil Gavaskar',
            phone: '+91 91234 56789',
            agency: 'BlueDart Agri division',
            vehicleNumber: 'MH-31-TR-9011',
            assignedZone: 'East Sector Block'
          },
          {
            id: 'mock-p-2',
            name: 'Abdul Kalam',
            phone: '+91 95432 10987',
            agency: 'Express Cargo Railway',
            vehicleNumber: 'Train Crew 12723',
            assignedZone: 'South Sector Express Hub'
          }
        ]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name || !newPartner.phone) {
      toast.error('Partner Name and Phone is required');
      return;
    }
    try {
      await addDoc(collection(db, 'deliveryPartners'), newPartner);
      toast.success('Agri logistics courier agency successfully registered');
      setNewPartner({ name: '', phone: '', agency: 'Express Logistics', vehicleNumber: '', assignedZone: 'West Sector' });
      setShowAdd(false);
    } catch (err) {
      toast.error('Registration failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'deliveryPartners', id));
      toast.success('Partner driver credentials retired from master register');
    } catch (err) {
      toast.error('Retire driver credentials failed');
    }
  };

  const filtered = partners.filter(p => {
    const name = (p.name || '').toLowerCase();
    const zone = (p.assignedZone || '').toLowerCase();
    const agency = (p.agency || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || zone.includes(term) || agency.includes(term);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Truck size={32} className="text-indigo-650" />
            PARTNER AGENCY REGISTRIES
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Lorry driver directories, railway cargo freight teams, and contact credentials
          </p>
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 bg-indigo-600 hover:bg-opacity-95 text-xs font-bold uppercase tracking-widest rounded-2xl border-none">
              <PlusCircle className="mr-2" size={16} /> Register Courier / Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-slate-100 max-w-md bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black italic tracking-wide text-slate-800">REGISTER COURIER AGENCY / LORRY DRIVER</DialogTitle>
              <CardDescription className="text-xs">Partner driver entries let admins assign delivery routes instantly.</CardDescription>
            </DialogHeader>

            <form onSubmit={handleRegister} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Input 
                  required
                  placeholder="Driver Full Name e.g. Sunil Kumar"
                  value={newPartner.name}
                  onChange={e => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Input 
                  required
                  placeholder="Contact Mobile e.g. +91 99000 00000"
                  value={newPartner.phone}
                  onChange={e => setNewPartner({ ...newPartner, phone: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Input 
                  required
                  placeholder="Logistics Agency e.g. Rail Express Logistics"
                  value={newPartner.agency}
                  onChange={e => setNewPartner({ ...newPartner, agency: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Input 
                  required
                  placeholder="Lorry License Plate e.g. MH-12-KL-4022"
                  value={newPartner.vehicleNumber}
                  onChange={e => setNewPartner({ ...newPartner, vehicleNumber: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Input 
                  required
                  placeholder="Assigned Operational Route e.g. South Sector Region"
                  value={newPartner.assignedZone}
                  onChange={e => setNewPartner({ ...newPartner, assignedZone: e.target.value })}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 text-xs font-bold"
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="w-full h-11 bg-emerald-600 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
                  Add Logistics Partner
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-base font-black italic text-slate-800 uppercase tracking-tight">Active Transporter Directory</CardTitle>
            <CardDescription className="text-xs">Quick lookup coordinates for transport drivers when allocating order dispatches</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search driver by name, route..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Driver / Transporter</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider font-mono">Mobile Contact</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Logistics Group agency</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Vehicle ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Assigned Route Sector</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Safety Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No matching transport partner records registered
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-extrabold text-xs text-slate-800 py-4">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-xs font-black text-indigo-700">
                      {item.phone}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600">
                      {item.agency}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-700 font-mono">
                      {item.vehicleNumber}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-50 text-slate-700 font-bold uppercase text-[9px] rounded-full px-2.5 border border-slate-200">
                        {item.assignedZone}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={13} />
                      </Button>
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

export default AdminDeliveryPartners;
