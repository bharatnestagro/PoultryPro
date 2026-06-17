import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  successUser: string | null;
  triggerSuccessFlash: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [successUser, setSuccessUser] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';

  const triggerSuccessFlash = (name: string) => {
    setSuccessUser(name);
    setTimeout(() => {
      setSuccessUser(null);
    }, 2800);
  };

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ uid: user.uid, id: user.uid, ...docSnap.data() });
          } else {
            const newProfile = {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'farmer',
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, newProfile);
            setProfile({ uid: user.uid, id: user.uid, ...newProfile });
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listen error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      triggerSuccessFlash(result.user.displayName || result.user.email || "Farmer");
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isManager, signInWithGoogle, signOut, successUser, triggerSuccessFlash }}>
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F5]">
          <div className="relative flex flex-col items-center animate-in fade-in duration-300">
            <div className="text-3xl font-extrabold text-slate-800 tracking-tight flex flex-col items-center gap-2">
              <span className="text-[#22c55e] text-4xl">PoultryPro</span>
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
      ) : (
        <>
          {successUser && (
            <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#FAF9F5] select-none transition-all duration-500 animate-in fade-in">
              <div className="flex flex-col items-center max-w-md w-full px-6 text-center animate-in zoom-in-95 duration-300">
                {/* Branding header */}
                <div className="mb-10 text-3xl font-extrabold text-slate-800 tracking-tight flex flex-col items-center gap-2">
                  <span className="text-[#22c55e]">PoultryPro</span>
                  <span className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-500">
                    by <span className="text-black">Gavthi</span> <span className="text-[#22c55e]">Wallah</span>
                  </span>
                </div>

                {/* Success icon/animation circle */}
                <div className="w-24 h-24 bg-[#eefdf5] rounded-full border-2 border-[#bbf7d0] flex items-center justify-center text-[#22c55e] mb-6 shadow-xl shadow-green-150 animate-bounce">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Success text and user details */}
                <h2 className="text-4xl font-black italic uppercase tracking-tight text-slate-800 animate-pulse mb-3">
                  Successfull
                </h2>
                <div className="bg-white/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-slate-100 shadow-sm mt-2">
                  <p className="text-xs font-black italic uppercase tracking-wider text-slate-400">
                    Welcome back
                  </p>
                  <p className="text-xl font-bold text-[#22c55e] mt-1">
                    {successUser}
                  </p>
                </div>
              </div>
            </div>
          )}
          {children}
        </>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
