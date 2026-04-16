import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'farmer' | 'admin';
  farmName?: string;
  address?: string;
  farmArea?: number;
  birdCapacity?: number;
  farmType?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_ADMIN_EMAIL = "gavthiwallah@gmail.com";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            let data = docSnap.data() as UserProfile;
            // Force admin role for the default admin email
            if (firebaseUser.email === DEFAULT_ADMIN_EMAIL && data.role !== 'admin') {
              data.role = 'admin';
              await setDoc(docRef, { role: 'admin' }, { merge: true });
            }
            setProfile(data);
          } else {
            // If user exists in Auth but not in Firestore (e.g. first time Google Login)
            const isDefaultAdmin = firebaseUser.email === DEFAULT_ADMIN_EMAIL;
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'farmer',
            };
            
            await setDoc(docRef, {
              ...newProfile,
              createdAt: new Date().toISOString(),
            });
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const isAdmin = profile?.role === 'admin' || user?.email === DEFAULT_ADMIN_EMAIL;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInWithGoogle, isAdmin }}>
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
