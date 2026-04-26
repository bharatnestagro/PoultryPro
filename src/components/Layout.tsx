import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { Home, PlusCircle, ShoppingBag, User, LayoutDashboard, LogOut, Package, Pill, FileText, ClipboardList, Menu, X as CloseIcon, Users, Bell } from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { checkAndRunAutoBackup } from '@/src/lib/backupManager';

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, profile, loading, signOut, isAdmin, isManager } = useAuth();
  const [stockSummary, setStockSummary] = useState({ feed: 0, medicine: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Hide sidebar by default on mobile, show on desktop
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Background auto-backup check
    checkAndRunAutoBackup(user.uid).catch(e => console.error("Auto backup failed:", e));

    const qFeed = query(collection(db, 'feedStock'), where('userId', '==', user.uid));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 0), 0);
      setStockSummary(prev => ({ ...prev, feed: total }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'feedStock'));

    const qMed = query(collection(db, 'medicineStock'), where('userId', '==', user.uid));
    const unsubMed = onSnapshot(qMed, (snapshot) => {
      setStockSummary(prev => ({ ...prev, medicine: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'medicineStock'));

    return () => {
      unsubFeed();
      unsubMed();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: PlusCircle, label: 'Add Data', path: '/add' },
    { icon: ShoppingBag, label: 'Shop', path: '/shop' },
    { icon: Bell, label: 'Notification', path: '/notifications' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 transition-all duration-300 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-0'} pb-20 md:pb-0`}>
      {/* Desktop Toggle Button (Outside Sidebar when closed) */}
      {!isSidebarOpen && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed top-4 left-4 z-50 bg-white shadow-md border rounded-full hidden md:flex"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={20} />
        </Button>
      )}

      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-slate-200 flex flex-col p-6 transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'w-64 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full overflow-hidden'} hidden md:flex`}>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">PoultryPro</h1>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsSidebarOpen(false)}>
            <Menu size={20} className="text-slate-400" />
          </Button>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                location.pathname === item.path
                  ? 'bg-emerald-50 text-emerald-600 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
          
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'bg-indigo-50 text-indigo-600 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard size={20} />
              <span>Admin Panel</span>
            </Link>
          )}

          {isManager && (
            <Link
              to="/manager"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                location.pathname.startsWith('/manager')
                  ? 'bg-amber-50 text-amber-600 font-medium'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Users size={20} />
              <span>Manager Panel</span>
            </Link>
          )}
        </nav>

        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Live Inventory</p>
          <div className="px-4 py-3 bg-slate-50 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <Package size={14} />
                <span className="text-xs font-medium">Feed</span>
              </div>
              <span className="text-xs font-bold text-amber-600">{stockSummary.feed} kg</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <Pill size={14} />
                <span className="text-xs font-medium">Medicine</span>
              </div>
              <span className="text-xs font-bold text-indigo-600">{stockSummary.medicine} Items</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => signOut()}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <Outlet context={{ isSidebarOpen }} />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center md:hidden z-50">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 ${
              location.pathname === item.path ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <item.icon size={24} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
