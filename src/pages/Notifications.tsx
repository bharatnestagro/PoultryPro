import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Info, AlertTriangle, CheckCircle2, Eye, Trash2, CheckCircle, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Notifications: React.FC = () => {
  const { user, profile } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'systemAlerts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, async (snap) => {
      const allAlerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter by target farm type or "All" and ensure it is active
      const filtered = allAlerts.filter((a: any) => {
        const isActive = a.active !== false;
        const isTargetMatch = a.userId 
          ? (a.userId === user?.uid) 
          : (a.target === 'All' || a.target === profile?.farmType);
        return isActive && isTargetMatch;
      });
      setAlerts(filtered);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'systemAlerts');
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile?.farmType]);

  const toggleReadStatus = async (alert: any) => {
    if (!user) return;
    const isRead = alert.viewedBy?.includes(user.uid);
    try {
      await updateDoc(doc(db, 'systemAlerts', alert.id), {
        viewedBy: isRead ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
      toast.success(isRead ? 'Marked as unread' : 'Marked as read');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `systemAlerts/${alert.id}`);
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Permanently delete this notification?')) return;
    try {
      await deleteDoc(doc(db, 'systemAlerts', alertId));
      toast.success('Notification deleted');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `systemAlerts/${alertId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 px-4">
      <header className="pt-4">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Notifications</h1>
        <p className="text-slate-500 font-medium">Critical alerts and updates for your farm</p>
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Loading Alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[2rem]">
            <CardContent className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6 border-4 border-white shadow-inner">
                <Bell size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900">All Clear!</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-2 font-medium">
                No active system alerts for your farm at the moment. We'll notify you here if anything changes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {alerts.map((alert, index) => {
                const isRead = alert.viewedBy?.includes(user?.uid);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    key={alert.id}
                  >
                    <Card className={`border-none shadow-sm overflow-hidden rounded-[2rem] relative group transition-all ${
                      isRead ? 'bg-white opacity-80' : 
                      alert.priority === 'High' ? 'bg-red-50' : 
                      alert.priority === 'Medium' ? 'bg-amber-50' : 
                      'bg-blue-50'
                    }`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-2xl shadow-sm ${
                            alert.priority === 'High' ? 'bg-red-500 text-white' : 
                            alert.priority === 'Medium' ? 'bg-amber-500 text-white' : 
                            'bg-blue-500 text-white'
                          }`}>
                            {alert.priority === 'High' ? <AlertTriangle size={20} /> : 
                             alert.priority === 'Medium' ? <Info size={20} /> : 
                             <Bell size={20} />}
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h3 className={`font-black tracking-tight text-lg uppercase ${isRead ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                  {alert.title}
                                </h3>
                                <Badge className={`text-[9px] font-bold uppercase border-none ${
                                  alert.priority === 'High' ? 'bg-red-200 text-red-700' : 
                                  alert.priority === 'Medium' ? 'bg-amber-200 text-amber-700' : 
                                  'bg-blue-200 text-blue-700'
                                }`}>
                                  {alert.priority}
                                </Badge>
                                {!isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                {alert.createdAt?.toDate ? format(alert.createdAt.toDate(), 'MMM dd, HH:mm') : 'Recently'}
                              </span>
                            </div>
                            
                            <p className={`text-sm font-medium leading-relaxed ${isRead ? 'text-slate-400' : 'text-slate-600'}`}>
                              {alert.description && alert.description.length > 100 ? alert.description.substring(0, 100) + '...' : alert.description}
                            </p>

                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedAlert(alert)}
                                className="h-8 rounded-xl text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] uppercase tracking-wider gap-1.5"
                              >
                                <Eye size={14} /> View
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => toggleReadStatus(alert)}
                                className={`h-8 rounded-xl font-bold text-[10px] uppercase tracking-wider gap-1.5 ${
                                  isRead ? 'text-slate-500 hover:bg-slate-50' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {isRead ? <Circle size={14} /> : <CheckCircle size={14} />}
                                {isRead ? 'Mark Unread' : 'Mark Read'}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => deleteAlert(alert.id)}
                                className="h-8 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 font-bold text-[10px] uppercase tracking-wider gap-1.5 ml-auto"
                              >
                                <Trash2 size={14} /> Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              {selectedAlert?.priority === 'High' ? <AlertTriangle className="text-red-500" /> : <Bell className="text-indigo-500" />}
              {selectedAlert?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-2">
               <Badge className={
                 selectedAlert?.priority === 'High' ? 'bg-red-100 text-red-600' : 
                 selectedAlert?.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                 'bg-blue-100 text-blue-600'
               }>
                 {selectedAlert?.priority} Priority
               </Badge>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                 {selectedAlert?.createdAt?.toDate ? format(selectedAlert.createdAt.toDate(), 'MMMM d, yyyy HH:mm') : 'Recently'}
               </span>
            </div>

            <p className="text-lg font-medium text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              {selectedAlert?.description}
            </p>

            {(selectedAlert?.condition || selectedAlert?.treatment) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedAlert?.condition && (
                  <div className="bg-white border-2 border-slate-100 p-5 rounded-[2rem]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observation</p>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{selectedAlert?.condition}</p>
                  </div>
                )}
                {selectedAlert?.treatment && (
                  <div className="bg-emerald-500 text-white p-5 rounded-[2rem] shadow-lg shadow-emerald-900/10">
                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={12} /> Recommended Action
                    </p>
                    <p className="text-sm font-black leading-tight">{selectedAlert?.treatment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notifications;
