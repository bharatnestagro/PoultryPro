import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Lock, PhoneCall, Key, CreditCard, User, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface LicenseGuardProps {
  children: React.ReactNode;
  mode?: 'block' | 'interaction';
}

const LicenseGuard: React.FC<LicenseGuardProps> = ({ children, mode = 'block' }) => {
  const { profile, isAdmin, isManager } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [keyPrice, setKeyPrice] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const d = await getDoc(doc(db, 'settings', 'keyPricing'));
        if (d.exists()) setKeyPrice(d.data().price);
      } catch (e) {}
    };
    if (showPopup) fetchPricing();
  }, [showPopup]);

  // Admins and Managers bypass license checks
  if (isAdmin || isManager) {
    return <>{children}</>;
  }

  const isFarmerUnlicensed = profile?.role === 'farmer' && !profile.licenseActive;

  if (isFarmerUnlicensed && mode === 'interaction') {
    return (
      <div className="relative group">
        <div onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowPopup(true);
        }} className="cursor-pointer">
          <div className="pointer-events-none opacity-80 filter blur-[0.5px]">
            {children}
          </div>
        </div>

        <Dialog open={showPopup} onOpenChange={setShowPopup}>
          <DialogContent className="rounded-3xl max-w-sm w-[95vw] p-0 overflow-hidden border-none shadow-2xl">
            <div className="bg-indigo-600 p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <Lock size={32} />
              </div>
              <DialogTitle className="text-2xl font-black mb-2">Premium Feature</DialogTitle>
              <p className="text-white/80 text-sm">Please activate your account to continue</p>
            </div>
            
            <div className="p-4 space-y-3 bg-white">
              <button 
                onClick={() => navigate('/profile?action=purchase')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 transition-colors text-left group"
              >
                <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm">
                  <CreditCard size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">Purchase License Key</p>
                  <p className="text-[10px] text-slate-500 font-medium">Instant access for ₹{keyPrice || '...'}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </button>

              <button 
                onClick={() => navigate('/profile?action=activate')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition-colors text-left group"
              >
                <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm">
                  <Key size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">Enter Activation Key</p>
                  <p className="text-[10px] text-slate-500 font-medium">Already have a code? Activate here</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
              </button>

              <button 
                onClick={() => navigate('/profile?action=manager')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 transition-colors text-left group"
              >
                <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">Contact Manager</p>
                  <p className="text-[10px] text-slate-500 font-medium">Request a key from your supervisor</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-amber-400 transition-colors" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 text-center">
              <button 
                onClick={() => setShowPopup(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Farmers must have an active license
  if (isFarmerUnlicensed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-6 animate-pulse">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Feature Restricted</h2>
        <p className="text-slate-500 max-w-md mb-8">
          This feature requires an active license key. Please activate your account or contact your Area Manager.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
          <Card className="border-none shadow-sm bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
            <CardContent className="p-6 flex flex-col items-center">
              <Key className="text-indigo-600 mb-3" size={24} />
              <h3 className="font-bold text-slate-900 mb-1">Have a Key?</h3>
              <p className="text-xs text-slate-500 mb-4 text-center">Activate it in your profile section</p>
              <Button render={<Link to="/profile?action=activate">Go to Profile</Link>} className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl" />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
            <CardContent className="p-6 flex flex-col items-center">
              <PhoneCall className="text-emerald-600 mb-3" size={24} />
              <h3 className="font-bold text-slate-900 mb-1">Need a Key?</h3>
              <p className="text-xs text-slate-500 mb-4 text-center">Contact manager for activation</p>
              <Button variant="outline" render={<Link to="/profile?action=manager">Contact Manager</Link>} className="w-full border-emerald-200 text-emerald-600 hover:bg-emerald-100 rounded-xl" />
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-12 flex items-center gap-2 text-slate-300">
          <ShieldAlert size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">PoultryPro Secure Access</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default LicenseGuard;
