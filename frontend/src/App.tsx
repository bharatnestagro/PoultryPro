import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Orders from './pages/Orders';
import AdminPanel from './pages/AdminPanel';
import AdminLayout from './components/AdminLayout';
import AdminLearningVideos from './pages/AdminLearningVideos';
import AdminFarmers from './pages/AdminFarmers';
import FarmerDetails from './pages/FarmerDetails';
import AdminFlocks from './pages/AdminFlocks';
import AdminHealth from './pages/AdminHealth';
import AdminLogs from './pages/AdminLogs';
import AdminTransactions from './pages/AdminTransactions';
import AdminOrders from './pages/AdminOrders';
import AdminCustomers from './pages/AdminCustomers';
import AdminShop from './pages/AdminShop';
import AdminInventory from './pages/AdminInventory';
import AdminOffers from './pages/AdminOffers';
import AdminSettings from './pages/AdminSettings';
import AdminLogistics from './pages/AdminLogistics';
import AdminOperations from './pages/AdminOperations';
import AdminDeletedOrders from './pages/AdminDeletedOrders';
import AdminManagers from './pages/AdminManagers';
import AdminManagerAnalytics from './pages/AdminManagerAnalytics';
import AdminPayments from './pages/AdminPayments';
import AdminKeyPricing from './pages/AdminKeyPricing';
import AdminChallenges from './pages/AdminChallenges';
import AdminAlerts from './pages/AdminAlerts';
import AdminDeliveryPartners from './pages/AdminDeliveryPartners';
import AdminDeliverySettings from './pages/AdminDeliverySettings';
import AdminAutoAlerts from './pages/AdminAutoAlerts';
import AdminSchedule from './pages/AdminSchedule';
import ManagerLayout from './components/ManagerLayout';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerEarnings from './pages/ManagerEarnings';
import ManagerInventory from './pages/ManagerInventory';
import ManagerShop from './pages/ManagerShop';
import ManagerFlocks from './pages/ManagerFlocks';
import FlockManagement from './pages/FlockManagement';
import Transactions from './pages/Transactions';
import AddData from './pages/AddData';
import KeyManagement from './pages/KeyManagement';
import Learn from './pages/Learn';
import Notifications from './pages/Notifications';
import CustomPage from './pages/CustomPage';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add" element={<AddData />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/flocks" element={<FlockManagement />} />
            <Route path="/transactions" element={<Transactions />} />
             <Route path="/profile" element={<Profile />} />
            <Route path="/page/:slug" element={<CustomPage />} />
           </Route>

          {/* Admin Suite Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminPanel />} />
            <Route path="farmers" element={<AdminFarmers />} />
            <Route path="farmers/:id" element={<FarmerDetails />} />
            <Route path="flocks" element={<AdminFlocks />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/deleted" element={<AdminDeletedOrders />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="shop" element={<AdminShop />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="offers" element={<AdminOffers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="logistics" element={<AdminLogistics />} />
            <Route path="operations" element={<AdminOperations />} />
            <Route path="manager-analytics" element={<AdminManagerAnalytics />} />
            <Route path="managers" element={<AdminManagers />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="alerts" element={<AdminAlerts />} />
            <Route path="auto-alerts" element={<AdminAutoAlerts />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="learning-videos" element={<AdminLearningVideos />} />
            <Route path="keys" element={<KeyManagement />} />
            <Route path="keys/pricing" element={<AdminKeyPricing />} />
            <Route path="challenges" element={<AdminChallenges />} />
            <Route path="delivery/partners" element={<AdminDeliveryPartners />} />
            <Route path="delivery/settings" element={<AdminDeliverySettings />} />
          </Route>

          {/* Manager Suite Routes */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<ManagerDashboard />} />
            <Route path="farmers" element={<AdminFarmers />} />
            <Route path="farmers/:id" element={<FarmerDetails />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="operations" element={<AdminOperations />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="shop" element={<ManagerShop />} />
            <Route path="inventory" element={<ManagerShop />} />
            <Route path="farmer-inventory" element={<ManagerInventory />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="offers" element={<AdminOffers />} />
            <Route path="logistics" element={<AdminLogistics />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="flocks" element={<ManagerFlocks />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="earnings" element={<ManagerEarnings />} />
            <Route path="keys" element={<KeyManagement />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </Router>
    </AuthProvider>
  );
}
