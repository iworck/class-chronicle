import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'ABERTO' | 'EM_ATENDIMENTO' | 'RESOLVIDO';
  response: string | null;
  responded_at: string | null;
  created_at: string;
  student: { name: string; enrollment: string } | null;
}

const STATUS_CONFIG = {
  ABERTO: { label: 'Aberto', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <AlertCircle className="w-3 h-3" /> },
  EM_ATENDIMENTO: { label: 'Em Atendimento', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: <Clock className="w-3 h-3" /> },
  RESOLVIDO: { label: 'Resolvido', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function Tickets() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [newStatus, setNewStatus] = useState<'ABERTO' | 'EM_ATENDIMENTO' | 'RESOLVIDO'>('EM_ATENDIMENTO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, subject, message, status, response, responded_at, created_at, student:students(name, enrollment)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar tickets', description: error.message, variant: 'destructive' });
    } else {
      setTickets((data as any) || []);
    }
    setLoading(false);
  }

  async function handleRespond(ticket: Ticket) {
    setSaving(true);
    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: newStatus,
        response: responseText.trim() || null,
        responded_by_user_id: user?.id,
        responded_at: new Date().toISOString(),
      })
      .eq('id', ticket.id);

    if (error) {
      toast({ title: 'Erro ao salvar resposta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ticket atualizado!', description: 'Resposta salva com sucesso.' });
      setRespondingId(null);
      setResponseText('');
      fetchTickets();
    }
    setSaving(false);
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter);

  const counts = {
    all: tickets.length,
    ABERTO: tickets.filter(t => t.status === 'ABERTO').length,
    EM_ATENDIMENTO: tickets.filter(t => t.status === 'EM_ATENDIMENTO').length,
    RESOLVIDO: tickets.filter(t => t.status === 'RESOLVIDO').length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Tickets de Suporte</h1>
        <p className="text-muted-foreground text-sm mt-1">Solicitações enviadas pelos alunos à coordenação.</p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all', label: 'Total', count: counts.all },
          { key: 'ABERTO', label: 'Abertos', count: counts.ABERTO },
          { key: 'EM_ATENDIMENTO', label: 'Em Atendimento', count: counts.EM_ATENDIMENTO },
          { key: 'RESOLVIDO', label: 'Resolvidos', count: counts.RESOLVIDO },
        ].map(item => (
          <Card
            key={item.key}
            className={`cursor-pointer transition-all border-2 ${statusFilter === item.key ? 'border-primary' : 'border-border hover:border-primary/40'}`}
            onClick={() => setStatusFilter(item.key)}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold text-foreground">{item.count}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p>Nenhum ticket encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const st = STATUS_CONFIG[ticket.status];
            const isExpanded = expandedId === ticket.id;
            const isResponding = respondingId === ticket.id;

            return (
              <Card key={ticket.id} className="border-border">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground mt-1">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        Aluno: <span className="font-medium">{ticket.student?.name || '—'}</span>
                        {ticket.student?.enrollment && <span> · {ticket.student.enrollment}</span>}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    {/* Student message */}
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem do aluno:</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                    </div>

                    {/* Existing response */}
                    {ticket.response && !isResponding && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        <p className="text-xs font-medium text-primary mb-1">Resposta da coordenação:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.response}</p>
                        {ticket.responded_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Respondido em {new Date(ticket.responded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Respond form */}
                    {isResponding ? (
                      <div className="space-y-3 border border-border rounded-lg p-4">
                        <div className="space-y-1.5">
                          <Label>Novo status</Label>
                          <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ABERTO">Aberto</SelectItem>
                              <SelectItem value="EM_ATENDIMENTO">Em Atendimento</SelectItem>
                              <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Resposta (opcional)</Label>
                          <Textarea
                            placeholder="Escreva uma resposta para o aluno..."
                            value={responseText}
                            onChange={e => setResponseText(e.target.value)}
                            rows={4}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleRespond(ticket)} disabled={saving}>
                            {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Salvando...</> : 'Salvar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRespondingId(null); setResponseText(''); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={ticket.status === 'RESOLVIDO' ? 'outline' : 'default'}
                        onClick={() => {
                          setRespondingId(ticket.id);
                          setNewStatus(ticket.status === 'ABERTO' ? 'EM_ATENDIMENTO' : ticket.status);
                          setResponseText(ticket.response || '');
                        }}
                      >
                        {ticket.response ? 'Editar Resposta' : 'Responder'}
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
