import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Users, 
  Package, 
  LayoutDashboard, 
  LogOut, 
  CreditCard, 
  FileText, 
  ShieldAlert, 
  Shield,
  Settings, 
  Bell, 
  Search,
  Activity,
  ShoppingCart,
  Truck,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Menu,
  Key,
  Home
} from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { user, profile, loading, signOut, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => 
      prev.includes(label) ? [] : [label]
    );
  };

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch system settings for alerts
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    });

    // Fetch recent activity as notifications
    const q = query(collection(db, 'dailyLogs'), orderBy('date', 'desc'), limit(5));
    const unsubLogs = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(doc => ({
        id: doc.id,
        title: 'New Daily Log',
        description: `A farmer submitted a new log for ${doc.data().date}`,
        time: 'Just now',
        type: 'log'
      }));
      setNotifications(logs);
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const navItems = [
    { icon: Home, label: 'Farmer View', path: '/dashboard' },
    { icon: LayoutDashboard, label: 'Analytics Dashboard', path: '/admin' },
    { 
      icon: Users, 
      label: 'Farmers', 
      path: '/admin/farmers',
      children: [
        { label: 'Farmer Directory', path: '/admin/farmers' },
        { label: 'Flocks', path: '/admin/flocks' },
        { label: 'Health', path: '/admin/health' },
        { label: 'Operations', path: '/admin/operations' },
        { label: 'Daily Logs', path: '/admin/logs' },
        { label: 'Schedule', path: '/admin/schedule' },
        { label: 'Farmer Transactions', path: '/admin/transactions?source=farmer' },
      ]
    },
    {
      icon: Shield,
      label: 'Team Management',
      path: '/admin/managers',
      children: [
        { label: 'Manager Analytics', path: '/admin/manager-analytics' },
        { label: 'Managers & Roles', path: '/admin/managers' },
        { label: 'Commission & Payment', path: '/admin/payments' },
      ]
    },
    {
      icon: Bell,
      label: 'Notifications',
      path: '/admin/alerts',
      children: [
        { label: 'Make Alerts', path: '/admin/alerts' },
        { label: 'Auto Alert', path: '/admin/auto-alerts' },
      ]
    },
    { 
      icon: ShoppingCart, 
      label: 'Shop Management', 
      path: '/admin/shop',
      children: [
        { label: 'Main Shop dashboard', path: '/admin/shop' },
        { label: 'Inventory', path: '/admin/inventory' },
        { label: 'Orders', path: '/admin/orders' },
        { label: 'Delete Order', path: '/admin/orders/deleted' },
        { label: 'Customer', path: '/admin/customers' },
        { label: 'Offer', path: '/admin/offers' },
        { label: 'Logistics', path: '/admin/logistics' },
        { label: 'shop Transactions', path: '/admin/transactions?source=shop' },
        { label: 'Shop setting', path: '/admin/settings' },
      ]
    },
    {
      icon: Key,
      label: 'License Key',
      path: '/admin/keys',
      children: [
        { label: 'Key management', path: '/admin/keys' },
        { label: 'Key Pricing', path: '/admin/keys/pricing' }
      ]
    },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#F9F9F4] flex overflow-x-hidden">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div className="fixed inset-0 bg-black/40 z-[45] backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-slate-100 flex flex-col z-50 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-0 lg:opacity-0'}`}>
        <div className="p-6 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold text-slate-900 truncate">Agrarian Modernist</h1>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>
          <p className="text-xs text-slate-400 font-medium truncate">Admin Suite • Poultry Management</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus.includes(item.label);
            const currentFullRootPath = location.pathname + location.search;
            const isActive = location.pathname === item.path || (hasChildren && item.children?.some(child => currentFullRootPath === child.path));
            
            return (
              <div key={item.label} className="space-y-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive && !isExpanded
                        ? 'bg-[#122B21] text-white shadow-lg shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={20} className={isActive && !isExpanded ? 'text-white' : 'text-slate-400'} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-[#122B21] text-white shadow-lg shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )}

                {hasChildren && isExpanded && (
                  <div className="ml-9 space-y-1 border-l-2 border-slate-100 pl-2">
                    {item.children?.map((child) => {
                      const isChildActive = currentFullRootPath === child.path;
                      return (
                        <Link
                          key={child.label}
                          to={child.path}
                          onClick={() => {
                            if (window.innerWidth < 1024) setIsSidebarOpen(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                            isChildActive
                              ? 'text-emerald-600 font-bold bg-emerald-50'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <Button 
            className="w-full bg-[#122B21] hover:bg-[#1a3d2e] text-white rounded-xl py-6 flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Add New Farm</span>
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-500 hover:text-red-600 hover:bg-red-50 mt-4 rounded-xl"
            onClick={() => signOut()}
          >
            <LogOut size={20} />
            <span>Logout Suite</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={22} className="text-slate-600" />
            </Button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder="Search data, farmers, flocks..." 
                className="pl-10 bg-slate-100 border-none rounded-2xl focus-visible:ring-emerald-500 h-11"
              />
            </div>
            <nav className="hidden lg:flex items-center gap-6">
              <Link 
                to="/admin" 
                className={`text-sm font-semibold transition-colors ${location.pathname === '/admin' ? 'text-slate-900 border-b-2 border-emerald-600 pb-1' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Analytics Dashboard
              </Link>
              <Link 
                to="/admin/operations" 
                className={`text-sm font-semibold transition-colors ${location.pathname === '/admin/operations' ? 'text-slate-900 border-b-2 border-emerald-600 pb-1' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Operations
              </Link>
              <Link 
                to="/admin/logistics" 
                className={`text-sm font-semibold transition-colors ${location.pathname === '/admin/logistics' ? 'text-slate-900 border-b-2 border-emerald-600 pb-1' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Logistics
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger className="rounded-full relative p-2 hover:bg-slate-100 transition-colors outline-none">
                <Bell size={20} className="text-slate-600" />
                {settings?.inAppAlerts && notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 rounded-2xl shadow-2xl border-slate-100 overflow-hidden" align="end">
                <div className="p-4 bg-[#122B21] text-white">
                  <h4 className="font-bold">Notifications</h4>
                  <p className="text-[10px] text-emerald-200 uppercase tracking-widest">System Alerts & Activity</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {!settings?.inAppAlerts ? (
                    <div className="p-8 text-center text-slate-400 text-sm italic">
                      In-app alerts are currently disabled in settings.
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm italic">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-slate-900">{n.title}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{n.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{n.description}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 bg-slate-50 text-center">
                  <Button variant="ghost" size="sm" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-900">
                    Clear All Notifications
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">Admin Suite</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">System Controller</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border-2 border-white shadow-sm">
                AS
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
