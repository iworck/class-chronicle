import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'admin' | 'diretor' | 'gerente' | 'coordenador' | 'professor' | 'aluno';

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'ATIVO' | 'INATIVO';
  institution_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isStaff: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile/roles fetch with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId: string) {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile({
          id: profileData.id,
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          status: profileData.status as 'ATIVO' | 'INATIVO',
          institution_id: profileData.institution_id || null,
        });
      }

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesData) {
        const fetchedRoles = rolesData.map(r => r.role as AppRole);
        setRoles(fetchedRoles);
        // Set activeRole to first role by priority if not already set
        setActiveRole(prev => {
          if (prev && fetchedRoles.includes(prev)) return prev;
          const priority: AppRole[] = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];
          return priority.find(r => fetchedRoles.includes(r)) ?? fetchedRoles[0] ?? null;
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  }

  async function signUp(email: string, password: string, name: string) {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  }

  function hasRole(role: AppRole) {
    // When activeRole is set, only report that single role as active
    if (activeRole) return activeRole === role;
    return roles.includes(role);
  }

  function isStaff() {
    return roles.length > 0;
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      activeRole,
      setActiveRole,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      isStaff,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
