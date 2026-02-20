import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useStudentAuth } from '@/lib/studentAuth';
import { 
  GraduationCap, 
  Camera, 
  MapPin, 
  PenTool, 
  Check, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  LogIn,
  User,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { z } from 'zod';

/* ─── Fingerprint ─── */
async function generateDeviceFingerprint(): Promise<string> {
  const parts: string[] = [];
  parts.push(navigator.userAgent);
  parts.push(navigator.language);
  parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  parts.push(String(navigator.hardwareConcurrency || 'unknown'));
  parts.push(String((navigator as any).deviceMemory || 'unknown'));
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('fingerprint', 2, 2);
      parts.push(canvas.toDataURL().slice(-50));
    }
  } catch { /* ignore */ }
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        parts.push(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      }
    }
  } catch { /* ignore */ }
  const raw = parts.join('|||');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Hash helper (same as professor side) ─── */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ─── Validation ─── */
const anonymousSchema = z.object({
  enrollment: z.string().trim().min(1, 'Matrícula é obrigatória').max(30, 'Matrícula muito longa'),
  classCode: z.string().trim().min(1, 'Código da turma é obrigatório').max(30, 'Código muito longo'),
  entryCode: z.string().trim().min(1, 'Senha da aula é obrigatória').max(10, 'Código inválido'),
});

const loggedInSchema = z.object({
  classCode: z.string().trim().min(1, 'Código da turma é obrigatório').max(30, 'Código muito longo'),
  entryCode: z.string().trim().min(1, 'Senha da aula é obrigatória').max(10, 'Código inválido'),
});

type Step = 'mode' | 'data' | 'geo' | 'selfie' | 'signature' | 'confirm' | 'success';

interface FormData {
  enrollment: string;
  classCode: string;
  entryCode: string;
  selfieBlob: Blob | null;
  signatureBlob: Blob | null;
  geoLat: number | null;
  geoLng: number | null;
  geoOk: boolean | null;
  geoSkipped: boolean;
  selfieSkipped: boolean;
  signatureSkipped: boolean;
}

