import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, query, where, updateDoc, collection } from 'firebase/firestore';
import { addDays } from 'date-fns';
import { auth, db } from './firebase';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'farmer' | 'admin' | 'manager';
  phone?: string;
  mobile?: string;
  managerId?: string;
  managerCode?: string;
  assignedManagerId?: string;
  licenseActive?: boolean;
  licenseKey?: string;
  licenseActivatedAt?: string;
  lastBackupAt?: string;
  farmName?: string;
  address?: string;
  farmArea?: number;
  birdCapacity?: number;
  farmType?: string;
  scheduleDisplayDays?: number;
  savedAddresses?: any[];
  walletBalance?: number;
  rewardBalance?: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_UID = "OQb1NF7095Qep0tLoijpSZNZRcl2";
const ADMIN_EMAIL = "bharatnestagro@gmail.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (firebaseUser) {
        console.log("AuthContext: User detected", { 
          email: firebaseUser.email, 
          uid: firebaseUser.uid, 
          emailVerified: firebaseUser.emailVerified 
        });
        const docRef = doc(db, 'users', firebaseUser.uid);
        
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          try {
            if (docSnap.exists()) {
              let data = docSnap.data() as UserProfile;
              const isGlobalAdmin = firebaseUser.uid === ADMIN_UID || firebaseUser.email === ADMIN_EMAIL;
              
              if (isGlobalAdmin && !data.role) {
                data.role = 'admin';
                await setDoc(docRef, { role: 'admin' }, { merge: true });
              }

              // Auto-generate managerCode for managers if missing
              if (data.role === 'manager' && !data.managerCode) {
                const newCode = 'MN' + Math.random().toString(36).substring(2, 6).toUpperCase();
                await setDoc(docRef, { managerCode: newCode }, { merge: true });
                data.managerCode = newCode;
              }

              // Strict License Check for Farmers
              if (data.role === 'farmer' && data.licenseActive && data.licenseKey) {
                try {
                  const keySnap = await getDoc(doc(db, 'licenseKeys', data.licenseKey));
                  if (keySnap.exists()) {
                    const keyData = keySnap.data();
                    const isExpired = keyData.activatedAt?.toDate && keyData.validityDays && 
                      addDays(keyData.activatedAt.toDate(), keyData.validityDays) < new Date();
                    
                    if (isExpired || keyData.status === 'Expired') {
                      data.licenseActive = false;
                      // Update Firestore so the state persists
                      await setDoc(docRef, { licenseActive: false }, { merge: true });
                    }
                  } else {
                    // Key was deleted
                    data.licenseActive = false;
                    await setDoc(docRef, { licenseActive: false }, { merge: true });
                  }
                } catch (e) {
                  console.error("License validation check failed:", e);
                }
              }

              setProfile(data);
            } else {
              const isGlobalAdmin = firebaseUser.uid === ADMIN_UID || firebaseUser.email === ADMIN_EMAIL;
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: firebaseUser.email || '',
                role: isGlobalAdmin ? 'admin' : 'farmer',
              };
              
              await setDoc(docRef, {
                ...newProfile,
                createdAt: new Date().toISOString(),
              });
              setProfile(newProfile);
            }
          } catch (e) {
            console.error("Critical error in AuthContext profile sync:", e);
          } finally {
            setLoading(false);
          }
        }, (error) => {
          console.error("Error fetching user profile snapshot:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    let unsubKey: (() => void) | undefined;
    
    if (profile?.role === 'farmer' && profile.licenseActive && profile.licenseKey) {
      const q = query(collection(db, 'licenseKeys'), where('key', '==', profile.licenseKey));
      unsubKey = onSnapshot(q, async (snap) => {
        if (!snap.empty) {
          const keyData = snap.docs[0].data();
          const isExpired = keyData.activatedAt?.toDate && keyData.validityDays && 
            addDays(keyData.activatedAt.toDate(), keyData.validityDays) < new Date();
          
          if (isExpired || keyData.status === 'Expired' || keyData.status === 'Deleted') {
            await updateDoc(doc(db, 'users', profile.uid), { licenseActive: false });
          }
        } else {
          await updateDoc(doc(db, 'users', profile.uid), { licenseActive: false });
        }
      });
    }
    
    return () => unsubKey?.();
  }, [profile?.licenseKey, profile?.licenseActive, profile?.uid]);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const isAdmin = profile?.role === 'admin' || (!profile?.role && (user?.uid === ADMIN_UID || user?.email === ADMIN_EMAIL));
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || (!profile?.role && (user?.uid === ADMIN_UID || user?.email === ADMIN_EMAIL));

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, isAdmin, isManager }}>
      {children}
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
