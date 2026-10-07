'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, getCurrentUser, getSession, subscribeToAuth, signIn as supabaseSignIn, signUp as supabaseSignUp, signOut as supabaseSignOut } from '@/lib/supabase';
import { User, UserRole } from '@/types';
import { cacheUserEmail } from '@/lib/branch';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, role: UserRole, userData: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { session } = await getSession();

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser(userData as User);
          cacheUserEmail((userData as any).email);
        }
      }
      setLoading(false);
    }

    loadUser();

    const unsubscribe = subscribeToAuth(async (authUser) => {
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (userData) {
          setUser(userData as User);
          cacheUserEmail((userData as any).email);
        }
      } else {
        setUser(null);
        cacheUserEmail(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabaseSignIn(email, password);
    if (error) return { error };

    if (data.user) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userData) {
        setUser(userData as User);
        cacheUserEmail((userData as any).email);
      }
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, role: UserRole, userData: any) => {
    const { data, error } = await supabaseSignUp(email, password, role, userData);
    if (error) return { error };

    if (data.user) {
      const { data: newUserData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (newUserData) {
        setUser(newUserData as User);
        cacheUserEmail((newUserData as any).email);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabaseSignOut();
    setUser(null);
    cacheUserEmail(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}