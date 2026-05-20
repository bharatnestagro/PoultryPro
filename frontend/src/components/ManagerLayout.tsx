import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, History, ShoppingCart, Bird,
  Store, Package, Tag, Truck, Settings, BarChart3, Wallet, 
  Menu, X as CloseIcon, LogOut, ChevronRight, Settings2, Calendar, Key, UserSquare2, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';

const ManagerLayout: React.FC = () => {
  const location = useLocation();
  const { user, profile, loading, isManager, isAdmin, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    farmers: false,
    shop: false,
    license: false,
  });

  const toggleSection = (name: string) => {
    setOpenSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

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

  useEffect(() => {
    const path = location.pathname;
    const newOpen: Record<string, boolean> = {};
    if (path.includes('/manager/farmers') || path.includes('/manager/logs') || path.includes('/manager/flocks') || path.includes('/manager/farmer-inventory')) {
      newOpen.farmers = true;
    }
    if (path.includes('/manager/orders') || path.includes('/manager/customers') || path.includes('/manager/shop') || path.includes('/manager/inventory') || path.includes('/manager/offers')) {
      newOpen.shop = true;
    }
    if (path.includes('/manager/keys')) {
      newOpen.license = true;
    }
    setOpenSections(prev => ({ ...prev, ...newOpen }));

    // Auto collapse sidebar on mobile when navigating
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F5]">
        <div className="relative flex flex-col items-center">
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight animate-pulse flex flex-col items-center gap-2">
            <span className="text-[#22c55e]">PoultryPro</span>
            <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
              by <span className="text-black font-extrabold text-[11px]">Gavthi</span> <span className="text-[#22c55e] font-extrabold text-[11px]">Wallah</span>
            </span>
          </div>
          <div className="mt-8 flex gap-1.5 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // Allow admins to also view manager panels
  if (!user || (!isManager && !isAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#FAF9F5]">
      {/* Mobile Toggle */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="fixed top-4 left-4 z-50 bg-white shadow-md border rounded-full lg:hidden"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
      </Button>

      {/* Sidebar with Manager Hub branding */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-100 flex flex-col transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'}`}>
        <div className="p-6 flex flex-col gap-1 sticky top-0 bg-white z-10 border-b border-slate-50">
          {isSidebarOpen ? (
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-black tracking-tight text-slate-800 select-none">Manager Hub</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Field Support Suite</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-center flex items-center justify-center text-sm mx-auto">
              MH
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {/* Back to Farmer View */}
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-slate-500 hover:text-indigo-600 hover:bg-slate-50 ${!isSidebarOpen && 'justify-center px-0'}`}
            title="Farmer View"
          >
            <LayoutDashboard size={20} />
            {isSidebarOpen && <span className="text-sm font-semibold">Farmer View</span>}
          </Link>

          {/* Active Manager Dashboard link using deep indigo color (#4F46E5) */}
          <Link
            to="/manager"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              location.pathname === '/manager'
                ? 'bg-[#4F46E5] text-white font-bold shadow-sm'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
            } ${!isSidebarOpen && 'justify-center px-0'}`}
            title="Manager Dashboard"
          >
            <BarChart3 size={20} />
            {isSidebarOpen && <span className="text-sm font-semibold">Manager Dashboard</span>}
          </Link>

          {isSidebarOpen ? (
            <div className="space-y-1 pt-2">
              {/* My Farmers Collapsible Category */}
              <div>
                <button
                  onClick={() => toggleSection('farmers')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-indigo-650 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} />
                    <span className="text-sm font-bold">My Farmers</span>
                  </div>
                  {openSections.farmers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.farmers && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Link to="/manager/farmers" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/farmers' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>My Assigned Farmers</Link>
                    <Link to="/manager/flocks" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/flocks' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>Managed Flocks</Link>
                    <Link to="/manager/farmer-inventory" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/farmer-inventory' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>Farmers Inventories</Link>
                  </div>
                )}
              </div>

              {/* Shop Management */}
              <div>
                <button
                  onClick={() => toggleSection('shop')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-indigo-650 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Store size={18} />
                    <span className="text-sm font-bold">Shop Management</span>
                  </div>
                  {openSections.shop ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.shop && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/manager/orders" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/orders' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>Customer Orders</Link>
                    <Link to="/manager/shop" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/shop' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>Supply Catalog</Link>
                  </div>
                )}
              </div>

              {/* Direct Farmer Logs */}
              <Link
                to="/manager/logs"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  location.pathname === '/manager/logs'
                    ? 'bg-slate-100 text-[#4F46E5] font-bold border-l-4 border-[#4F46E5]'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <History size={18} />
                <span className="text-sm font-semibold">Farmer Logs</span>
              </Link>

              {/* License Keys */}
              <div>
                <button
                  onClick={() => toggleSection('license')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-indigo-650 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Key size={18} />
                    <span className="text-sm font-bold">License Key</span>
                  </div>
                  {openSections.license ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.license && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/manager/keys" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/manager/keys' ? 'text-indigo-600 font-bold bg-slate-100' : 'text-slate-400 hover:text-indigo-600'}`}>Keys Database</Link>
                  </div>
                )}
              </div>

              {/* Field Operations */}
              <Link
                to="/manager/operations"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  location.pathname === '/manager/operations'
                    ? 'bg-slate-100 text-[#4F46E5] font-bold border-l-4 border-[#4F46E5]'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Settings2 size={18} />
                <span className="text-sm font-semibold">Field Operations</span>
              </Link>

              {/* Profile */}
              <Link
                to="/profile"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  location.pathname === '/profile'
                    ? 'bg-slate-100 text-[#4F46E5] font-bold border-l-4 border-[#4F46E5]'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Settings size={18} />
                <span className="text-sm font-semibold">Profile</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 pt-4">
              <Link to="/manager/farmers" title="My Assigned Farmers"><Users size={20} className="text-slate-400 hover:text-indigo-600" /></Link>
              <Link to="/manager/orders" title="Customer orders"><ShoppingCart size={20} className="text-slate-400 hover:text-indigo-600" /></Link>
              <Link to="/manager/logs" title="Data entry histories"><History size={20} className="text-slate-400 hover:text-indigo-600" /></Link>
              <Link to="/profile" title="My settings"><Settings size={20} className="text-slate-400 hover:text-indigo-600" /></Link>
            </div>
          )}
        </nav>

        {/* Sign Out on footer */}
        <div className="p-4 border-t border-slate-50 sticky bottom-0 bg-white">
          <button 
            className={`flex items-center gap-3 text-slate-500 hover:text-red-650 transition-colors w-full px-4 py-2.5 ${!isSidebarOpen && 'justify-center p-2.5'}`}
            onClick={() => signOut()}
          >
            <LogOut size={16} />
            {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className={`flex-1 transition-all duration-300 min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        
        {/* Top bar header */}
        <header className="bg-[#FAF9F5] border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <h2 className="text-slate-700 text-sm font-black tracking-tight select-none">Welcome, {profile?.name || 'GavthiWallah'}</h2>
          </div>

          <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-full border border-slate-100 shadow-sm select-none">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-black text-indigo-700 leading-none">Regional Manager</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 text-indigo-600 font-black text-xs flex items-center justify-center border border-indigo-55 shadow-inner">
              {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'G'}
            </div>
          </div>
        </header>

        {/* Subpages renderer */}
        <div className="p-8 flex-1 text-slate-900">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ManagerLayout;
