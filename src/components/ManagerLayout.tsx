import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Users, 
  LayoutDashboard, 
  LogOut, 
  Settings, 
  Bell, 
  Activity,
  Menu,
  X,
  UserCheck,
  ClipboardList,
  ShoppingBag,
  Package,
  CreditCard,
  Bird,
  Calendar,
  Key,
  Home,
  ShoppingCart,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';

const ManagerLayout: React.FC = () => {
  const location = useLocation();
  const { user, profile, loading, signOut, isManager } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
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

  if (loading) return null;
  if (!user || !isManager) return <Navigate to="/dashboard" replace />;

  const navItems = [
    { icon: Home, label: 'Farmer View', path: '/dashboard' },
    { icon: LayoutDashboard, label: 'Manager Dashboard', path: '/manager' },
    { 
      icon: Users, 
      label: 'My Farmers', 
      path: '/manager/farmers',
      children: [
        { icon: ShoppingBag, label: 'Sales Orders', path: '/manager/orders' },
        { icon: Package, label: 'Farmer Stock', path: '/manager/farmer-inventory' },
        { icon: Bird, label: 'Flock Management', path: '/manager/flocks' },
        { icon: Calendar, label: 'Schedule', path: '/manager/schedule' },
        { icon: CreditCard, label: 'Commission & Payments', path: '/manager/earnings' }
      ]
    },
    { 
      icon: ShoppingCart, 
      label: 'Shop Management', 
      path: '/manager/shop',
      children: [
        { icon: ShoppingCart, label: 'Shop Dashboard', path: '/manager/shop' },
        { icon: Package, label: 'Product Catalog', path: '/manager/inventory' },
        { icon: ShoppingBag, label: 'Customer Orders', path: '/manager/orders' },
        { icon: Users, label: 'Customers', path: '/manager/customers' },
        { icon: Activity, label: 'Offers', path: '/manager/offers' },
        { icon: Activity, label: 'Logistics', path: '/manager/logistics' },
        { icon: Settings, label: 'Shop Settings', path: '/manager/settings' },
      ]
    },
    { icon: ClipboardList, label: 'Farmer Logs', path: '/manager/logs' },
    {
      icon: Key,
      label: 'License Key',
      path: '/manager/keys',
      children: [
        { icon: Activity, label: 'Key management', path: '/manager/keys' }
      ]
    },
    { icon: Activity, label: 'Field Operations', path: '/manager/operations' },
    { icon: Settings, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div className="fixed inset-0 bg-black/40 z-[45] backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      {/* Sidebar for Manager */}
      <aside className={`fixed inset-y-0 left-0 bg-[#0F172A] text-slate-300 flex flex-col z-50 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white truncate px-2">Manager Hub</h1>
            <Button variant="ghost" size="icon" className="lg:hidden text-slate-400" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </Button>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 px-2">Field Support Suite</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedMenus.includes(item.label);
            const isActive = location.pathname === item.path || (hasChildren && item.children?.some(child => location.pathname === child.path));

            return (
              <div key={item.label} className="space-y-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                      isActive && !isExpanded
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={20} />
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )}
                
                {hasChildren && isExpanded && (
                  <div className="pl-6 space-y-1 border-l border-slate-700 ml-6">
                    {item.children?.map((sub) => (
                      <Link
                        key={sub.label}
                        to={sub.path}
                        onClick={() => {
                          if (window.innerWidth < 1024) setIsSidebarOpen(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                          location.pathname === sub.path
                            ? 'text-white font-bold bg-slate-800/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                        }`}
                      >
                        <sub.icon size={16} />
                        <span>{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
            onClick={() => signOut()}
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} className="text-slate-600" />
            </Button>
            <h2 className="font-bold text-slate-800 hidden sm:block">Welcome, {profile?.name}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900">Regional Manager</p>
              <p className="text-[10px] text-slate-400 uppercase">{profile?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {profile?.name?.[0]}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
