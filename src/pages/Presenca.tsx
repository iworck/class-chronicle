import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  Trash2
} from 'lucide-react';
import { z } from 'zod';

const attendanceSchema = z.object({
  enrollment: z.string().trim().min(1, 'Matrícula é obrigatória').max(30, 'Matrícula muito longa'),
  entryCode: z.string().trim().min(1, 'Código de entrada é obrigatório').max(10, 'Código inválido'),
});

type Step = 'data' | 'geo' | 'selfie' | 'signature' | 'confirm' | 'success';

interface FormData {
  enrollment: string;
  entryCode: string;
  selfieBlob: Blob | null;
  signatureBlob: Blob | null;
  geoLat: number | null;
  geoLng: number | null;
  geoOk: boolean | null;
}

const Presenca = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const sessionToken = searchParams.get('s');
  const [step, setStep] = useState<Step>('data');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [protocol, setProtocol] = useState<string>('');
  
  const [formData, setFormData] = useState<FormData>({
    enrollment: '',
    entryCode: '',
    selfieBlob: null,
    signatureBlob: null,
    geoLat: null,
    geoLng: null,
    geoOk: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch session info if token provided
  useEffect(() => {
    if (sessionToken) {
      fetchSessionInfo();
    }
  }, [sessionToken]);

  async function fetchSessionInfo() {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        classes (code, period),
        subjects (name, code)
      `)
      .eq('public_token', sessionToken)
      .eq('status', 'ABERTA')
      .maybeSingle();

    if (data) {
      setSessionInfo(data);
    }
  }

  const validateData = () => {
    try {
      attendanceSchema.parse({
        enrollment: formData.enrollment,
        entryCode: formData.entryCode,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleDataSubmit = () => {
    if (!validateData()) return;
    
    if (sessionInfo?.require_geo) {
      setStep('geo');
    } else {
      setStep('selfie');
    }
  };

  const handleGeoCapture = () => {
    setLoading(true);
    
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocalização não suportada',
        description: 'Seu navegador não suporta geolocalização.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Calculate distance from session location
        if (sessionInfo?.geo_lat && sessionInfo?.geo_lng) {
          const distance = calculateDistance(
            latitude, 
            longitude, 
            parseFloat(sessionInfo.geo_lat), 
            parseFloat(sessionInfo.geo_lng)
          );
          const isWithinRadius = distance <= (sessionInfo.geo_radius_m || 100);
          
          setFormData(prev => ({
            ...prev,
            geoLat: latitude,
            geoLng: longitude,
            geoOk: isWithinRadius,
          }));

          if (!isWithinRadius) {
            toast({
              title: 'Fora da área permitida',
              description: `Você está a ${Math.round(distance)}m do local da aula.`,
              variant: 'destructive',
            });
          }
        } else {
          setFormData(prev => ({
            ...prev,
            geoLat: latitude,
            geoLng: longitude,
            geoOk: true,
          }));
        }
        
        setLoading(false);
        setStep('selfie');
      },
      (error) => {
        toast({
          title: 'Erro ao obter localização',
          description: 'Permita o acesso à localização e tente novamente.',
          variant: 'destructive',
        });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    if (!formData.selfieBlob || !formData.signatureBlob) {
      toast({
        title: 'Dados incompletos',
        description: 'Capture a selfie e assinatura para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // For demo purposes, show success
      // In production, this would upload files and create record
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const generatedProtocol = `FREQ-${Date.now().toString(36).toUpperCase()}`;
      setProtocol(generatedProtocol);
      setStep('success');
      
      toast({
        title: 'Presença registrada!',
        description: 'Seu registro foi salvo com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao registrar',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
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

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto px-4 py-6">
          {step === 'data' && (
            <DataStep 
              formData={formData}
              errors={errors}
              sessionInfo={sessionInfo}
              onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
              onSubmit={handleDataSubmit}
            />
          )}

          {step === 'geo' && (
            <GeoStep 
              loading={loading}
              formData={formData}
              onCapture={handleGeoCapture}
              onSkip={() => setStep('selfie')}
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
            />
          )}

          {step === 'confirm' && (
            <ConfirmStep 
              formData={formData}
              sessionInfo={sessionInfo}
              loading={loading}
              onSubmit={handleSubmit}
              onBack={() => setStep('signature')}
            />
          )}

          {step === 'success' && (
            <SuccessStep protocol={protocol} />
          )}
        </div>
      </main>

      {/* Consent notice */}
      {step !== 'success' && (
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

// Step components
function StepIndicator({ 
  number, 
  label, 
  active, 
  completed 
}: { 
  number: number; 
  label: string; 
  active: boolean; 
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className={`
        w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
        ${completed ? 'bg-success text-success-foreground' : 
          active ? 'bg-primary text-primary-foreground' : 
          'bg-muted text-muted-foreground'}
      `}>
        {completed ? <Check className="w-3 h-3" /> : number}
      </div>
      <span className={`text-xs hidden sm:inline ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
      {number < 5 && <div className="flex-1 h-px bg-border" />}
    </div>
  );
}

function DataStep({ 
  formData, 
  errors, 
  sessionInfo,
  onChange, 
  onSubmit 
}: { 
  formData: FormData;
  errors: Record<string, string>;
  sessionInfo: any;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Seus Dados
        </h2>
        <p className="text-muted-foreground">
          Informe sua matrícula e o código fornecido pelo professor.
        </p>
      </div>

      {sessionInfo && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-primary">Aula Identificada</p>
          <p className="text-foreground">{sessionInfo.subjects?.name}</p>
          <p className="text-sm text-muted-foreground">
            Turma {sessionInfo.classes?.code} - {sessionInfo.classes?.period}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="enrollment">Matrícula</Label>
          <Input
            id="enrollment"
            placeholder="Digite sua matrícula"
            className="input-mobile"
            value={formData.enrollment}
            onChange={(e) => onChange('enrollment', e.target.value)}
          />
          {errors.enrollment && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.enrollment}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="entryCode">Código de Entrada</Label>
          <Input
            id="entryCode"
            placeholder="Ex: ABC123"
            className="input-mobile uppercase"
            value={formData.entryCode}
            onChange={(e) => onChange('entryCode', e.target.value.toUpperCase())}
          />
          {errors.entryCode && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.entryCode}
            </p>
          )}
        </div>
      </div>

      <Button size="xl" className="w-full" onClick={onSubmit}>
        Continuar
      </Button>
    </div>
  );
}

