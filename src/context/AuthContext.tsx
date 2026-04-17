import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';

export interface UserProfile {
  id: string;
  email: string;
  role: 'Root' | 'Admin' | 'User';
  status: 'Active' | 'Inactive';
  allowedAccess?: { grade: number; subjectId: string }[];
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            if (profile.status === 'Inactive') {
              alert('Your account is inactive. Please contact the administrator.');
              await signOut(auth);
              setUser(null);
              setUserProfile(null);
            } else {
              setUserProfile(profile);
            }
          } else {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const isFirstUser = usersSnapshot.empty;
            
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isFirstUser ? 'Root' : 'User',
              status: isFirstUser ? 'Active' : 'Inactive',
              allowedAccess: []
            };
            await setDoc(userDocRef, newProfile);
            
            if (newProfile.status === 'Inactive') {
              alert('Your account is pending approval. Please contact the administrator.');
              await signOut(auth);
              setUser(null);
              setUserProfile(null);
            } else {
              setUserProfile(newProfile);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

