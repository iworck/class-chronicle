import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudentAuth } from '@/lib/studentAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Mail, Lock, ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(190, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function AlunoLogin() {
  const navigate = useNavigate();
  const { user, student, loading: authLoading, signIn } = useStudentAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user && student) {
      navigate('/aluno/dashboard');
    }
    // If logged in but not a student, redirect to admin or show error
    if (!authLoading && user && student === null && !loading) {
      // student might still be loading, handle in the auth state
    }
  }, [user, student, authLoading, navigate, loading]);

  const validateForm = () => {
    try {
      loginSchema.parse(form);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      const { error } = await signIn(form.email, form.password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: 'Email ou senha incorretos.',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        }
        return;
      }

      // After sign in, check if this user is actually a student
      const { supabase: sb } = await import('@/integrations/supabase/client');
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (!authUser) return;

      const { data: studentData } = await sb
        .from('students')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!studentData) {
        await sb.auth.signOut();
        toast({
          title: 'Acesso negado',
          description: 'Esta conta não está vinculada a nenhum aluno. Use o portal administrativo.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
      navigate('/aluno/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="font-display text-xl font-bold text-foreground block">
                FrequênciaEDU
              </span>
              <span className="text-xs text-muted-foreground">Portal do Aluno</span>
            </div>
          </div>

          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Entrar como Aluno
          </h2>
          <p className="text-muted-foreground mb-8">
            Acesse suas notas, frequências e informações acadêmicas.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-12"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-12"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>
                Suas credenciais são fornecidas pela instituição. Em caso de dúvidas, entre em contato com a secretaria.
              </span>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            É funcionário da instituição?{' '}
            <Link to="/auth" className="text-primary hover:underline font-medium">
              Acesso administrativo
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Decorative */}
      <div className="hidden lg:flex flex-1 animated-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10 text-primary-foreground" />
          </div>
          <h3 className="text-3xl font-display font-bold text-primary-foreground mb-4">
            Portal do Aluno
          </h3>
          <p className="text-primary-foreground/70">
            Acompanhe sua frequência, notas, histórico e muito mais em um só lugar.
          </p>
        </div>
        <div className="absolute top-1/4 right-10 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
