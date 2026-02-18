import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  QrCode, 
  Shield, 
  Users, 
  ChevronRight, 
  MapPin,
  Camera,
  PenTool,
  BarChart3,
  Clock
} from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="animated-gradient min-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Navigation */}
        <nav className="w-full py-6 px-6 md:px-12 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-primary-foreground">
              FrequênciaEDU
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 hidden sm:inline-flex"
              onClick={() => navigate('/presenca')}
            >
              Registrar Presença
            </Button>
            <Button 
              variant="ghost" 
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/aluno/login')}
            >
              Portal do Aluno
            </Button>
            <Button 
              variant="outline" 
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/auth')}
            >
              Entrar
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-12">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
              <span className="text-sm text-primary-foreground/80">Sistema em funcionamento</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-primary-foreground mb-6 animate-fade-in">
              Controle de Frequência
              <span className="block text-primary-foreground/70">Inteligente e Seguro</span>
            </h1>
            
            <p className="text-lg md:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Sistema completo para gestão de presença acadêmica com validação por QR Code, 
              geolocalização e captura de evidências biométricas.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Button 
                variant="hero" 
                size="xl"
                onClick={() => navigate('/presenca')}
                className="w-full sm:w-auto"
              >
                <QrCode className="w-5 h-5" />
                Registrar Presença
              </Button>
              <Button 
                variant="outline" 
                size="xl"
                className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate('/auth')}
              >
                Acessar Painel
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/4 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-accent/10 rounded-full blur-3xl opacity-40" />
      </header>

      {/* Features Section */}
      <section className="py-24 px-6 md:px-12 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Funcionalidades Principais
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Todas as ferramentas necessárias para um controle de frequência 
              eficiente, seguro e à prova de fraudes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<QrCode className="w-6 h-6" />}
              title="QR Code Dinâmico"
              description="Código único gerado a cada aula com validação em tempo real."
            />
            <FeatureCard 
              icon={<MapPin className="w-6 h-6" />}
              title="Geolocalização"
              description="Verificação opcional de localização com raio configurável."
            />
            <FeatureCard 
              icon={<Camera className="w-6 h-6" />}
              title="Captura de Selfie"
              description="Registro fotográfico do aluno como evidência de presença."
            />
            <FeatureCard 
              icon={<PenTool className="w-6 h-6" />}
              title="Assinatura Digital"
              description="Coleta de assinatura em tela para validação adicional."
            />
            <FeatureCard 
              icon={<Shield className="w-6 h-6" />}
              title="Auditoria Completa"
              description="Trilha imutável de todas as alterações com justificativas."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6" />}
              title="Relatórios Avançados"
              description="Indicadores de fraude e estatísticas por turma/professor."
            />
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-24 px-6 md:px-12 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Papéis e Permissões
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sistema hierárquico com controles granulares para cada tipo de usuário.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <RoleCard 
              role="Administrador"
              color="primary"
              permissions={[
                "Cadastro de usuários",
                "Gestão de cursos",
                "Configurações globais"
              ]}
            />
            <RoleCard 
              role="Diretor"
              color="accent"
              permissions={[
                "Atribuir coordenadores",
                "Estatísticas gerais",
                "Indicadores de fraude"
              ]}
            />
            <RoleCard 
              role="Coordenador"
              color="success"
              permissions={[
                "Gestão de turmas",
                "Vincular professores",
                "Aprovar ajustes"
              ]}
            />
            <RoleCard 
              role="Professor"
              color="warning"
              permissions={[
                "Abrir/encerrar aulas",
                "Auditoria de presença",
                "Ajustes justificados"
              ]}
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6 md:px-12 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Como Funciona
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Processo simplificado para registro de presença sem necessidade de login.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <StepCard 
              number="1"
              title="Professor Abre Aula"
              description="Gera QR Code e código de entrada único."
            />
            <StepCard 
              number="2"
              title="Aluno Escaneia QR"
              description="Acessa a página de registro pelo celular."
            />
            <StepCard 
              number="3"
              title="Valida Dados"
              description="Informa matrícula, código e captura evidências."
            />
            <StepCard 
              number="4"
              title="Presença Registrada"
              description="Recebe protocolo de confirmação."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-12 animated-gradient">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-6">
            Pronto para Começar?
          </h2>
          <p className="text-lg text-primary-foreground/70 mb-10 max-w-2xl mx-auto">
            Simplifique o controle de frequência da sua instituição com 
            tecnologia moderna e segura.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => navigate('/auth')}
            >
              Começar Agora
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 bg-sidebar text-sidebar-foreground">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-sidebar-primary" />
            </div>
            <span className="font-display font-semibold">FrequênciaEDU</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/aluno/login')}
              className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors underline-offset-2 hover:underline"
            >
              Portal do Aluno
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors underline-offset-2 hover:underline"
            >
              Acesso Institucional
            </button>
          </div>
          <p className="text-sm text-sidebar-foreground/60">
            © 2026 FrequênciaEDU. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="stats-card group hover:shadow-elevated transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function RoleCard({ 
  role, 
  color, 
  permissions 
}: { 
  role: string; 
  color: 'primary' | 'accent' | 'success' | 'warning';
  permissions: string[];
}) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning-foreground border-warning/20',
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-card">
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border mb-4 ${colorClasses[color]}`}>
        <Users className="w-4 h-4" />
        {role}
      </div>
      <ul className="space-y-2">
        {permissions.map((permission, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChevronRight className="w-4 h-4 text-primary" />
            {permission}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepCard({ 
  number, 
  title, 
  description 
}: { 
  number: string; 
  title: string; 
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-display font-bold text-primary mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default Index;
