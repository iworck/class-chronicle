import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path: ['confirm'],
});

export default function AlunoRedefinirSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if this is a password recovery session
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true);
      } else {
        // Check URL hash for recovery token
        const hash = window.location.hash;
        if (hash.includes('type=recovery') || hash.includes('access_token')) {
          setValidSession(true);
        } else {
          setValidSession(false);
        }
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = passwordSchema.safeParse(form);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) {
        toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
        return;
      }
      setDone(true);
      setTimeout(() => navigate('/aluno/login'), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (validSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="font-display text-xl font-bold text-foreground block">FrequênciaEDU</span>
              <span className="text-xs text-muted-foreground">Portal do Aluno</span>
            </div>
          </div>

          {!validSession ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Link inválido ou expirado</h2>
              <p className="text-muted-foreground mb-6">Este link de recuperação não é mais válido. Solicite um novo.</p>
              <Link to="/aluno/recuperar-senha">
                <Button className="w-full">Solicitar novo link</Button>
              </Link>
            </div>
          ) : done ? (
            <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Senha redefinida!</h2>
              <p className="text-muted-foreground mb-6">Sua senha foi atualizada com sucesso. Redirecionando para o login...</p>
              <Link to="/aluno/login">
                <Button variant="outline" className="w-full">Ir para o login</Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Redefinir Senha</h2>
              <p className="text-muted-foreground mb-8">Escolha uma nova senha para sua conta.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="••••••••"
                      className="pl-12"
                      value={form.confirm}
                      onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    />
                  </div>
                  {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                  Redefinir Senha
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-1 animated-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-primary-foreground" />
          </div>
          <h3 className="text-3xl font-display font-bold text-primary-foreground mb-4">Nova Senha</h3>
          <p className="text-primary-foreground/70">Escolha uma senha segura com pelo menos 6 caracteres.</p>
        </div>
        <div className="absolute top-1/4 right-10 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
