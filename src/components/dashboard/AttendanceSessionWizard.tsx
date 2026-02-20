import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Monitor, Wifi, Play, Loader2, Copy, CheckCircle2, Clock,
  AlertTriangle, BookOpen, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (code: string, sessionId: string, closeToken?: string) => void;
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

      // Generate close token for secure session closing
      const closeToken = generateCode(8);
      const closeTokenHash = await hashCode(closeToken);

      const payload: any = {
        class_id: classId,
        subject_id: subjectId,
        professor_user_id: professorUserId,
        entry_code_hash: hash,
        close_token_hash: closeTokenHash,
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
      // Notify dashboard (closes wizard and shows ActiveSessionPanel)
      onSuccess(code, data.id, closeToken);
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">Como será esta aula?</p>
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button
                    disabled={!modalidade}
                    onClick={() => {
                      if (modalidade === 'presencial') setStep('geolocalizacao');
                      else openSession();
                    }}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {/* STEP: geolocalizacao */}
            {step === 'geolocalizacao' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium">Deseja usar geolocalização para validar presença?</p>
                <p className="text-xs text-muted-foreground">
                  Se ativado, o sistema captura sua localização agora e aplica um raio de <strong>200 metros</strong> para validar a presença dos alunos.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <OptionCard
                    icon={MapPin}
                    label="Sim, usar Geo"
                    desc="Valida presença por GPS"
                    selected={useGeo === true}
                    onClick={() => { setUseGeo(true); captureGeo(); }}
                  />
                  <OptionCard
                    icon={Monitor}
                    label="Não usar"
                    desc="Apenas código de acesso"
                    selected={useGeo === false}
                    onClick={() => { setUseGeo(false); setGeoCoords(null); setGeoError(null); }}
                  />
                </div>

                {useGeo === true && (
                  <div className="rounded-lg border border-border p-3">
                    {geoLoading && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Capturando localização...
                      </div>
                    )}
                    {geoCoords && !geoLoading && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Localização capturada ({geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)})
                      </div>
                    )}
                    {geoError && (
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {geoError}
                        <Button size="sm" variant="outline" onClick={captureGeo} className="ml-auto text-xs h-6">
                          Tentar novamente
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep('modalidade')}>Voltar</Button>
                  <Button
                    disabled={useGeo === null || (useGeo === true && !geoCoords)}
                    onClick={openSession}
                  >
                    <Play className="w-4 h-4 mr-2" /> Abrir Chamada
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
              <div className="space-y-5">
                {/* Timer */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-success text-success gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block" />
                    Sessão aberta
                  </Badge>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4" />
                    {formatElapsed(elapsed)}
                  </div>
                </div>

                {/* Modalidade & geo */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {modalidade === 'presencial' ? '🏫 Presencial' : '💻 Online'}
                  </Badge>
                  {useGeo && geoCoords && (
                    <Badge variant="secondary">
                      <MapPin className="w-3 h-3 mr-1" /> Geo ativo · raio 200m
                    </Badge>
                  )}
                </div>

                {/* Session ID curto */}
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
                  <p className="text-muted-foreground font-medium">ID da Aula</p>
                  <p className="font-mono text-foreground text-lg font-bold tracking-widest">
                    {sessionId.replace(/-/g, '').slice(0, 6).toUpperCase()}
                  </p>
                </div>

                {/* Code */}
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 text-center">
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                    Código de Autenticação
                  </p>
                  <p className="text-5xl font-mono font-bold text-primary tracking-[0.25em] select-all">
                    {sessionCode}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Informe este código aos alunos para registrar presença
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={copyCode}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Copiado!' : 'Copiar código'}
                  </Button>
                </div>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={closeSession}
                >
                  Encerrar Chamada
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
        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center cursor-pointer',
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50'
      )}
    >
      <Icon className="w-6 h-6" />
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs opacity-70 leading-tight">{desc}</p>
    </button>
  );
}
