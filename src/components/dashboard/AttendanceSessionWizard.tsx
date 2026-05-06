import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Monitor, Wifi, Play, Loader2, Copy, CheckCircle2, Clock,
  AlertTriangle, BookOpen, Users, XCircle, ArrowRight, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (code: string, sessionId: string) => void;
  classSubjectId: string;
  lessonEntryId?: string;
  lessonTitle: string;
  lessonNumber: number | null;
  professorUserId: string;
}

type Step = 'modalidade' | 'geolocalizacao' | 'abrindo' | 'aberta';

function generateCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem ambíguos: 0/O, 1/I
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AttendanceSessionWizard({
  open, onClose, onSuccess, classSubjectId, lessonEntryId, lessonTitle, lessonNumber, professorUserId
}: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('modalidade');
  const [modalidade, setModalidade] = useState<'presencial' | 'online' | null>(null);
  const [useGeo, setUseGeo] = useState<boolean | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Opened session data
  const [sessionCode, setSessionCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load class info
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loadingCS, setLoadingCS] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStep('modalidade');
    setModalidade(null);
    setUseGeo(null);
    setGeoCoords(null);
    setGeoError(null);
    setElapsed(0);
    setSessionCode('');
    setSessionId('');
    // Load CS info
    supabase.from('class_subjects').select('class_id, subject_id').eq('id', classSubjectId).single()
      .then(({ data }) => {
        if (data) { setClassId(data.class_id); setSubjectId(data.subject_id); }
        setLoadingCS(false);
      });
  }, [open, classSubjectId]);

  useEffect(() => {
    if (step === 'aberta') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function captureGeo() {
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      err => {
        setGeoError('Não foi possível obter a localização. Verifique as permissões do navegador.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function openSession() {
    if (!classId || !subjectId || !user) return;
    setOpening(true);
    setStep('abrindo');
    try {
      const code = generateCode(6);
      const hash = await hashCode(code);

      const payload: any = {
        class_id: classId,
        subject_id: subjectId,
        professor_user_id: professorUserId,
        entry_code_hash: hash,
        require_geo: useGeo === true && !!geoCoords,
        status: 'ABERTA',
      };
      if (lessonEntryId) {
        payload.lesson_entry_id = lessonEntryId;
      }
      if (useGeo && geoCoords) {
        payload.geo_lat = geoCoords.lat;
        payload.geo_lng = geoCoords.lng;
        payload.geo_radius_m = 200;
      }

      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      setSessionCode(code);
      setSessionId(data.id);
      onSuccess(code, data.id);
    } catch (err: any) {
      toast({ title: 'Erro ao abrir sessão', description: err.message, variant: 'destructive' });
      setStep(modalidade === 'presencial' ? (useGeo !== null ? 'geolocalizacao' : 'modalidade') : 'modalidade');
    }
    setOpening(false);
  }

  async function closeSession() {
    if (!sessionId) return;
    await supabase.from('attendance_sessions').update({ status: 'ENCERRADA', closed_at: new Date().toISOString() }).eq('id', sessionId);
    toast({ title: 'Sessão encerrada com sucesso' });
    onSuccess(sessionCode, sessionId);
  }

  function copyCode() {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Abrir Chamada
          </DialogTitle>
        </DialogHeader>

        {/* Lesson info */}
        <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border mb-2">
          <p className="text-xs text-muted-foreground">Aula</p>
          <p className="font-semibold text-foreground text-sm">
            {lessonNumber ? `Aula ${lessonNumber} — ` : ''}{lessonTitle}
          </p>
        </div>

        {loadingCS ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* STEP: modalidade */}
            {step === 'modalidade' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">1</div>
                  <p className="text-sm font-semibold text-foreground">Como será esta aula?</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <OptionCard
                    icon={Users}
                    label="Presencial"
                    desc="Alunos presentes fisicamente"
                    selected={modalidade === 'presencial'}
                    onClick={() => setModalidade('presencial')}
                  />
                  <OptionCard
                    icon={Wifi}
                    label="Online"
                    desc="Aula remota / EAD"
                    selected={modalidade === 'online'}
                    onClick={() => setModalidade('online')}
                  />
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                  <Button
                    disabled={!modalidade}
                    className="shadow-sm"
                    onClick={() => {
                      if (modalidade === 'presencial') setStep('geolocalizacao');
                      else openSession();
                    }}
                  >
                    Próximo <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: geolocalizacao */}
            {step === 'geolocalizacao' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">2</div>
                  <p className="text-sm font-semibold text-foreground">Deseja usar geolocalização?</p>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed px-1">
                  O sistema valida se os alunos estão no local através do GPS do celular (raio de 200m).
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <OptionCard
                    icon={MapPin}
                    label="Ativar GPS"
                    desc="Mais segurança"
                    selected={useGeo === true}
                    onClick={() => { setUseGeo(true); captureGeo(); }}
                  />
                  <OptionCard
                    icon={Monitor}
                    label="Apenas Código"
                    desc="Sem validação GPS"
                    selected={useGeo === false}
                    onClick={() => { setUseGeo(false); setGeoCoords(null); setGeoError(null); }}
                  />
                </div>

                {useGeo === true && (
                  <div className={cn(
                    "rounded-xl border p-3 transition-colors",
                    geoCoords ? "bg-success/5 border-success/30" : "bg-muted/50 border-border"
                  )}>
                    {geoLoading && (
                      <div className="flex items-center gap-3 text-muted-foreground text-sm py-1">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="font-medium">Capturando sua posição...</span>
                      </div>
                    )}
                    {geoCoords && !geoLoading && (
                      <div className="flex items-center gap-3 text-success text-sm py-1">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        <span className="font-semibold">Localização confirmada</span>
                        <CheckCircle2 className="w-4 h-4 ml-auto" />
                      </div>
                    )}
                    {geoError && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          {geoError}
                        </div>
                        <Button size="sm" variant="outline" onClick={captureGeo} className="w-full text-xs h-8">
                          <RotateCcw className="w-3 h-3 mr-2" /> Tentar novamente
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setStep('modalidade')}>Voltar</Button>
                  <Button
                    disabled={useGeo === null || (useGeo === true && !geoCoords)}
                    className="flex-1 font-bold shadow-md bg-primary hover:bg-primary/90"
                    onClick={openSession}
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Abrir Chamada Agora
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: abrindo */}
            {step === 'abrindo' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Abrindo sessão de chamada...</p>
              </div>
            )}

            {/* STEP: aberta */}
            {step === 'aberta' && (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                {/* Timer & Status */}
                <div className="flex items-center justify-between bg-success/5 border border-success/20 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                    </span>
                    <Badge variant="outline" className="border-none bg-transparent text-success font-bold text-sm p-0">
                      CHAMADA ATIVA
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-success font-mono font-bold">
                    <Clock className="w-4 h-4" />
                    {formatElapsed(elapsed)}
                  </div>
                </div>

                {/* Modalidade & geo */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {modalidade === 'presencial' ? '🏫 Presencial' : '💻 Online'}
                  </Badge>
                  {useGeo && geoCoords && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                      <MapPin className="w-3 h-3 mr-1" /> Geo ativo (200m)
                    </Badge>
                  )}
                </div>

                {/* Code Card */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-primary bg-primary/5 p-8 text-center shadow-lg shadow-primary/10">
                  <div className="absolute top-0 right-0 p-2">
                    <div className="w-16 h-16 bg-primary/10 rounded-full -mr-8 -mt-8 blur-2xl" />
                  </div>
                  
                  <p className="text-xs text-primary font-bold uppercase tracking-[0.2em] mb-4">
                    Código de Autenticação
                  </p>
                  
                  <div className="relative">
                    <p className="text-6xl font-mono font-black text-primary tracking-[0.2em] select-all mb-4">
                      {sessionCode}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground max-w-[200px] mx-auto leading-tight">
                    Compartilhe com os alunos para registro automático
                  </p>
                  
                  <Button
                    variant="default"
                    size="lg"
                    className="mt-6 w-full font-bold shadow-md hover:shadow-lg transition-all"
                    onClick={copyCode}
                  >
                    {copied ? (
                      <><CheckCircle2 className="w-5 h-5 mr-2" /> Copiado!</>
                    ) : (
                      <><Copy className="w-5 h-5 mr-2" /> Copiar Código</>
                    )}
                  </Button>
                </div>

                {/* Session ID - subtle */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-50">
                    ID da Sessão: {sessionId.replace(/-/g, '').slice(0, 8).toUpperCase()}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/5 hover:text-destructive font-semibold"
                  onClick={closeSession}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Encerrar Chamada
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({ icon: Icon, label, desc, selected, onClick }: {
  icon: React.ElementType; label: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all text-center cursor-pointer group relative overflow-hidden',
        selected
          ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground'
      )}
    >
      {selected && (
        <div className="absolute top-0 right-0 p-1">
          <CheckCircle2 className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "p-3 rounded-xl transition-colors",
        selected ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"
      )}>
        <Icon className={cn("w-6 h-6", selected ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
      </div>
      <p className="font-bold text-sm tracking-tight">{label}</p>
      <p className="text-xs opacity-70 leading-tight font-medium px-1">{desc}</p>
    </button>
  );
}
