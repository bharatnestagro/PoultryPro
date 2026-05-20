import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Truck, Search, Navigation, Milestone, ArrowUpRight, 
  MapPin, User, Phone, CheckCircle, Clock, Anchor, Train
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

const AdminLogistics: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // 1. Fetch Orders to inspect shipping modes
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('date', 'desc')),
      (snap) => {
        setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      () => {
        // Fallback default mock orders with logistics properties
        setOrders([
          {
            id: 'ord-302a',
            userId: 'farmer-101',
            date: new Date().toISOString(),
            status: 'Processing',
            shippingMethod: 'Road Lorry',
            total: 54000,
            shipmentDetails: {
              road: {
                driverName: 'Ramesh Singh',
                driverNumber: '+91 98765 43210',
                vehicle: 'MH-12-PQ-9876',
                unloadingLocation: 'Sector A Warehouse, Agrotech Farm'
              }
            }
          },
          {
            id: 'ord-305b',
            userId: 'farmer-102',
            date: new Date().toISOString(),
            status: 'Shipped',
            shippingMethod: 'Railway Express',
            total: 125000,
            shipmentDetails: {
              railway: {
                trainNumber: '12723',
                trainName: 'Telangana Express',
                loadedStation: 'Secunderabad Jn (SC)',
                unloadingStation: 'New Delhi (NDLS)',
                builtyImage: 'https://archive.org/builty-mock.pdf'
              }
            }
          }
        ]);
        setLoading(false);
      }
    );

    // 2. Fetch farmers
    const unsubFarmers = onSnapshot(collection(db, 'users'), (snap) => {
      setFarmers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubOrders();
      unsubFarmers();
    };
  }, []);

  const getFarmerName = (id: string) => {
    return farmers.find(f => f.id === id)?.name || id || 'System Farm';
  };

  const updateLogisticsStatus = async (orderId: string, nextStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: nextStatus });
      toast.success(`Dispatches status updated to ${nextStatus}`);
    } catch (err) {
      toast.error('Logistics status change failed');
    }
  };

  const filteredOrders = orders.filter(o => {
    const fn = getFarmerName(o.userId).toLowerCase();
    const oid = o.id.toLowerCase();
    const mode = (o.shippingMethod || '').toLowerCase();
    const mSearch = fn.includes(searchTerm.toLowerCase()) || oid.includes(searchTerm.toLowerCase()) || mode.includes(searchTerm.toLowerCase());
    return mSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-12 select-none">
      
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
          <Truck size={32} className="text-indigo-600 animate-bounce" />
          FLEETS & DISPATCH LOGISTICS
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          Master shipping, railway builty records, and route planning controls
        </p>
      </div>

      {/* Aggregate overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Road dispatches</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {orders.filter(o => o.shippingMethod?.toLowerCase().includes('road') || o.shippingMethod?.toLowerCase().includes('lorry')).length} Active
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-105">
              <Train size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Railway Cargo</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {orders.filter(o => o.shippingMethod?.toLowerCase().includes('rail')).length} Shipments
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm rounded-3xl bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-110">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none">Delivery Success Ratio</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">98.4%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main active freights registry is presented in nice ledger format */}
      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-lg font-black italic text-slate-800 uppercase tracking-tight">Active Dispatches registry</CardTitle>
            <CardDescription className="text-xs">Monitor train numbers, truck number plates and driver compliance states</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              placeholder="Search truck plates, driver name..."
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
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Lading Date & ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Farmer (Dest)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Logistics Mode</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider">Carrier specifics / Driver details</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Transit Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-bold">
                    No active dispatches en route
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => {
                  const details = o.shipmentDetails || {};
                  return (
                    <TableRow key={o.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-4">
                        <p className="font-extrabold text-xs text-slate-800">#{o.id}</p>
                        <p className="text-[10px] text-slate-405 font-semibold">
                          {o.date ? format(new Date(o.date), 'dd MMM yyyy') : 'N/A'}
                        </p>
                      </TableCell>
                      
                      <TableCell className="text-xs font-black text-slate-700">
                        {getFarmerName(o.userId)}
                      </TableCell>

                      <TableCell>
                        <Badge className="bg-indigo-50 hover:bg-slate-100 text-indigo-800 font-extrabold border border-indigo-150 uppercase text-[9px] rounded-full">
                          {o.shippingMethod || o.shippingCost > 0 ? 'Home Delivery' : 'Collect from Store'}
                        </Badge>
                      </TableCell>

                      <TableCell className="max-w-md">
                        {details.road && (
                          <div className="text-xs font-bold text-slate-650 space-y-1">
                            <p className="flex items-center gap-1.5"><Truck size={12} className="text-slate-400" /> Vehicle: <span className="font-black text-slate-800">{details.road.vehicle}</span></p>
                            <p className="flex items-center gap-1.5"><User size={12} className="text-slate-400" /> Driver: <span className="text-slate-700">{details.road.driverName}</span> ({details.road.driverNumber})</p>
                          </div>
                        )}
                        {details.railway && (
                          <div className="text-xs font-bold text-slate-650 space-y-1">
                            <p className="flex items-center gap-1.5"><Train size={12} className="text-indigo-400" /> Train: <span className="font-black text-slate-800">{details.railway.trainName} (#{details.railway.trainNumber})</span></p>
                            <p className="flex items-center gap-1.5"><MapPin size={12} className="text-red-400" /> Loading: <span className="text-slate-700">{details.railway.loadedStation} → {details.railway.unloadingStation}</span></p>
                            {details.railway.builtyImage && (
                              <a 
                                href={details.railway.builtyImage} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline font-black mt-1"
                              >
                                View RR (Builty) Copy <ArrowUpRight size={10} />
                              </a>
                            )}
                          </div>
                        )}
                        {!details.road && !details.railway && (
                          <p className="text-xs font-bold text-slate-400 italic">Self collect / pending logistics details</p>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        <Badge className={`uppercase text-[9px] font-black rounded-full px-2.5 py-0.5 border ${
                          o.status === 'Completed' || o.status === 'Delivered'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : o.status === 'Shipped' 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-805'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {o.status || 'Received'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            size="sm"
                            onClick={() => updateLogisticsStatus(o.id, 'Shipped')}
                            className="h-7 text-[9px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border-none font-bold uppercase tracking-wider"
                            disabled={o.status === 'Shipped'}
                          >
                            Mark Shipped
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => updateLogisticsStatus(o.id, 'Completed')}
                            className="h-7 text-[9px] rounded-full bg-emerald-55 hover:bg-emerald-100 text-emerald-800 border-none font-bold uppercase tracking-wider"
                            disabled={o.status === 'Completed' || o.status === 'Delivered'}
                          >
                            Mark Delivered
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default AdminLogistics;
