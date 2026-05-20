import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { ShoppingBag, Search, Sparkles, AlertCircle, ShoppingCart, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ManagerShop: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    // 1. Fetch active shopItems
    const qItems = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      qItems,
      (snap) => {
        setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default supplies catalogs
        setItems([
          {
            id: 'item-1',
            name: 'High Protein Broiler Pre-Starter Feed',
            category: 'Feed',
            price: 1850,
            stock: 350,
            description: 'Optimal nutrient density for day-1 to day-10 chicks. Micro-crumble form.'
          },
          {
            id: 'item-2',
            name: 'Ranikhet Vaccine (F1 Strain) - 100 Doses',
            category: 'Medicine',
            price: 750,
            stock: 120,
            description: 'Crucial day-7 Newcastle disease immunization. Cold chain transport guaranteed.'
          },
          {
            id: 'item-3',
            name: 'Automatic Hanging Bell Drinkers',
            category: 'Equipment',
            price: 450,
            stock: 80,
            description: 'Durable polymer drinkers with sensitive overflow valve control.'
          }
        ]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filtered = items.filter(itm => {
    const name = (itm.name || '').toLowerCase();
    const cat = (itm.category || '').toLowerCase();
    const desc = (itm.description || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch = name.includes(term) || desc.includes(term);

    if (filterCategory === 'All') return matchesSearch;
    return matchesSearch && cat === filterCategory.toLowerCase();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none font-sans">
      
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <ShoppingBag size={32} className="text-[#4E46E5] animate-pulse" />
            HUB SUPPLY & DISTRIBUTOR CATALOG
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Review active stock counts, bulk rates, and agricultural equipment allocations
          </p>
        </div>
      </div>

      {/* Main filter bars */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Feed', 'Medicine', 'Equipment'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${
                filterCategory === cat
                  ? 'bg-[#0B2516] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-450 hover:bg-slate-100 hover:text-slate-700 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input 
            placeholder="Search catalog items..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-9 rounded-full text-xs font-semibold focus-visible:ring-indigo-500"
          />
        </div>
      </div>

      {/* Bento Grid catalog items layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs font-bold text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-150">
            No matching supply catalog items found in the database
          </div>
        ) : (
          filtered.map((itm) => (
            <Card key={itm.id} className="border-slate-100 shadow-sm rounded-3xl bg-white overflow-hidden p-6 relative flex flex-col justify-between hover:shadow-md transition-all">
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <Badge className="bg-indigo-50 text-[#4E46E5] font-black uppercase tracking-wider text-[8px] border border-indigo-150 rounded-full">
                    {itm.category || 'Supply'}
                  </Badge>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    (itm.stock || 0) > 20 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {(itm.stock || 0) > 21 ? `${itm.stock} Units Available` : 'Low Stock warning'}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800 leading-snug line-clamp-1">{itm.name}</h3>
                  <p className="text-xs text-slate-405 leading-normal font-semibold line-clamp-2">{itm.description}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 mt-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Estimated Bulk rate</p>
                  <p className="text-xl font-black text-slate-900 mt-0.5">₹{(itm.price || 0).toLocaleString()}</p>
                </div>

                <div className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 border border-slate-105 cursor-pointer">
                  <Info size={16} />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[#4F46E5] uppercase tracking-wide">Manager Order Placement Guidance</h4>
            <p className="text-xs text-slate-500 leading-normal mt-0.5 max-w-xl">
              Regional Managers assist assigned breeders with credit allocations or offline cash invoicing. Share this standard distributor price catalog during field surveys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerShop;
