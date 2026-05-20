import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Bell, Trash2, CheckCircle2, ChevronRight, MessageSquare, AlertTriangle, PlayCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch notifications representing general alerts or targeted admin advisories
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
        // Filter dynamically by user ID or global broadcast
        const userList = all.filter(n => n.userId === user.uid || n.userId === 'All');
        setNotifications(userList);
        setLoading(false);
      },
      () => {
        // Fallback default triggers
        setNotifications([
          {
            id: 'mock-notif-1',
            title: 'Critical Weather Advisory',
            message: 'Heat surge expected. Please schedule electrolyte feeding blocks and activate fans inside layer rooms.',
            type: 'alert',
            read: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'mock-notif-2',
            title: 'Welcome to Agrotech Poultry Hub',
            message: 'Your partner regional manager code is approved. Proceed to configure flock batches inside records.',
            type: 'info',
            read: true,
            createdAt: new Date().toISOString()
          }
        ]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      toast.error('Failed to mark notification as read');
    }
  };

  const deleteNotif = async (notifId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
      toast.success('Notification cleared successfully');
    } catch (err) {
      toast.error('Failed to clear notification');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto pb-12 select-none font-sans">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black italic text-[#0B2516] tracking-tight flex items-center gap-3">
            <Bell size={32} className="text-[#4F46E5] animate-swing" />
            NOTIFICATION FEED CENTER
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Stay in step with vet advice, logistics shipping notifications and milestone completion medals
          </p>
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm rounded-3xl bg-white p-6">
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-bold text-xs bg-slate-50/50 rounded-3xl border border-dashed border-slate-150">
              Your Agri-Logistics notification inbox is currently clear
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                  n.read 
                    ? 'border-slate-100 bg-slate-50/50 opacity-70' 
                    : 'border-indigo-100 bg-indigo-50/15'
                }`}
              >
                <div className="flex items-start gap-4 text-left">
                  <div className={`p-3 rounded-2xl ${
                    n.read 
                      ? 'bg-slate-150 text-slate-500' 
                      : n.type === 'alert' 
                        ? 'bg-red-100 text-red-650' 
                        : 'bg-indigo-100 text-[#4F46E5]'
                  }`}>
                    {n.type === 'alert' ? <AlertTriangle size={18} /> : <Bell size={18} />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-800 leading-snug">{n.title}</span>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping inline-block" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed max-w-md">{n.message}</p>
                    <p className="text-[10px] text-slate-400 font-bold font-mono">
                      {n.createdAt ? format(new Date(n.createdAt), 'dd MMM yyyy HH:mm') : 'Recently'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <Button 
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotif(n.id);
                    }}
                    className="w-8 h-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default Notifications;
