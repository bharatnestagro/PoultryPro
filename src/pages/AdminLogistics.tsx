import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Calendar,
  ChevronRight,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Download
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

interface Order {
  id: string;
  farmerId: string;
  farmerName: string;
  userName?: string;
  items: any[];
  total: number;
  status: string;
  createdAt: any;
  deliveryDate?: any;
  totalAmount?: number;
}

interface Flock {
  id: string;
  farmerId: string;
  name: string;
  initialCount: number;
  placementDate: string;
  status: string;
}

const AdminLogistics: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [schedulingData, setSchedulingData] = useState({
    orderId: '',
    deliveryDate: format(new Date(), 'yyyy-MM-dd'),
    partnerId: '',
    notes: ''
  });

  useEffect(() => {
    // Fetch Orders
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snap) => {
        const ordersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(ordersData);
      }
    );

    // Fetch Partners
    const unsubPartners = onSnapshot(collection(db, 'deliveryPartners'), (snap) => {
      setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Flocks for placements
    const unsubFlocks = onSnapshot(
      query(collection(db, 'flocks'), orderBy('placementDate', 'desc')),
      (snap) => {
        const flocksData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flock));
        setFlocks(flocksData);
      }
    );

    // Fetch Farmers for names
    const unsubFarmers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'farmer')),
      (snap) => {
        const farmersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFarmers(farmersData);
      }
    );

    setLoading(false);
    return () => {
      unsubOrders();
      unsubFlocks();
      unsubFarmers();
    };
  }, []);

  const activeDeliveries = orders.filter(o => o.status === 'Processing' || o.status === 'Shipped');
  const pendingPlacements = flocks.filter(f => f.status === 'Pending' || new Date(f.placementDate) > new Date());
  const completedDeliveries = orders.filter(o => o.status === 'Delivered');

  // Mock inventory alerts (in a real app, you'd fetch feedStock collection)
  const inventoryAlerts = [
    { id: 1, farm: 'Green Valley', item: 'Pre-Starter Feed', stock: '150kg', threshold: '500kg', status: 'Critical' },
    { id: 2, farm: 'Sunshine Poultry', item: 'Medicine A', stock: '2 units', threshold: '10 units', status: 'Low' },
  ];

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date()
      });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleConfirmPlacement = async (flockId: string) => {
    try {
      await updateDoc(doc(db, 'flocks', flockId), {
        status: 'Active',
        updatedAt: new Date()
      });
      toast.success('Placement confirmed and flock is now active');
    } catch (error) {
      toast.error('Failed to confirm placement');
    }
  };

  const handleScheduleDelivery = async () => {
    if (!schedulingData.orderId) {
      toast.error('Please select an order');
      return;
    }

    try {
      const partner = partners.find(p => p.id === schedulingData.partnerId);
      await updateDoc(doc(db, 'orders', schedulingData.orderId), {
        deliveryDate: schedulingData.deliveryDate,
        logisticsNotes: schedulingData.notes,
        partnerId: schedulingData.partnerId || '',
        partnerName: partner?.name || '',
        status: 'Processing',
        updatedAt: new Date()
      });
      toast.success('Delivery scheduled successfully');
      setShowScheduleDialog(false);
      setSchedulingData({
        orderId: '',
        deliveryDate: format(new Date(), 'yyyy-MM-dd'),
        partnerId: '',
        notes: ''
      });
    } catch (error) {
      toast.error('Failed to schedule delivery');
    }
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Logistics Control</h2>
          <p className="text-slate-500 font-medium mt-1">Manage supply chain, deliveries, and farm placements</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl border-slate-200 font-bold text-slate-600 h-12 px-6">
            <Download size={18} className="mr-2" />
            Export Report
          </Button>
          <Button 
            className="bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-2xl font-bold h-12 px-8 shadow-lg shadow-emerald-900/10"
            onClick={() => setShowScheduleDialog(true)}
          >
            Schedule Delivery
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Truck size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Deliveries</p>
              <h3 className="text-2xl font-bold text-slate-900">{activeDeliveries.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-lg">
            <Clock size={12} />
            <span>IN TRANSIT</span>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Package size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Placements</p>
              <h3 className="text-2xl font-bold text-slate-900">{pendingPlacements.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-lg">
            <Calendar size={12} />
            <span>UPCOMING</span>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Alerts</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventoryAlerts.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 w-fit px-2 py-1 rounded-lg">
            <AlertTriangle size={12} />
            <span>ACTION REQUIRED</span>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm bg-white rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Deliveries</p>
              <h3 className="text-2xl font-bold text-slate-900">{completedDeliveries.length}</h3>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <ArrowUpRight size={12} />
            <span>THIS MONTH</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Delivery Tracking */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delivery Tracking</h3>
                <p className="text-xs text-slate-400 font-medium">Real-time supply chain monitoring</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="Search deliveries..." 
                  className="pl-9 bg-white border-slate-100 rounded-xl h-10 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Farmer</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</th>
                    <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic text-sm">
                        No deliveries found
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <p className="text-xs font-bold text-slate-900">#{order.id.slice(-6).toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : 'N/A'}</p>
                        </td>
                        <td className="px-4 py-5">
                          <p className="text-xs font-bold text-slate-900">{order.farmerName || 'Unknown Farmer'}</p>
                          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <MapPin size={10} />
                            Farm Location
                          </p>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-wrap gap-1">
                            {order.items?.map((item: any, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-[9px] border-slate-100 bg-white">
                                {item.name} x{item.quantity}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <Badge className={`rounded-lg text-[10px] border-none px-2 py-0.5 ${
                            order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' :
                            order.status === 'Shipped' ? 'bg-blue-50 text-blue-600' :
                            order.status === 'Processing' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-50 text-slate-400'
                          }`}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-xl hover:bg-white hover:shadow-sm" />}>
                              <MoreVertical size={16} className="text-slate-400" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl">
                              <DropdownMenuItem 
                                className="text-xs font-medium py-2 cursor-pointer"
                                onClick={() => handleUpdateStatus(order.id, 'Processing')}
                              >
                                Mark as Processing
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs font-medium py-2 cursor-pointer"
                                onClick={() => handleUpdateStatus(order.id, 'Shipped')}
                              >
                                Mark as Shipped
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs font-medium py-2 cursor-pointer text-emerald-600 focus:text-emerald-600"
                                onClick={() => handleUpdateStatus(order.id, 'Delivered')}
                              >
                                Mark as Delivered
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Upcoming Placements */}
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-900">Upcoming Placements</h3>
              <p className="text-xs text-slate-400 font-medium">Scheduled bird arrivals across farms</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingPlacements.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-slate-400 italic text-sm">
                  No upcoming placements scheduled
                </div>
              ) : (
                pendingPlacements.map((flock) => (
                  <div key={flock.id} className="p-4 rounded-2xl border border-slate-50 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Package size={20} />
                      </div>
                      <Badge variant="outline" className="text-[10px] border-emerald-100 text-emerald-600 bg-white">
                        {flock.status}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{flock.name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Bird Count:</span>
                        <span className="font-bold text-slate-700">{flock.initialCount} Birds</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Placement Date:</span>
                        <span className="font-bold text-slate-700">{flock.placementDate ? format(new Date(flock.placementDate), 'MMM dd, yyyy') : 'N/A'}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="w-full mt-4 h-9 rounded-xl text-[11px] font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                      onClick={() => handleConfirmPlacement(flock.id)}
                      disabled={flock.status === 'Active'}
                    >
                      {flock.status === 'Active' ? 'Placement Confirmed' : 'Confirm Logistics'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Inventory Monitoring & Alerts */}
        <div className="space-y-8">
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              <h3 className="text-lg font-bold text-slate-900">Inventory Alerts</h3>
              <p className="text-xs text-slate-400 font-medium">Low stock notifications from farms</p>
            </div>
            <div className="p-6 space-y-4">
              {inventoryAlerts.map((alert) => (
                <div key={alert.id} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{alert.farm}</p>
                      <h4 className="text-sm font-bold text-slate-900">{alert.item}</h4>
                    </div>
                    <Badge className={`text-[10px] border-none ${alert.status === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {alert.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${alert.status === 'Critical' ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: '30%' }}
                      ></div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">{alert.stock}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic">Threshold: {alert.threshold}</p>
                  <Button className="w-full h-9 rounded-xl text-[11px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all">
                    Create Dispatch Order
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-none shadow-sm bg-[#122B21] rounded-[2rem] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Logistics Support</h3>
              <p className="text-emerald-200/70 text-sm leading-relaxed mb-6">Need help with route optimization or carrier management?</p>
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-[#122B21] rounded-xl font-bold w-full h-12">
                Contact Support
              </Button>
            </div>
            <Truck className="absolute -bottom-4 -right-4 text-emerald-900/20 w-32 h-32 rotate-12" />
          </Card>
        </div>
      </div>

      {/* Schedule Delivery Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="rounded-[2rem] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Schedule New Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Order</Label>
              <select 
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={schedulingData.orderId}
                onChange={e => setSchedulingData({...schedulingData, orderId: e.target.value})}
              >
                <option value="">Choose an order...</option>
                {orders.filter(o => o.status === 'Pending' || o.status === 'Received').map(order => (
                  <option key={order.id} value={order.id}>
                    #{order.id.slice(-6).toUpperCase()} - {order.farmerName || order.userName} ({order.totalAmount || order.total ? `₹${order.totalAmount || order.total}` : 'No Amount'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Partner (Optional)</Label>
              <select 
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={schedulingData.partnerId}
                onChange={e => setSchedulingData({...schedulingData, partnerId: e.target.value})}
              >
                <option value="">Select Delivery Partner...</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.vehicleType})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input 
                type="date"
                value={schedulingData.deliveryDate}
                onChange={e => setSchedulingData({...schedulingData, deliveryDate: e.target.value})}
                className="rounded-xl border-slate-200 h-12"
              />
            </div>

            <div className="space-y-2">
              <Label>Logistics Notes (Optional)</Label>
              <textarea 
                className="w-full rounded-xl border border-slate-200 bg-white p-3 font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                placeholder="e.g. Special handling, preferred time..."
                value={schedulingData.notes}
                onChange={e => setSchedulingData({...schedulingData, notes: e.target.value})}
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl h-12 font-bold"
                onClick={() => setShowScheduleDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-[#122B21] hover:bg-[#1a3d2e] h-12 rounded-xl font-bold text-white shadow-lg shadow-emerald-950/20"
                onClick={handleScheduleDelivery}
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLogistics;
