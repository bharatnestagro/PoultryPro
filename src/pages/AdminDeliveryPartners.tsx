import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  MoreVertical,
  ExternalLink,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Partner {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceArea: string;
  status: 'Active' | 'Inactive';
  vehicleType: string;
}

const AdminDeliveryPartners: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPartner, setNewPartner] = useState<Partial<Partner>>({
    status: 'Active'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
      setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    try {
      const id = `DP-${Date.now()}`;
      await setDoc(doc(db, 'deliveryPartners', id), {
        ...newPartner,
        createdAt: new Date()
      });
      toast.success('Delivery partner added');
      setShowAddDialog(false);
      setNewPartner({ status: 'Active' });
    } catch (e) {
      toast.error('Failed to add partner');
    }
  };

  const toggleStatus = async (partner: Partner) => {
    try {
      await updateDoc(doc(db, 'deliveryPartners', partner.id), {
        status: partner.status === 'Active' ? 'Inactive' : 'Active'
      });
      toast.success('Status updated');
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Delivery Partners</h2>
          <p className="text-slate-500 font-medium mt-1">Manage logistics providers and delivery personnel</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger render={
            <Button className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl font-bold h-12 px-8 shadow-lg shadow-emerald-900/10">
              <Plus size={18} className="mr-2" />
              Add Partner
            </Button>
          } />
          <DialogContent className="rounded-[2rem] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">New Delivery Partner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agency/Partner Name</Label>
                  <Input 
                    value={newPartner.name || ''} 
                    onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    placeholder="e.g. Speed Logistics"
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input 
                    value={newPartner.contactPerson || ''} 
                    onChange={e => setNewPartner({...newPartner, contactPerson: e.target.value})}
                    placeholder="Full Name"
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    value={newPartner.phone || ''} 
                    onChange={e => setNewPartner({...newPartner, phone: e.target.value})}
                    placeholder="Mobile number"
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email (Optional)</Label>
                  <Input 
                    value={newPartner.email || ''} 
                    onChange={e => setNewPartner({...newPartner, email: e.target.value})}
                    placeholder="Email address"
                    className="rounded-xl border-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service Area</Label>
                <Input 
                  value={newPartner.serviceArea || ''} 
                  onChange={e => setNewPartner({...newPartner, serviceArea: e.target.value})}
                  placeholder="e.g. Pune, Satara, Wai"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Input 
                  value={newPartner.vehicleType || ''} 
                  onChange={e => setNewPartner({...newPartner, vehicleType: e.target.value})}
                  placeholder="e.g. Mini Truck, Van, Bike"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <Button 
                className="w-full bg-[#122B21] hover:bg-[#1a3d2e] h-12 rounded-xl font-bold mt-4"
                onClick={handleAddPartner}
              >
                Create Partner Profile
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search by name or number..." 
            className="pl-10 border-none bg-slate-50 rounded-xl h-12"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-[2rem] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPartners.map(partner => (
            <Card key={partner.id} className="p-6 border-none shadow-sm rounded-[2rem] bg-white group hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <Truck size={28} />
                </div>
                <Badge className={`rounded-xl border-none font-bold uppercase text-[10px] px-3 py-1 ${partner.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {partner.status}
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{partner.name}</h3>
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Verified Partner
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate">{partner.serviceArea}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span>{partner.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Truck size={14} className="text-slate-400" />
                    <span>{partner.vehicleType}</span>
                  </div>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl border-slate-100 font-bold text-[10px] uppercase h-10 hover:bg-slate-900 hover:text-white hover:border-slate-900"
                    onClick={() => toggleStatus(partner)}
                  >
                    {partner.status === 'Active' ? <Ban size={14} className="mr-2" /> : <ShieldCheck size={14} className="mr-2" />}
                    {partner.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredPartners.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
              <Truck size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold italic uppercase text-xs">No partners found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryPartners;
