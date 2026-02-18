import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().trim().email('Email inválido').max(190, 'Email muito longo'),
});

export default function AlunoRecuperarSenha() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/aluno/redefinir-senha`,
      });

      if (resetError) {
        toast({
          title: 'Erro ao enviar email',
          description: resetError.message,
          variant: 'destructive',
        });
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link
            to="/aluno/login"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
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

          {sent ? (
            <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Email enviado!
              </h2>
              <p className="text-muted-foreground mb-6">
                Se o email <strong>{email}</strong> estiver cadastrado no sistema, você receberá um link para redefinir sua senha em breve.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Verifique também a caixa de spam.
              </p>
              <Link to="/aluno/login">
                <Button variant="outline" className="w-full">
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Recuperar Senha
              </h2>
              <p className="text-muted-foreground mb-8">
                Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                  Enviar link de recuperação
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Lembrou sua senha?{' '}
                <Link to="/aluno/login" className="text-primary hover:underline font-medium">
                  Fazer login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Right - Decorative */}
      <div className="hidden lg:flex flex-1 animated-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-primary-foreground" />
          </div>
          <h3 className="text-3xl font-display font-bold text-primary-foreground mb-4">
            Recuperação de Senha
          </h3>
          <p className="text-primary-foreground/70">
            Enviaremos um link seguro para o email cadastrado na sua conta.
          </p>
        </div>
        <div className="absolute top-1/4 right-10 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