function GeoStep({ 
  loading, 
  formData,
  onCapture, 
  onSkip 
}: { 
  loading: boolean;
  formData: FormData;
  onCapture: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Verificar Localização
        </h2>
        <p className="text-muted-foreground">
          Esta aula exige verificação de localização. Permita o acesso ao GPS.
        </p>
      </div>

      {formData.geoLat && formData.geoOk === false && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="font-medium text-destructive">Você está fora da área permitida</p>
          <p className="text-sm text-muted-foreground">
            Aproxime-se do local da aula para registrar presença.
          </p>
        </div>
      )}

      <Button 
        size="xl" 
        className="w-full" 
        onClick={onCapture}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Obtendo localização...
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            Capturar Localização
          </>
        )}
      </Button>
    </div>
  );
}

function SelfieStep({ 
  formData, 
  onCapture, 
  onBack 
}: { 
  formData: FormData;
  onCapture: (blob: Blob) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setCaptured(canvas.toDataURL('image/jpeg', 0.8));
    }
  };

  const confirmPhoto = () => {
    if (!canvasRef.current) return;
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        // Stop camera
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        onCapture(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  const retakePhoto = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Tire uma Selfie
        </h2>
        <p className="text-muted-foreground">
          Posicione seu rosto no centro da tela.
        </p>
      </div>

      {error ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={startCamera} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-foreground aspect-[3/4]">
          {!captured ? (
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <img 
              src={captured} 
              alt="Selfie capturada" 
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Face guide overlay */}
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
            <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button size="lg" onClick={capturePhoto} className="flex-1" disabled={!!error}>
              <Camera className="w-4 h-4 mr-2" />
              Capturar
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={retakePhoto} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tirar Outra
            </Button>
            <Button size="lg" onClick={confirmPhoto} className="flex-1" variant="success">
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SignatureStep({ 
  formData, 
  onCapture, 
  onBack 
}: { 
  formData: FormData;
  onCapture: (blob: Blob) => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = 'hsl(200, 50%, 10%)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoords = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(blob);
      }
    }, 'image/png');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Assinatura Digital
        </h2>
        <p className="text-muted-foreground">
          Desenhe sua assinatura no campo abaixo.
        </p>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="signature-canvas w-full h-48"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground">
              <PenTool className="w-5 h-5" />
              <span>Assine aqui</span>
            </div>
          </div>
        )}

        {hasDrawn && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-2 right-2"
            onClick={clearSignature}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button 
          size="lg" 
          onClick={confirmSignature} 
          className="flex-1"
          disabled={!hasDrawn}
        >
          <Check className="w-4 h-4 mr-2" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}

function ConfirmStep({ 
  formData, 
  sessionInfo,
  loading, 
  onSubmit, 
  onBack 
}: { 
  formData: FormData;
  sessionInfo: any;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const selfieUrl = formData.selfieBlob ? URL.createObjectURL(formData.selfieBlob) : null;
  const signatureUrl = formData.signatureBlob ? URL.createObjectURL(formData.signatureBlob) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Confirmar Dados
        </h2>
        <p className="text-muted-foreground">
          Verifique as informações antes de enviar.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Matrícula</p>
          <p className="font-medium text-foreground">{formData.enrollment}</p>
        </div>

        {sessionInfo && (
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Aula</p>
            <p className="font-medium text-foreground">{sessionInfo.subjects?.name}</p>
            <p className="text-sm text-muted-foreground">
              Turma {sessionInfo.classes?.code}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {selfieUrl && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Selfie</p>
              <img 
                src={selfieUrl} 
                alt="Selfie" 
                className="w-full aspect-[3/4] object-cover rounded-xl"
              />
            </div>
          )}
          {signatureUrl && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Assinatura</p>
              <div className="w-full aspect-[3/4] bg-card border border-border rounded-xl flex items-center justify-center p-2">
                <img 
                  src={signatureUrl} 
                  alt="Assinatura" 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {formData.geoLat && (
          <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
            <MapPin className={`w-5 h-5 ${formData.geoOk ? 'text-success' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Localização</p>
              <p className="font-medium text-foreground">
                {formData.geoOk ? 'Dentro da área permitida' : 'Fora da área (será auditado)'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button 
          size="lg" 
          onClick={onSubmit} 
          className="flex-1"
          variant="success"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Enviando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Confirmar Presença
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({ protocol }: { protocol: string }) {
  return (
    <div className="text-center space-y-6 animate-fade-in py-8">
      <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto">
        <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
          <Check className="w-8 h-8 text-success-foreground" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Presença Registrada!
        </h2>
        <p className="text-muted-foreground">
          Seu registro foi salvo com sucesso.
        </p>
      </div>

      <div className="bg-muted rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-2">Protocolo</p>
        <p className="text-2xl font-mono font-bold text-foreground tracking-wider">
          {protocol}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Guarde este protocolo como comprovante. Você pode fechar esta página.
      </p>
    </div>
  );
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export default Presenca;
