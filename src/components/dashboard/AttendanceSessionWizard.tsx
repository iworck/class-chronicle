import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Monitor, Wifi, Play, Loader2, Copy, CheckCircle2, Clock,
  AlertTriangle, BookOpen, Users, XCircle, ArrowRight, RotateCcw,
  ExternalLink, QrCode, Check, Info, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div className="px-5 py-4 rounded-2xl bg-primary/[0.03] border border-primary/10 mb-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <BookOpen className="w-12 h-12 text-primary" />
          </div>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Aula Selecionada</p>
          <p className="font-bold text-foreground text-base leading-tight">
            {lessonNumber ? `Aula ${lessonNumber} · ` : ''}{lessonTitle}
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
                {/* Step Header & Progress */}
                <div className="space-y-4 mb-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-black uppercase text-primary tracking-widest">Passo 1 de 2</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Configuração</p>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                    <div className="h-full bg-primary w-1/2 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(var(--primary),0.3)]" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm shadow-lg shadow-primary/20">1</div>
                    <p className="text-sm font-black text-foreground uppercase tracking-tight">Modalidade da Aula</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <OptionCard
                    icon={Users}
                    label="PRESENCIAL"
                    desc="Alunos presentes no campus"
                    selected={modalidade === 'presencial'}
                    onClick={() => setModalidade('presencial')}
                  />
                  <OptionCard
                    icon={Wifi}
                    label="ONLINE / EAD"
                    desc="Aula remota via Meet/Zoom"
                    selected={modalidade === 'online'}
                    onClick={() => setModalidade('online')}
                  />
                </div>
                <div className="flex justify-between gap-3 pt-4 border-t border-border/50">
                  <Button variant="ghost" onClick={onClose} className="font-bold text-muted-foreground hover:text-foreground rounded-xl px-6">CANCELAR</Button>
                  <Button
                    disabled={!modalidade}
                    className="shadow-xl font-black rounded-xl px-8 h-11 bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02]"
                    onClick={() => {
                      if (modalidade === 'presencial') setStep('geolocalizacao');
                      else openSession();
                    }}
                  >
                    PRÓXIMO <ArrowRight className="w-5 h-5 ml-2" />
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
                {/* Visual Progress or Status */}
                <div className="flex items-center justify-between bg-success/10 border-2 border-success/30 p-3 rounded-xl shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                    </span>
                    <Badge variant="outline" className="border-none bg-transparent text-success font-black text-sm p-0 tracking-tighter">
                      CHAMADA AO VIVO
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-success font-mono font-black text-lg bg-success/5 px-2 py-0.5 rounded-lg border border-success/10">
                    <Clock className="w-5 h-5" />
                    {formatElapsed(elapsed)}
                  </div>
                </div>

                {/* Legend / Status Indicators */}
                <div className="flex justify-center gap-4 py-1 border-y border-border/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Aberta</span>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Encerrada</span>
                  </div>
                </div>

                {/* Code & QR Section */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Big Code Card */}
                  <div className="relative overflow-hidden rounded-3xl border-4 border-primary bg-primary/[0.02] p-6 text-center shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01]">
                    <p className="text-[11px] text-primary font-black uppercase tracking-[0.3em] mb-4 flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Código de Acesso
                    </p>
                    
                    <div className="relative inline-block mb-4">
                      <p className="text-7xl font-mono font-black text-primary tracking-[0.15em] select-all leading-none py-2 px-4 rounded-2xl bg-primary/5 border border-primary/10">
                        {sessionCode}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="default"
                              size="lg"
                              className="w-full font-black text-lg shadow-xl hover:shadow-primary/30 transition-all bg-primary hover:bg-primary/90 h-14 rounded-2xl group"
                              onClick={copyCode}
                            >
                              {copied ? (
                                <><Check className="w-6 h-6 mr-2 animate-in zoom-in" /> Copiado!</>
                              ) : (
                                <><Copy className="w-6 h-6 mr-2 transition-transform group-hover:scale-110" /> Copiar Código</>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copia o código de 6 dígitos</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="font-bold border-primary/20 text-primary hover:bg-primary/5 h-10 rounded-xl"
                          onClick={() => {
                            const url = `${window.location.origin}/presenca?code=${sessionCode}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Link copiado!", description: "O link direto para frequência foi copiado." });
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> Copiar Link
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="font-bold border-primary/20 text-primary hover:bg-primary/5 h-10 rounded-xl"
                          onClick={() => window.open(`/presenca?code=${sessionCode}`, '_blank')}
                        >
                          <Users className="w-4 h-4 mr-2" /> Ver Alunos
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* QR Preview Section */}
                  <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl border border-border shadow-sm">
                      <QRCodeSVG 
                        value={`${window.location.origin}/presenca?code=${sessionCode}`} 
                        size={80}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-black uppercase text-foreground mb-1 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5" /> Link Direto
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-2">
                        Alunos podem ler o QR Code ou usar o link direto para marcar presença.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                        Sessão: {sessionId.replace(/-/g, '').slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground cursor-help group">
                      <HelpCircle className="w-3 h-3 transition-colors group-hover:text-primary" />
                      <span className="text-[10px] font-bold">Ajuda</span>
                    </div>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive font-black py-6 border-2 border-transparent hover:border-destructive/20 transition-all rounded-2xl"
                          onClick={() => {
                            if (window.confirm("Deseja realmente encerrar a chamada agora? Alunos não poderão mais registrar presença.")) {
                              closeSession();
                            }
                          }}
                        >
                          <XCircle className="w-5 h-5 mr-2" /> ENCERRAR CHAMADA
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bloqueia novos registros de presença</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
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
