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

// Represents an impersonated subordinate user
interface ImpersonatedUser {
  userId: string;
  name: string;
  role: AppRole; // the role being emulated
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
  // Impersonation
  impersonatedUser: ImpersonatedUser | null;
  setImpersonatedUser: (u: ImpersonatedUser | null) => void;
  // Effective role for data filtering: impersonated role if set, else activeRole
  effectiveRole: AppRole | null;
  // Effective userId for data filtering: impersonated user if set, else own user.id
  effectiveUserId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  // hasRoleOrAbove: checks if activeRole grants at least the same level as the given role
  hasRoleOrAbove: (role: AppRole) => boolean;
  isStaff: () => boolean;
}

const ROLE_PRIORITY: AppRole[] = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];

// Returns true if currentRole is of equal or higher privilege than targetRole
function roleCanAccess(currentRole: AppRole | null, targetRole: AppRole): boolean {
  if (!currentRole) return false;
  const currentIdx = ROLE_PRIORITY.indexOf(currentRole);
  const targetIdx = ROLE_PRIORITY.indexOf(targetRole);
  return currentIdx <= targetIdx; // lower index = higher privilege
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole = impersonatedUser?.role ?? activeRole;
  const effectiveUserId = impersonatedUser?.userId ?? user?.id ?? null;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setImpersonatedUser(null);
          setLoading(false);
        }
      }
    );

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

  // Clear impersonation when activeRole changes
  useEffect(() => {
    setImpersonatedUser(null);
  }, [activeRole]);

  async function fetchUserData(userId: string) {
    try {
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

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesData) {
        const fetchedRoles = rolesData.map(r => r.role as AppRole);
        setRoles(fetchedRoles);
        setActiveRole(prev => {
          if (prev && fetchedRoles.includes(prev)) return prev;
          return ROLE_PRIORITY.find(r => fetchedRoles.includes(r)) ?? fetchedRoles[0] ?? null;
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signUp(email: string, password: string, name: string) {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { name } },
    });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setImpersonatedUser(null);
  }

  // hasRole: checks exact activeRole (used for menu visibility)
  function hasRole(role: AppRole) {
    if (activeRole) return activeRole === role;
    return roles.includes(role);
  }

  // hasRoleOrAbove: used to show menu items for subordinate roles
  function hasRoleOrAbove(role: AppRole) {
    if (activeRole) return roleCanAccess(activeRole, role);
    // If no activeRole, use highest role the user has
    const highest = ROLE_PRIORITY.find(r => roles.includes(r)) ?? null;
    return roleCanAccess(highest, role);
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
      impersonatedUser,
      setImpersonatedUser,
      effectiveRole,
      effectiveUserId,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      hasRoleOrAbove,
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

export { ROLE_PRIORITY, roleCanAccess };
export type { AppRole, ImpersonatedUser };
