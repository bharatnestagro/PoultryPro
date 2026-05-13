import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Truck, 
  MapPin, 
  Clock, 
  Banknote, 
  Save, 
  Plus, 
  X,
  CreditCard,
  Package,
  AlertTriangle,
  TrainFront
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const AdminDeliverySettings: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    deliveryCharge: 50,
    freeDeliveryThreshold: 1000,
    estimatedDays: '3-5',
    activeAreas: ['Pune', 'Satara', 'Wai', 'Mahabaleshwar'],
    pickupPoints: [
      { id: 'PP1', name: 'Main Warehouse', address: 'Plot 45, Industrial Estate, Satara' }
    ],
    codEnabled: true,
    expressDeliveryEnabled: false,
    expressCharge: 150,
    specialHandling: {
      heavyFreight: { enabled: true, note: 'Cost calculated after order based on weight/volume. No bike delivery.' },
      liveStock: { enabled: true, note: 'Transported via Railways. Cost varies by distance to nearest junction.' },
      byRoad: { enabled: true, note: 'Shipment cost based on truck/tempo load. Calculated after order verification.' },
      variableDates: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [newArea, setNewArea] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'system', 'deliverySettings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings(snap.data());
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'system', 'deliverySettings'), settings);
      toast.success('Delivery settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    }
  };

  const addArea = () => {
    if (!newArea) return;
    if (settings.activeAreas.includes(newArea)) {
      toast.error('Area already exists');
      return;
    }
    setSettings({
      ...settings,
      activeAreas: [...settings.activeAreas, newArea]
    });
    setNewArea('');
  };

  const removeArea = (area: string) => {
    setSettings({
      ...settings,
      activeAreas: settings.activeAreas.filter((a: string) => a !== area)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Delivery Settings</h2>
          <p className="text-slate-500 font-medium mt-1">Configure shipping rates, areas, and delivery options</p>
        </div>
        <Button 
          className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl font-bold h-12 px-8 shadow-lg shadow-emerald-900/10"
          onClick={handleSave}
        >
          <Save size={18} className="mr-2" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Rates */}
        <Card className="p-8 border-none shadow-sm rounded-[2.5rem] bg-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Banknote size={20} />
            </div>
            <h3 className="text-lg font-bold">Shipping Rates</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400 pl-1">Standard Delivery Charge</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                <Input 
                  type="number"
                  value={settings.deliveryCharge}
                  onChange={e => setSettings({...settings, deliveryCharge: Number(e.target.value)})}
                  className="pl-8 rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400 pl-1">Free Delivery Above</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                <Input 
                  type="number"
                  value={settings.freeDeliveryThreshold}
                  onChange={e => setSettings({...settings, freeDeliveryThreshold: Number(e.target.value)})}
                  className="pl-8 rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <CreditCard size={16} className="text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-bold">Cash on Delivery</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Allow payments upon delivery</p>
                </div>
              </div>
              <Switch 
                checked={settings.codEnabled}
                onCheckedChange={val => setSettings({...settings, codEnabled: val})}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Clock size={16} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">Express Delivery</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Premium 24-hour service</p>
                </div>
              </div>
              <Switch 
                checked={settings.expressDeliveryEnabled}
                onCheckedChange={val => setSettings({...settings, expressDeliveryEnabled: val})}
              />
            </div>

            {settings.expressDeliveryEnabled && (
              <div className="pl-4 border-l-2 border-amber-200 mt-2">
                 <Label className="text-xs font-bold uppercase text-slate-400 pl-1">Express Surcharge</Label>
                 <div className="relative mt-1">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                   <Input 
                    type="number"
                    value={settings.expressCharge}
                    onChange={e => setSettings({...settings, expressCharge: Number(e.target.value)})}
                    className="pl-8 rounded-xl border-slate-100 bg-slate-50 h-10 font-bold"
                   />
                 </div>
              </div>
            )}
          </div>
        </Card>

        {/* Coverage Areas */}
        <Card className="p-8 border-none shadow-sm rounded-[2.5rem] bg-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <MapPin size={20} />
            </div>
            <h3 className="text-lg font-bold">Serviceable Areas</h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Add city or pincode..." 
                value={newArea}
                onChange={e => setNewArea(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addArea()}
                className="rounded-xl border-slate-100 bg-slate-50 h-12"
              />
              <Button onClick={addArea} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-4 h-12 text-white">
                <Plus size={18} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.activeAreas.map((area: string) => (
                <Badge key={area} className="bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-xl text-xs font-bold font-mono group cursor-pointer transition-all border-none">
                  {area}
                  <button onClick={() => removeArea(area)} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-4">
             <div className="p-6 bg-indigo-900 rounded-[2rem] text-white relative overflow-hidden">
                <div className="relative z-10">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-1">Logistics Note</p>
                   <p className="text-xs leading-relaxed opacity-80 italic">Orders outside these areas will be automatically flagged for manual verification before shipment.</p>
                </div>
                <Truck className="absolute -bottom-2 -right-2 text-white/5 w-24 h-24 rotate-12" />
             </div>
          </div>
        </Card>

        {/* Timeline Settings */}
        <Card className="p-8 border-none shadow-sm rounded-[2.5rem] bg-white lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold">Delivery Timeline</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400 pl-1">Estimated Delivery (Days)</Label>
              <Input 
                value={settings.estimatedDays}
                onChange={e => setSettings({...settings, estimatedDays: e.target.value})}
                placeholder="e.g. 3-5"
                className="rounded-xl border-slate-100 bg-slate-50 h-12 font-bold"
              />
            </div>
            <div className="space-y-4 md:col-span-2">
              <p className="text-xs font-bold text-slate-400 uppercase pl-1">Delivery Partner Integration</p>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Package size={24} className="text-slate-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black italic text-slate-900 uppercase">Self-Managed Logistics</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Using in-house partners & vehicles</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-600 border-none font-bold text-[8px] uppercase">Default</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Special Handling Rules */}
      <Card className="p-8 border-none shadow-sm rounded-[2.5rem] bg-white space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Special Handling Rules</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase italic">Configure logistics for non-standard products</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="text-slate-400" size={18} />
                  <p className="text-sm font-black italic uppercase">Heavy & Bulk Items</p>
                </div>
                <Switch 
                  checked={settings.specialHandling?.heavyFreight?.enabled}
                  onCheckedChange={val => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      heavyFreight: { ...settings.specialHandling?.heavyFreight, enabled: val } 
                    }
                  })}
                />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Customer Message / Policy</Label>
                <Input 
                  value={settings.specialHandling?.heavyFreight?.note}
                  onChange={e => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      heavyFreight: { ...settings.specialHandling?.heavyFreight, note: e.target.value } 
                    }
                  })}
                  className="rounded-xl border-slate-100 bg-white h-12 font-medium text-xs italic"
                />
             </div>
          </div>

          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrainFront className="text-slate-400" size={18} />
                  <p className="text-sm font-black italic uppercase">Live Stock (Chicks)</p>
                </div>
                <Switch 
                  checked={settings.specialHandling?.liveStock?.enabled}
                  onCheckedChange={val => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      liveStock: { ...settings.specialHandling?.liveStock, enabled: val } 
                    }
                  })}
                />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Railway Transport Note</Label>
                <Input 
                  value={settings.specialHandling?.liveStock?.note}
                  onChange={e => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      liveStock: { ...settings.specialHandling?.liveStock, note: e.target.value } 
                    }
                  })}
                  className="rounded-xl border-slate-100 bg-white h-12 font-medium text-xs italic"
                />
             </div>
          </div>
          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="text-slate-400" size={18} />
                  <p className="text-sm font-black italic uppercase">By Road Shipment</p>
                </div>
                <Switch 
                  checked={settings.specialHandling?.byRoad?.enabled}
                  onCheckedChange={val => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      byRoad: { ...settings.specialHandling?.byRoad, enabled: val } 
                    }
                  })}
                />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">By Road Policy Note</Label>
                <Input 
                  value={settings.specialHandling?.byRoad?.note}
                  onChange={e => setSettings({
                    ...settings, 
                    specialHandling: { 
                      ...settings.specialHandling, 
                      byRoad: { ...settings.specialHandling?.byRoad, note: e.target.value } 
                    }
                  })}
                  className="rounded-xl border-slate-100 bg-white h-12 font-medium text-xs italic"
                />
             </div>
          </div>
        </div>

        <div className="p-6 bg-blue-900 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
           <div className="relative z-10 flex-1">
              <h4 className="text-xl font-black italic uppercase mb-2">Dynamic Logistics Mode</h4>
              <p className="text-xs opacity-80 font-medium leading-relaxed italic max-w-xl">When enabled, orders containing special items will skip automatic shipping calculation. Admins/Managers will manually provide shipping costs and dates after reviewing the order distance and requirements.</p>
           </div>
           <div className="relative z-10 flex items-center gap-4 bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/20">
              <span className="text-xs font-black italic uppercase tracking-widest">{settings.specialHandling?.variableDates ? 'Active' : 'Disabled'}</span>
              <Switch 
                checked={settings.specialHandling?.variableDates}
                onCheckedChange={val => setSettings({
                  ...settings, 
                  specialHandling: { ...settings.specialHandling, variableDates: val } 
                })}
              />
           </div>
           <Clock className="absolute -bottom-4 -left-4 text-white/5 w-32 h-32 -rotate-12" />
        </div>
      </Card>
    </div>
  );
};

export default AdminDeliverySettings;
