import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, LogOut } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500">Manage your account settings</p>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
            <User className="text-emerald-600" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">{profile?.name || 'User'}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        
        <Button onClick={handleSignOut} className="w-full bg-red-600 hover:bg-red-700 gap-2">
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;