const Presenca = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, student, loading: authLoading } = useStudentAuth();
  
  const sessionToken = searchParams.get('s');
  const [step, setStep] = useState<Step>('mode');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [protocol, setProtocol] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    enrollment: '',
    classCode: '',
    entryCode: '',
    selfieBlob: null,
    signatureBlob: null,
    geoLat: null,
    geoLng: null,
    geoOk: null,
    geoSkipped: false,
    selfieSkipped: false,
    signatureSkipped: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-detect logged-in student
  useEffect(() => {
    if (!authLoading && user && student) {
      setIsLoggedIn(true);
      setFormData(prev => ({ ...prev, enrollment: student.enrollment }));
    }
  }, [authLoading, user, student]);

  // If session token provided, fetch session info and jump to data
  useEffect(() => {
    if (sessionToken) {
      fetchSessionByToken();
    }
  }, [sessionToken]);

  async function fetchSessionByToken() {
    const { data } = await supabase
      .from('attendance_sessions')
      .select('*, classes (code, period, course_id), subjects (name, code)')
      .eq('public_token', sessionToken)
      .eq('status', 'ABERTA')
      .maybeSingle();

    if (data) {
      setSessionInfo(data);
      setFormData(prev => ({ ...prev, classCode: data.classes?.code || '' }));
      setStep('data');
    }
  }

  async function fetchSessionByClassCode(classCode: string): Promise<any> {
    // Find open session by class code
    const { data: classes } = await supabase
      .from('classes')
      .select('id, code, period, course_id')
      .eq('code', classCode.trim())
      .eq('status', 'ATIVO')
      .limit(1);

    if (!classes || classes.length === 0) return null;

    const classId = classes[0].id;
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('*, subjects (name, code)')
      .eq('class_id', classId)
      .eq('status', 'ABERTA')
      .limit(1);

    if (!sessions || sessions.length === 0) return null;

    return { ...sessions[0], classes: classes[0] };
  }

  const validateData = () => {
    try {
      if (isLoggedIn) {
        loggedInSchema.parse({ classCode: formData.classCode, entryCode: formData.entryCode });
      } else {
        anonymousSchema.parse({ enrollment: formData.enrollment, classCode: formData.classCode, entryCode: formData.entryCode });
      }
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

  const handleDataSubmit = async () => {
    if (!validateData()) return;
    setLoading(true);

    try {
      // Find session if not already found
      let session = sessionInfo;
      if (!session) {
        session = await fetchSessionByClassCode(formData.classCode);
        if (!session) {
          setErrors({ classCode: 'Nenhuma aula aberta encontrada para esta turma.' });
          setLoading(false);
          return;
        }
        setSessionInfo(session);
      }

      // Validate entry code via hash
      const entryHash = await sha256(formData.entryCode.toUpperCase());
      if (entryHash !== session.entry_code_hash) {
        setErrors({ entryCode: 'Senha da aula incorreta.' });
        setLoading(false);
        return;
      }

      // Validate student enrollment exists
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, enrollment')
        .eq('enrollment', formData.enrollment.trim())
        .eq('status', 'ATIVO')
        .maybeSingle();

      if (!studentData) {
        setErrors({ enrollment: 'Matrícula não encontrada ou inativa.' });
        setLoading(false);
        return;
      }

      // Check if student is enrolled in this class
      const { data: classStudent } = await supabase
        .from('class_students')
        .select('id')
        .eq('class_id', session.class_id)
        .eq('student_id', studentData.id)
        .eq('status', 'ATIVO')
        .maybeSingle();

      if (!classStudent) {
        setErrors({ enrollment: 'Aluno não está matriculado nesta turma.' });
        setLoading(false);
        return;
      }

      // Check duplicate
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', session.id)
        .eq('student_id', studentData.id)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Presença já registrada', description: 'Você já registrou presença nesta aula.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Move to next step
      if (session.require_geo) {
        setStep('geo');
      } else {
        setStep('selfie');
      }
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao validar dados. Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGeoCapture = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      const reasons = [...reviewReasons, 'Geolocalização não suportada pelo navegador'];
      setReviewReasons(reasons);
      setFormData(prev => ({ ...prev, geoSkipped: true }));
      setLoading(false);
      setStep('selfie');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (sessionInfo?.geo_lat && sessionInfo?.geo_lng) {
          const distance = calculateDistance(latitude, longitude, parseFloat(sessionInfo.geo_lat), parseFloat(sessionInfo.geo_lng));
          const isWithinRadius = distance <= (sessionInfo.geo_radius_m || 100);
          setFormData(prev => ({ ...prev, geoLat: latitude, geoLng: longitude, geoOk: isWithinRadius }));
          if (!isWithinRadius) {
            toast({ title: 'Fora da área permitida', description: `Você está a ${Math.round(distance)}m do local.`, variant: 'destructive' });
          }
        } else {
          setFormData(prev => ({ ...prev, geoLat: latitude, geoLng: longitude, geoOk: true }));
        }
        setLoading(false);
        setStep('selfie');
      },
      () => {
        // Geo failed - flag for review instead of blocking
        const reasons = [...reviewReasons, 'Falha ao capturar geolocalização'];
        setReviewReasons(reasons);
        setFormData(prev => ({ ...prev, geoSkipped: true }));
        setLoading(false);
        setStep('selfie');
        toast({ title: 'Localização indisponível', description: 'Seguindo sem localização. O registro será enviado para revisão do professor.', variant: 'default' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelfieSkip = () => {
    setReviewReasons(prev => [...prev, 'Selfie não capturada (câmera indisponível)']);
    setFormData(prev => ({ ...prev, selfieSkipped: true }));
    setStep('signature');
  };

  const handleSignatureSkip = () => {
    setReviewReasons(prev => [...prev, 'Assinatura não capturada']);
    setFormData(prev => ({ ...prev, signatureSkipped: true }));
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const fingerprint = await generateDeviceFingerprint();
      
      // Get student ID
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('enrollment', formData.enrollment.trim())
        .eq('status', 'ATIVO')
        .maybeSingle();

      if (!studentData || !sessionInfo) {
        toast({ title: 'Erro', description: 'Dados inválidos.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Upload selfie if captured
      let selfiePath: string | null = null;
      if (formData.selfieBlob) {
        const fileName = `${sessionInfo.id}/${studentData.id}_selfie_${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from('attendance-evidence')
          .upload(fileName, formData.selfieBlob, { contentType: 'image/jpeg' });
        if (!uploadErr) selfiePath = fileName;
      }

      // Upload signature if captured
      let signaturePath: string | null = null;
      if (formData.signatureBlob) {
        const fileName = `${sessionInfo.id}/${studentData.id}_signature_${Date.now()}.png`;
        const { error: uploadErr } = await supabase.storage
          .from('attendance-evidence')
          .upload(fileName, formData.signatureBlob, { contentType: 'image/png' });
        if (!uploadErr) signaturePath = fileName;
      }

      const needsReview = reviewReasons.length > 0;
      const source = isLoggedIn ? 'AUTO_ALUNO' : 'AUTO_ALUNO';

      const { data: record, error: insertErr } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionInfo.id,
          student_id: studentData.id,
          final_status: needsReview ? 'FALTA' : 'PRESENTE',
          source,
          registered_at: new Date().toISOString(),
          selfie_path: selfiePath,
          signature_path: signaturePath,
          geo_lat: formData.geoLat,
          geo_lng: formData.geoLng,
          geo_ok: formData.geoOk,
          ip_address: null,
          user_agent: navigator.userAgent,
          device_fingerprint: fingerprint,
          needs_review: needsReview,
          review_reason: needsReview ? reviewReasons.join('; ') : null,
        } as any)
        .select('protocol')
        .single();

      if (insertErr) {
        console.error('Insert error:', insertErr);
        toast({ title: 'Erro ao registrar', description: insertErr.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      setProtocol(record?.protocol || `FREQ-${Date.now().toString(36).toUpperCase()}`);
      setStep('success');
      toast({ title: needsReview ? 'Registro enviado para revisão' : 'Presença registrada!', description: needsReview ? 'O professor validará seu registro.' : 'Seu registro foi salvo com sucesso.' });
    } catch (error) {
      console.error('Submit error:', error);
      toast({ title: 'Erro ao registrar', description: 'Tente novamente em alguns instantes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const needsReview = reviewReasons.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-foreground">Registro de Presença</h1>
              {sessionInfo && (
                <p className="text-xs text-muted-foreground">
                  {sessionInfo.subjects?.name} - Turma {sessionInfo.classes?.code}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      {step !== 'mode' && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <StepIndicator number={1} label="Dados" active={step === 'data'} completed={step !== 'data'} />
              {sessionInfo?.require_geo && (
                <StepIndicator number={2} label="Local" active={step === 'geo'} completed={['selfie', 'signature', 'confirm', 'success'].includes(step)} />
              )}
              <StepIndicator number={sessionInfo?.require_geo ? 3 : 2} label="Foto" active={step === 'selfie'} completed={['signature', 'confirm', 'success'].includes(step)} />
              <StepIndicator number={sessionInfo?.require_geo ? 4 : 3} label="Assinatura" active={step === 'signature'} completed={['confirm', 'success'].includes(step)} />
              <StepIndicator number={sessionInfo?.require_geo ? 5 : 4} label="Confirmar" active={step === 'confirm' || step === 'success'} completed={step === 'success'} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto px-4 py-6">
          {step === 'mode' && (
            <ModeStep 
              isLoggedIn={isLoggedIn}
              studentName={student?.name}
              onChooseLoggedIn={() => setStep('data')}
              onChooseAnonymous={() => { setIsLoggedIn(false); setStep('data'); }}
              onLogin={() => navigate('/aluno/login?redirect=/presenca')}
            />
          )}

          {step === 'data' && (
            <DataStep 
              formData={formData}
              errors={errors}
              sessionInfo={sessionInfo}
              isLoggedIn={isLoggedIn}
              studentName={student?.name}
              loading={loading}
              onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
              onSubmit={handleDataSubmit}
              onBack={() => setStep('mode')}
            />
          )}

          {step === 'geo' && (
            <GeoStep 
              loading={loading}
              formData={formData}
              onCapture={handleGeoCapture}
              onSkip={() => {
                setReviewReasons(prev => [...prev, 'Geolocalização pulada pelo aluno']);
                setFormData(prev => ({ ...prev, geoSkipped: true }));
                setStep('selfie');
              }}
            />
          )}

          {step === 'selfie' && (
            <SelfieStep 
              formData={formData}
              onCapture={(blob) => {
                setFormData(prev => ({ ...prev, selfieBlob: blob }));
                setStep('signature');
              }}
              onBack={() => setStep(sessionInfo?.require_geo ? 'geo' : 'data')}
              onSkip={handleSelfieSkip}
            />
          )}

          {step === 'signature' && (
            <SignatureStep 
              formData={formData}
              onCapture={(blob) => {
                setFormData(prev => ({ ...prev, signatureBlob: blob }));
                setStep('confirm');
              }}
              onBack={() => setStep('selfie')}
              onSkip={handleSignatureSkip}
            />
          )}

          {step === 'confirm' && (
            <ConfirmStep 
              formData={formData}
              sessionInfo={sessionInfo}
              loading={loading}
              needsReview={needsReview}
              reviewReasons={reviewReasons}
              onSubmit={handleSubmit}
              onBack={() => setStep('signature')}
            />
          )}

          {step === 'success' && (
            <SuccessStep protocol={protocol} needsReview={needsReview} />
          )}
        </div>
      </main>

      {/* Consent notice */}
      {step !== 'success' && step !== 'mode' && (
        <footer className="border-t border-border bg-muted/30 py-3 px-4">
          <p className="text-xs text-muted-foreground text-center max-w-lg mx-auto">
            Ao registrar presença, você concorda com a coleta de dados (foto, assinatura, localização) 
            para fins de controle de frequência acadêmica conforme a LGPD.
          </p>
        </footer>
      )}
    </div>
  );
};

/* ─── Step components ─── */

function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
        ${completed ? 'bg-success text-success-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {completed ? <Check className="w-3 h-3" /> : number}
      </div>
      <span className={`text-xs hidden sm:inline ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
      {number < 5 && <div className="flex-1 h-px bg-border" />}
    </div>
  );
}

function ModeStep({ isLoggedIn, studentName, onChooseLoggedIn, onChooseAnonymous, onLogin }: {
  isLoggedIn: boolean; studentName?: string; onChooseLoggedIn: () => void; onChooseAnonymous: () => void; onLogin: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Registro de Presença</h2>
        <p className="text-muted-foreground">Como deseja registrar sua presença?</p>
      </div>

      <div className="space-y-3">
        {isLoggedIn ? (
          <button
            onClick={onChooseLoggedIn}
            className="w-full bg-primary/5 border-2 border-primary rounded-xl p-5 text-left hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Continuar como {studentName}</p>
                <p className="text-sm text-muted-foreground">Você está logado no portal do aluno</p>
              </div>
              <Check className="w-5 h-5 text-primary" />
            </div>
          </button>
        ) : (
          <button
            onClick={onLogin}
            className="w-full bg-muted/50 border border-border rounded-xl p-5 text-left hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <LogIn className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Fazer login no portal</p>
                <p className="text-sm text-muted-foreground">Acesso automático com sua conta</p>
              </div>
            </div>
          </button>
        )}

        <button
          onClick={onChooseAnonymous}
          className="w-full bg-muted/50 border border-border rounded-xl p-5 text-left hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Sem login</p>
              <p className="text-sm text-muted-foreground">Informe matrícula, código da turma e senha</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function DataStep({ formData, errors, sessionInfo, isLoggedIn, studentName, loading, onChange, onSubmit, onBack }: {
  formData: FormData; errors: Record<string, string>; sessionInfo: any; isLoggedIn: boolean; studentName?: string; loading: boolean;
  onChange: (field: string, value: string) => void; onSubmit: () => void; onBack: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Dados da Aula</h2>
        <p className="text-muted-foreground">
          {isLoggedIn
            ? 'Informe o código da turma e a senha fornecida pelo professor.'
            : 'Informe sua matrícula, o código da turma e a senha da aula.'}
        </p>
      </div>

      {isLoggedIn && studentName && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-primary">Logado como</p>
              <p className="text-foreground font-semibold">{studentName}</p>
              <p className="text-xs text-muted-foreground">Matrícula: {formData.enrollment}</p>
            </div>
          </div>
        </div>
      )}

      {sessionInfo && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm font-medium text-primary">Aula Identificada</p>
          <p className="text-foreground">{sessionInfo.subjects?.name}</p>
          <p className="text-sm text-muted-foreground">Turma {sessionInfo.classes?.code} - {sessionInfo.classes?.period}</p>
        </div>
      )}

      <div className="space-y-4">
        {!isLoggedIn && (
          <div className="space-y-2">
            <Label htmlFor="enrollment">Matrícula</Label>
            <Input id="enrollment" placeholder="Digite sua matrícula" value={formData.enrollment}
              onChange={(e) => onChange('enrollment', e.target.value)} />
            {errors.enrollment && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.enrollment}</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="classCode">Código da Turma</Label>
          <Input id="classCode" placeholder="Ex: ADM2025A" value={formData.classCode}
            onChange={(e) => onChange('classCode', e.target.value.toUpperCase())} disabled={!!sessionInfo} />
          {errors.classCode && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.classCode}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="entryCode">Senha da Aula</Label>
          <Input id="entryCode" placeholder="Ex: ABC123" className="uppercase" value={formData.entryCode}
            onChange={(e) => onChange('entryCode', e.target.value.toUpperCase())} />
          {errors.entryCode && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-4 h-4" />{errors.entryCode}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar
        </Button>
        <Button size="lg" className="flex-1" onClick={onSubmit} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Validando...</> : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}

function GeoStep({ loading, formData, onCapture, onSkip }: { loading: boolean; formData: FormData; onCapture: () => void; onSkip: () => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Verificar Localização</h2>
        <p className="text-muted-foreground">Esta aula exige verificação de localização.</p>
      </div>

      {formData.geoLat && formData.geoOk === false && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="font-medium text-destructive">Fora da área permitida</p>
        </div>
      )}

      <Button size="xl" className="w-full" onClick={onCapture} disabled={loading}>
        {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Obtendo localização...</> : <><MapPin className="w-5 h-5" />Capturar Localização</>}
      </Button>

      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onSkip}>
        <AlertTriangle className="w-4 h-4 mr-2" />
        Não consigo capturar localização (será enviado para revisão)
      </Button>
    </div>
  );
}

function SelfieStep({ formData, onCapture, onBack, onSkip }: { formData: FormData; onCapture: (blob: Blob) => void; onBack: () => void; onSkip: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError(null);
    } catch { setError('Não foi possível acessar a câmera.'); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current, video = videoRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.drawImage(video, 0, 0); setCaptured(canvas.toDataURL('image/jpeg', 0.8)); }
  };

  const confirmPhoto = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) { stream?.getTracks().forEach(t => t.stop()); onCapture(blob); }
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Tire uma Selfie</h2>
        <p className="text-muted-foreground">Posicione seu rosto no centro da tela.</p>
      </div>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive mb-4">{error}</p>
          <div className="flex gap-3">
            <Button onClick={startCamera} variant="outline" className="flex-1"><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>
            <Button onClick={onSkip} variant="ghost" className="flex-1"><AlertTriangle className="w-4 h-4 mr-2" />Pular (revisão)</Button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-foreground aspect-[3/4]">
          {!captured ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <img src={captured} alt="Selfie capturada" className="w-full h-full object-cover" />
          )}
          {!captured && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-60 border-4 border-dashed border-primary-foreground/50 rounded-full" />
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3">
        {!captured ? (
          <>
            <Button variant="outline" size="lg" onClick={onBack} className="flex-1"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
            <Button size="lg" onClick={capturePhoto} className="flex-1" disabled={!!error}><Camera className="w-4 h-4 mr-2" />Capturar</Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={() => { setCaptured(null); startCamera(); }} className="flex-1"><RefreshCw className="w-4 h-4 mr-2" />Tirar Outra</Button>
            <Button size="lg" onClick={confirmPhoto} className="flex-1" variant="success"><Check className="w-4 h-4 mr-2" />Confirmar</Button>
          </>
        )}
      </div>
    </div>
  );
}

function SignatureStep({ formData, onCapture, onBack, onSkip }: { formData: FormData; onCapture: (blob: Blob) => void; onBack: () => void; onSkip: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = 'hsl(200, 50%, 10%)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, []);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); setHasDrawn(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return; e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y); ctx.stroke();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); setHasDrawn(false); }
  };

  const confirmSignature = () => {
    canvasRef.current?.toBlob((blob) => { if (blob) onCapture(blob); }, 'image/png');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Assinatura Digital</h2>
        <p className="text-muted-foreground">Desenhe sua assinatura no campo abaixo.</p>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} className="signature-canvas w-full h-48"
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground"><PenTool className="w-5 h-5" /><span>Assine aqui</span></div>
          </div>
        )}
        {hasDrawn && (
          <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={clearSignature}><Trash2 className="w-4 h-4 mr-1" />Limpar</Button>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
        <Button size="lg" onClick={confirmSignature} className="flex-1" disabled={!hasDrawn}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
      </div>
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onSkip}>
        <AlertTriangle className="w-4 h-4 mr-2" />Pular assinatura (será enviado para revisão)
      </Button>
    </div>
  );
}

function ConfirmStep({ formData, sessionInfo, loading, needsReview, reviewReasons, onSubmit, onBack }: {
  formData: FormData; sessionInfo: any; loading: boolean; needsReview: boolean; reviewReasons: string[];
  onSubmit: () => void; onBack: () => void;
}) {
  const selfieUrl = formData.selfieBlob ? URL.createObjectURL(formData.selfieBlob) : null;
  const signatureUrl = formData.signatureBlob ? URL.createObjectURL(formData.signatureBlob) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Confirmar Dados</h2>
        <p className="text-muted-foreground">Verifique as informações antes de enviar.</p>
      </div>

      {needsReview && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 text-sm">Registro será enviado para revisão</p>
              <ul className="text-xs text-amber-600 mt-1 list-disc list-inside">
                {reviewReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Matrícula</p>
          <p className="font-medium text-foreground">{formData.enrollment}</p>
        </div>

        {sessionInfo && (
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Aula</p>
            <p className="font-medium text-foreground">{sessionInfo.subjects?.name}</p>
            <p className="text-sm text-muted-foreground">Turma {sessionInfo.classes?.code}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {selfieUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selfie</p>
              <img src={selfieUrl} alt="Selfie" className="w-full aspect-[3/4] object-cover rounded-xl" />
            </div>
          ) : formData.selfieSkipped ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selfie</p>
              <div className="w-full aspect-[3/4] bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <div className="text-center"><AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1" /><p className="text-xs text-amber-600">Não capturada</p></div>
              </div>
            </div>
          ) : null}
          {signatureUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Assinatura</p>
              <div className="w-full aspect-[3/4] bg-card border border-border rounded-xl flex items-center justify-center p-2">
                <img src={signatureUrl} alt="Assinatura" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          ) : formData.signatureSkipped ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Assinatura</p>
              <div className="w-full aspect-[3/4] bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <div className="text-center"><AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-1" /><p className="text-xs text-amber-600">Não capturada</p></div>
              </div>
            </div>
          ) : null}
        </div>

        {formData.geoLat && (
          <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
            <MapPin className={`w-5 h-5 ${formData.geoOk ? 'text-success' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Localização</p>
              <p className="font-medium text-foreground">{formData.geoOk ? 'Dentro da área' : 'Fora da área (será auditado)'}</p>
            </div>
          </div>
        )}
        {formData.geoSkipped && (
          <div className="bg-amber-500/10 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Localização</p>
              <p className="font-medium text-amber-600">Não capturada (será revisado)</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
        <Button size="lg" onClick={onSubmit} className="flex-1" variant={needsReview ? 'default' : 'success'} disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</> : needsReview ? <><ShieldAlert className="w-4 h-4 mr-2" />Enviar para Revisão</> : <><Check className="w-4 h-4 mr-2" />Confirmar Presença</>}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({ protocol, needsReview }: { protocol: string; needsReview: boolean }) {
  return (
    <div className="text-center space-y-6 animate-fade-in py-8">
      <div className={`w-24 h-24 rounded-full ${needsReview ? 'bg-amber-500/20' : 'bg-success/20'} flex items-center justify-center mx-auto`}>
        <div className={`w-16 h-16 rounded-full ${needsReview ? 'bg-amber-500' : 'bg-success'} flex items-center justify-center`}>
          {needsReview ? <ShieldAlert className="w-8 h-8 text-white" /> : <Check className="w-8 h-8 text-success-foreground" />}
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          {needsReview ? 'Enviado para Revisão' : 'Presença Registrada!'}
        </h2>
        <p className="text-muted-foreground">
          {needsReview ? 'O professor revisará seu registro e confirmará sua presença.' : 'Seu registro foi salvo com sucesso.'}
        </p>
      </div>
      <div className="bg-muted rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-2">Protocolo</p>
        <p className="text-2xl font-mono font-bold text-foreground tracking-wider">{protocol}</p>
      </div>
      <p className="text-sm text-muted-foreground">Guarde este protocolo como comprovante.</p>
    </div>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default Presenca;
