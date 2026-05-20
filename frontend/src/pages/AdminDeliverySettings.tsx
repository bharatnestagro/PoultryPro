import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Truck, Landmark, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const AdminDeliverySettings: React.FC = () => {
  const [shippingRate, setShippingRate] = useState('25'); // ₹25 per KM
  const [railwayFactor, setRailwayFactor] = useState('110'); // ₹110 base weight fee
  const [tollFee, setTollFee] = useState('1500'); // ₹1500 flat toll clearance
  const [dispatchCenter, setDispatchCenter] = useState('Central Amravati Depot');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Logistics rate metrics updated successfully inside global config');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12 select-none">
      
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <Truck size={32} className="text-indigo-600" />
          LOGISTICS & SHIPPING CONTROLS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Define transit rates, flat toll overhead factor settings, and railway tariff guidelines
        </p>
      </div>

      <Card className="border-slate-100 shadow-md rounded-[2.2rem] bg-white p-8">
        <div className="pb-6 border-b border-slate-50">
          <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Truck size={20} className="text-[#4E46E5]" /> Shipping Rate Configuration
          </CardTitle>
          <CardDescription className="text-xs">These values calculate shipping pricing dynamically when placing item orders</CardDescription>
        </div>

        <form onSubmit={handleSave} className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Road Lorry Fee (₹ per KM)</Label>
              <Input 
                value={shippingRate}
                onChange={e => setShippingRate(e.target.value)}
                className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold"
              />
            </div>

            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Railway Base Weight Tariff (₹ per Ton)</Label>
              <Input 
                value={railwayFactor}
                onChange={e => setRailwayFactor(e.target.value)}
                className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold"
              />
            </div>

            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Flat Toll Clearance Reserve (₹)</Label>
              <Input 
                value={tollFee}
                onChange={e => setTollFee(e.target.value)}
                className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Primary Regional Dispatch Terminal</Label>
              <Input 
                value={dispatchCenter}
                onChange={e => setDispatchCenter(e.target.value)}
                className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-extrabold"
              />
            </div>

          </div>

          <div className="pt-4 border-t border-slate-50 flex justify-end">
            <Button type="submit" className="h-11 bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest rounded-2xl text-xs text-white">
              Save Rate Guidelines
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminDeliverySettings;
