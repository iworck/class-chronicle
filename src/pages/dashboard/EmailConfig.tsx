import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Mail, Loader2, Settings, BarChart3, Send } from 'lucide-react';

interface EmailSettings {
  id: string;
  institution_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  is_active: boolean;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  message_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const EmailConfig = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [form, setForm] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: 'FrequênciaEDU',
    use_tls: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testType, setTestType] = useState<'simple' | 'reset'>('simple');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [logs, setLogs] = useState<EmailLog[]>([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const institutionId = profile?.institution_id;

    const [settingsRes, logsRes] = await Promise.all([
      institutionId
        ? supabase.from('email_settings').select('*').eq('institution_id', institutionId).maybeSingle()
        : { data: null },
      supabase.from('email_message_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (settingsRes.data) {
      const s = settingsRes.data as any;
      setSettings(s);
      setForm({
        smtp_host: s.smtp_host || '',
        smtp_port: s.smtp_port || 587,
        smtp_user: s.smtp_user || '',
        smtp_password: s.smtp_password || '',
        from_email: s.from_email || '',
        from_name: s.from_name || 'FrequênciaEDU',
        use_tls: s.use_tls ?? true,
      });
    }
    setLogs((logsRes.data as any[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_password || !form.from_email) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    const institutionId = profile?.institution_id;
    if (!institutionId) {
      toast({ title: 'Usuário sem instituição vinculada', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const payload = {
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_user: form.smtp_user,
      smtp_password: form.smtp_password,
      from_email: form.from_email,
      from_name: form.from_name,
      use_tls: form.use_tls,
      updated_at: new Date().toISOString(),
    };

    if (settings) {
      const { error } = await supabase.from('email_settings').update(payload).eq('id', settings.id);
      if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      else toast({ title: 'Configurações atualizadas' });
    } else {
      const { error } = await supabase.from('email_settings').insert({
        ...payload,
        institution_id: institutionId,
      } as any);
      if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      else toast({ title: 'Configurações salvas' });
    }
    fetchAll();
    setSaving(false);
  }

  async function handleTestEmail() {
    if (!testEmail) {
      toast({ title: 'Informe um email para teste', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const isResetTest = testType === 'reset';
      const subject = isResetTest
        ? 'Teste - Redefinição de Senha - FrequênciaEDU'
        : 'Teste de Email - FrequênciaEDU';
      const body = isResetTest
        ? '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px"><h2 style="color:#0f766e">🔒 Redefinição de Senha (TESTE)</h2><p>Olá,</p><p>Sua nova senha temporária é:</p><div style="background:#f0fdfa;padding:16px;border-radius:8px;text-align:center;font-size:24px;font-weight:bold;letter-spacing:4px;color:#0f766e">T3stE@2026</div><p style="margin-top:16px;color:#64748b;font-size:13px">⚠️ Este é apenas um email de teste. Nenhuma senha foi alterada.</p><p style="color:#64748b;font-size:13px">— Equipe FrequênciaEDU</p></div>'
        : 'Este é um email de teste enviado pelo sistema FrequênciaEDU. Se você recebeu este email, a configuração SMTP está funcionando corretamente!';

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          to: testEmail,
          subject,
          body,
          message_type: isResetTest ? 'RESET_SENHA_TESTE' : 'TESTE',
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: result.error || 'Erro desconhecido ao enviar email.' });
        toast({ title: 'Erro no envio', description: result.error, variant: 'destructive' });
      } else {
        setTestResult({ success: true, message: `Email de ${isResetTest ? 'redefinição de senha (teste)' : 'teste'} enviado com sucesso para ${testEmail}!` });
        toast({ title: 'Email de teste enviado com sucesso!' });
        fetchAll();
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="w-4 h-4" />Configuração SMTP</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><BarChart3 className="w-4 h-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="bg-card rounded-xl border border-border shadow-card p-6 max-w-xl">
            <h2 className="text-lg font-semibold text-foreground mb-2">Servidor SMTP</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure o servidor SMTP para envio de emails pelo sistema (reset de senha, notificações, etc).
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Host SMTP *</Label>
                  <Input
                    value={form.smtp_host}
                    onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <Label>Porta *</Label>
                  <Input
                    type="number"
                    value={form.smtp_port}
                    onChange={e => setForm(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))}
                    placeholder="587"
                  />
                </div>
              </div>
              <div>
                <Label>Usuário SMTP *</Label>
                <Input
                  value={form.smtp_user}
                  onChange={e => setForm(p => ({ ...p, smtp_user: e.target.value }))}
                  placeholder="seu-email@gmail.com"
                />
              </div>
              <div>
                <Label>Senha SMTP *</Label>
                <Input
                  type="password"
                  value={form.smtp_password}
                  onChange={e => setForm(p => ({ ...p, smtp_password: e.target.value }))}
                  placeholder="Senha ou App Password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email remetente *</Label>
                  <Input
                    value={form.from_email}
                    onChange={e => setForm(p => ({ ...p, from_email: e.target.value }))}
                    placeholder="noreply@suainstituicao.com"
                  />
                </div>
                <div>
                  <Label>Nome remetente</Label>
                  <Input
                    value={form.from_name}
                    onChange={e => setForm(p => ({ ...p, from_name: e.target.value }))}
                    placeholder="FrequênciaEDU"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.use_tls}
                  onCheckedChange={v => setForm(p => ({ ...p, use_tls: v }))}
                />
                <Label>Usar TLS/STARTTLS</Label>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {settings ? 'Atualizar Configurações' : 'Salvar Configurações'}
              </Button>
              {settings && (
                <Badge variant="default" className="ml-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2 inline-block" />
                  Configurado
                </Badge>
              )}
            </div>

            {settings && (
              <div className="mt-8 pt-6 border-t border-border space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Testar Envio de Email</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Envie um email de teste para verificar se a configuração SMTP está funcionando corretamente.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label>Email destinatário *</Label>
                      <Input
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        placeholder="email-de-teste@exemplo.com"
                        type="email"
                      />
                    </div>
                    <div>
                      <Label>Tipo de teste</Label>
                      <select
                        value={testType}
                        onChange={e => setTestType(e.target.value as 'simple' | 'reset')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="simple">Email simples de teste</option>
                        <option value="reset">Simulação de email de redefinição de senha</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleTestEmail} disabled={testing} variant="outline" className="flex-1">
                        {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        {testType === 'reset' ? 'Enviar Teste de Reset de Senha' : 'Enviar Email de Teste'}
                      </Button>
                    </div>
                  </div>
                </div>
                {testResult && (
                  <div className={`p-4 rounded-lg border text-sm ${testResult.success ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'}`}>
                    <p className="font-semibold mb-1">{testResult.success ? '✅ Sucesso!' : '❌ Erro no envio'}</p>
                    <p>{testResult.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Histórico de Emails</h2>
              <p className="text-sm text-muted-foreground">Últimos 100 emails enviados</p>
            </div>
            {logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum email enviado ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.recipient_name || '—'}</TableCell>
                        <TableCell className="text-sm">{log.recipient_email}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.subject}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.message_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'ENVIADO' ? 'default' : 'destructive'} className="text-xs">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                          {log.error_message || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailConfig;
