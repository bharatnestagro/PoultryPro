import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserCog, Bird, History, Calendar, 
  HeartPulse, ShoppingCart, Trash2, UserSquare2, Store, 
  Package, Tag, Truck, Settings, BarChart3, Wallet, 
  CreditCard, Bell, Zap, PlayCircle, Key, DollarSign, 
  Trophy, MapPin, Settings2, Menu, X as CloseIcon, LogOut, ChevronDown, ChevronRight, Search, Plus
} from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const { user, loading, isAdmin, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    farmers: false,
    team: false,
    notifications: false,
    shop: false,
    license: false,
    delivery: false,
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
    if (path.includes('/admin/farmers') || path.includes('/admin/flocks') || path.includes('/admin/health') || path.includes('/admin/logs') || path.includes('/admin/schedule')) {
      newOpen.farmers = true;
    }
    if (path.includes('/admin/managers') || path.includes('/admin/manager-analytics')) {
      newOpen.team = true;
    }
    if (path.includes('/admin/alerts') || path.includes('/admin/auto-alerts')) {
      newOpen.notifications = true;
    }
    if (path.includes('/admin/orders') || path.includes('/admin/customers') || path.includes('/admin/shop') || path.includes('/admin/inventory') || path.includes('/admin/offers')) {
      newOpen.shop = true;
    }
    if (path.includes('/admin/keys')) {
      newOpen.license = true;
    }
    if (path.includes('/admin/logistics') || path.includes('/admin/delivery')) {
      newOpen.delivery = true;
    }
    setOpenSections(prev => ({ ...prev, ...newOpen }));
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF9F5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-800"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const isTabActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

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

      {/* Sidebar - styled like the screenshot with Agrarian Modernist brand */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-100 flex flex-col transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'}`}>
        <div className="p-6 flex flex-col gap-1 sticky top-0 bg-white z-10 border-b border-slate-50">
          {isSidebarOpen ? (
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-black tracking-tight text-slate-800 select-none">Agrarian Modernist</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Admin Suite • Poultry Management</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-black text-center flex items-center justify-center text-sm mx-auto">
              AM
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {/* Farmer View */}
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 ${!isSidebarOpen && 'justify-center px-0'}`}
            title="Farmer View"
          >
            <LayoutDashboard size={20} />
            {isSidebarOpen && <span className="text-sm font-semibold">Farmer View</span>}
          </Link>

          {/* Analytics Dashboard - Active highlight using the deep forest green (#0B2516) */}
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              location.pathname === '/admin'
                ? 'bg-[#0B2516] text-white font-bold shadow-sm'
                : 'text-slate-500 hover:text-[#0B2516] hover:bg-slate-50'
            } ${!isSidebarOpen && 'justify-center px-0'}`}
            title="Analytics Dashboard"
          >
            <BarChart3 size={20} />
            {isSidebarOpen && <span className="text-sm font-semibold">Analytics Dashboard</span>}
          </Link>

          {isSidebarOpen ? (
            <div className="space-y-1 pt-2">
              {/* Farmers Collapsible Category */}
              <div>
                <button
                  onClick={() => toggleSection('farmers')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} />
                    <span className="text-sm font-bold">Farmers</span>
                  </div>
                  {openSections.farmers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.farmers && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Link to="/admin/farmers" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/farmers' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Farmers List</Link>
                    <Link to="/admin/flocks" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/flocks' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Farmer Flocks</Link>
                    <Link to="/admin/health" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/health' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Health & Vitals</Link>
                    <Link to="/admin/logs" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/logs' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Data Logs</Link>
                    <Link to="/admin/schedule" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/schedule' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Schedules & Milestones</Link>
                  </div>
                )}
              </div>

              {/* Team Management */}
              <div>
                <button
                  onClick={() => toggleSection('team')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <UserCog size={18} />
                    <span className="text-sm font-bold">Team Management</span>
                  </div>
                  {openSections.team ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.team && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/admin/managers" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/managers' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Regional Managers</Link>
                    <Link to="/admin/manager-analytics" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/manager-analytics' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Manager Analytics</Link>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div>
                <button
                  onClick={() => toggleSection('notifications')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Bell size={18} />
                    <span className="text-sm font-bold">Notifications</span>
                  </div>
                  {openSections.notifications ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.notifications && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/admin/alerts" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/alerts' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>System Alerts</Link>
                    <Link to="/admin/auto-alerts" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/auto-alerts' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Auto Alert Engine</Link>
                  </div>
                )}
              </div>

              {/* Shop Management */}
              <div>
                <button
                  onClick={() => toggleSection('shop')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Store size={18} />
                    <span className="text-sm font-bold">Shop Management</span>
                  </div>
                  {openSections.shop ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.shop && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/admin/orders" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/orders' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Customer Orders</Link>
                    <Link to="/admin/orders/deleted" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/orders/deleted' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Deleted Orders</Link>
                    <Link to="/admin/customers" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/customers' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Customers Database</Link>
                    <Link to="/admin/shop" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/shop' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Shop Catalog</Link>
                    <Link to="/admin/inventory" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/inventory' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Inventory Ledger</Link>
                    <Link to="/admin/offers" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/offers' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Offers & Coupons</Link>
                  </div>
                )}
              </div>

              {/* License Key */}
              <div>
                <button
                  onClick={() => toggleSection('license')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Key size={18} />
                    <span className="text-sm font-bold">License Key</span>
                  </div>
                  {openSections.license ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.license && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/admin/keys" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/keys' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Keys Catalog</Link>
                    <Link to="/admin/keys/pricing" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/keys/pricing' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Pricing Rates</Link>
                  </div>
                )}
              </div>

              {/* Delivery */}
              <div>
                <button
                  onClick={() => toggleSection('delivery')}
                  className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-[#0B2516] hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Truck size={18} />
                    <span className="text-sm font-bold">Delivery</span>
                  </div>
                  {openSections.delivery ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {openSections.delivery && (
                  <div className="pl-10 pr-2 py-1 space-y-1 animate-in fade-in duration-200">
                    <Link to="/admin/logistics" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/logistics' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Logistics Portal</Link>
                    <Link to="/admin/delivery/partners" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/delivery/partners' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Delivery Partners</Link>
                    <Link to="/admin/delivery/settings" className={`block py-1.5 text-xs font-semibold rounded-lg px-2 transition-colors ${location.pathname === '/admin/delivery/settings' ? 'text-[#0B2516] font-bold bg-slate-100' : 'text-slate-400 hover:text-[#0B2516]'}`}>Shipping Cost Config</Link>
                  </div>
                )}
              </div>

              {/* Settings */}
              <Link
                to="/admin/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  location.pathname === '/admin/settings'
                    ? 'bg-slate-100 text-[#0B2516] font-bold border-l-4 border-[#0B2516]'
                    : 'text-slate-500 hover:text-[#0B2516] hover:bg-slate-50'
                }`}
              >
                <Settings size={18} />
                <span className="text-sm font-semibold">Settings</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 pt-4">
              <Link to="/admin/farmers" title="Farmers list"><Users size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
              <Link to="/admin/managers" title="Managers list"><UserCog size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
              <Link to="/admin/alerts" title="Alerts config"><Bell size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
              <Link to="/admin/orders" title="Customer orders"><ShoppingCart size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
              <Link to="/admin/keys" title="Licenses list"><Key size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
              <Link to="/admin/logistics" title="Logistics info"><Truck size={20} className="text-slate-400 hover:text-[#0B2516]" /></Link>
            </div>
          )}
        </nav>

        {/* Add Farm Button and Logout Row at footer */}
        <div className="p-4 space-y-3 sticky bottom-0 bg-white border-t border-slate-50">
          {isSidebarOpen && (
            <Link to="/admin/farmers">
              <Button className="w-full bg-[#0B2516] hover:bg-[#123621] text-white rounded-2xl font-bold py-5 gap-2 text-xs flex items-center justify-center transition-transform hover:scale-[1.02]">
                <Plus size={16} />
                <span>Add New Farm</span>
              </Button>
            </Link>
          )}

          <button 
            className={`flex items-center gap-3 text-slate-500 hover:text-red-650 transition-colors w-full px-4 py-2 ${!isSidebarOpen && 'justify-center p-2'}`}
            onClick={() => signOut()}
          >
            <LogOut size={16} />
            {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wider">Logout Suite</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className={`flex-1 transition-all duration-300 min-h-screen flex flex-col ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        
        {/* Top Status and Dynamic Tab Headers */}
        <header className="bg-[#FAF9F5] select-none border-b border-slate-100/50 px-8 py-5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {/* Search Input Bar matching screenshot */}
            <div className="flex items-center gap-2.5 bg-[#FAF9F5] border border-slate-200 rounded-full px-4 py-2.5 w-80 shadow-inner">
              <Search className="text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search data, farmers, flocks..." 
                className="bg-transparent border-none outline-none text-xs w-full text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Horizontal navigation tabs */}
          <div className="flex items-center gap-8 border-b border-transparent h-10">
            <Link 
              to="/admin" 
              className={`text-xs uppercase tracking-widest font-bold pb-2 transition-all ${
                isTabActive('/admin') && !location.pathname.includes('operations') && !location.pathname.includes('logistics')
                  ? 'border-b-2 border-emerald-600 text-slate-900 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Analytics Dashboard
            </Link>
            <Link 
              to="/admin/operations" 
              className={`text-xs uppercase tracking-widest font-bold pb-2 transition-all ${
                location.pathname.includes('operations') 
                  ? 'border-b-2 border-emerald-600 text-slate-900 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Operations
            </Link>
            <Link 
              to="/admin/logistics" 
              className={`text-xs uppercase tracking-widest font-bold pb-2 transition-all ${
                location.pathname.includes('logistics') 
                  ? 'border-b-2 border-emerald-600 text-slate-900 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Logistics
            </Link>
          </div>

          {/* Right actions & Premium Avatar widget */}
          <div className="flex items-center gap-4">
            <div className="relative p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            </div>

            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
              <div className="text-right hidden sm:block select-none">
                <p className="text-[11px] font-extrabold text-[#0B2516] leading-none">Admin Suite</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">System Controller</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-100 shadow-inner">
                AS
              </div>
            </div>
          </div>
        </header>

        {/* Content Section */}
        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

