import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminAutoAlerts: React.FC = () => {
  const [mortalityThreshold, setMortalityThreshold] = useState('2'); // 2%
  const [waterFeedDeviation, setWaterFeedDeviation] = useState('15'); // 15%
  const [weightGainLag, setWeightGainLag] = useState('10'); // 10%
  const [inactivityDays, setInactivityDays] = useState('3'); // 3 days without weekly log entries

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Automated clinical diagnostic thresholds updated successfully');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto pb-12 select-none">
      
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <Bell size={32} className="text-amber-500 animate-swing" />
          AUTOMATED LOG REVIEWS (AUTO-ALERTS)
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Configure clinical exception parameters, automated health thresholds, and critical anomaly detectors
        </p>
      </div>

      <Card className="border-slate-100 shadow-md rounded-[2.2rem] bg-white p-8">
        <div className="pb-6 border-b border-slate-50">
          <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-600" /> Clinical Diagnostic Rule Thresholds
          </CardTitle>
          <CardDescription className="text-xs">When daily breeder logs fall outer these bands, the engine autogenerates active clinical warning alerts</CardDescription>
        </div>

        <form onSubmit={handleSave} className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Mortality trigger value (% of Batch size)</Label>
              <div className="relative">
                <Input 
                  value={mortalityThreshold}
                  onChange={e => setMortalityThreshold(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold pr-12 focus-visible:ring-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-455 tracking-widest">Critical water-to-feed deviation limit (%)</Label>
              <div className="relative">
                <Input 
                  value={waterFeedDeviation}
                  onChange={e => setWaterFeedDeviation(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold pr-12 focus-visible:ring-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Low weight gain body lag indicator (%)</Label>
              <div className="relative">
                <Input 
                  value={weightGainLag}
                  onChange={e => setWeightGainLag(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold pr-12 focus-visible:ring-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div className="space-y-1.5 font-mono">
              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-widest">Breeder Silent logs warning days</Label>
              <div className="relative">
                <Input 
                  value={inactivityDays}
                  onChange={e => setInactivityDays(e.target.value)}
                  className="h-11 rounded-2xl bg-slate-55 border-slate-150 font-bold pr-12 focus-visible:ring-amber-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Days</span>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
              <CheckCircle2 size={13} /> Active Diagnostic Engine: Live
            </span>
            <Button type="submit" className="h-11 bg-[#0B2516] hover:bg-opacity-95 font-bold uppercase tracking-widest rounded-2xl text-xs text-white border-none">
              Save Rule bandings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminAutoAlerts;
