import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface StudentRecord {
  id: string;
  name: string;
  enrollment: string;
  course_id: string | null;
  status: 'ATIVO' | 'INATIVO';
  user_id: string | null;
}

interface StudentAuthContextType {
  user: User | null;
  session: Session | null;
  student: StudentRecord | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextType | undefined>(undefined);

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchStudent(session.user.id), 0);
        } else {
          setStudent(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchStudent(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchStudent(userId: string) {
    try {
      const { data } = await supabase
        .from('students')
        .select('id, name, enrollment, course_id, status, user_id')
        .eq('user_id', userId)
        .maybeSingle();
      setStudent(data as StudentRecord | null);
    } catch (error) {
      console.error('Error fetching student:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStudent(null);
  }

  return (
    <StudentAuthContext.Provider value={{ user, session, student, loading, signIn, signOut }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) throw new Error('useStudentAuth must be used within StudentAuthProvider');
  return context;
}
