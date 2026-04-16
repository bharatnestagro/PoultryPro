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
import AdminFarmers from './pages/AdminFarmers';
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
import FlockManagement from './pages/FlockManagement';
import Transactions from './pages/Transactions';
import AddData from './pages/AddData';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add" element={<AddData />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/flocks" element={<FlockManagement />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Admin Suite Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminPanel />} />
            <Route path="farmers" element={<AdminFarmers />} />
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
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </Router>
    </AuthProvider>
  );
}
