import { useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link, useLocation, Routes, Route } from 'react-router-dom';
import ProfessorDashboard from '@/components/dashboard/ProfessorDashboard';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar,
  Settings,
  LogOut,
  Building2,
  UserCheck,
  Shield,
  FileText,
  ChevronRight,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import Disciplinas from '@/pages/dashboard/Disciplinas';
import Instituicoes from '@/pages/dashboard/Instituicoes';
import Campi from '@/pages/dashboard/Campi';
import Unidades from '@/pages/dashboard/Unidades';
import Usuarios from '@/pages/dashboard/Usuarios';
import Configuracoes from '@/pages/dashboard/Configuracoes';
import Cursos from '@/pages/dashboard/Cursos';
import Matrizes from '@/pages/dashboard/Matrizes';
import Turmas from '@/pages/dashboard/Turmas';
import Alunos from '@/pages/dashboard/Alunos';
import Boletim from '@/pages/dashboard/Boletim';
import Permissoes from '@/pages/dashboard/Permissoes';
import MinhasTurmas from '@/pages/dashboard/MinhasTurmas';
import RevisaoCoordenador from '@/pages/dashboard/RevisaoCoordenador';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, roles, loading, signOut, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Visão Geral', 
      path: '/dashboard',
      roles: ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor'] 
    },
    { 
      icon: Building2, 
      label: 'Instituições', 
      path: '/dashboard/instituicoes',
      roles: ['super_admin'] 
    },
    { 
      icon: Building2, 
      label: 'Campi', 
      path: '/dashboard/campi',
      roles: ['super_admin', 'admin'] 
    },
    { 
      icon: Building2, 
      label: 'Unidades', 
      path: '/dashboard/unidades',
      roles: ['super_admin', 'admin', 'diretor'] 
    },
    { 
      icon: GraduationCap, 
      label: 'Cursos', 
      path: '/dashboard/cursos',
      roles: ['super_admin', 'admin', 'diretor', 'gerente'] 
    },
    { 
      icon: BookOpen, 
      label: 'Disciplinas', 
      path: '/dashboard/disciplinas',
      roles: ['admin', 'coordenador'] 
    },
    { 
      icon: GraduationCap, 
      label: 'Matrizes', 
      path: '/dashboard/matrizes',
      roles: ['admin', 'super_admin', 'coordenador'] 
    },
    { 
      icon: Calendar, 
      label: 'Turmas', 
      path: '/dashboard/turmas',
      roles: ['admin', 'coordenador'] 
    },
    { 
      icon: UserCheck, 
      label: 'Alunos', 
      path: '/dashboard/alunos',
      roles: ['admin', 'coordenador', 'gerente'] 
    },
    { 
      icon: Calendar, 
      label: 'Minhas Turmas',
      path: '/dashboard/minhas-turmas',
      roles: ['professor'] 
    },
    { 
      icon: UserCheck, 
      label: 'Revisão',
      path: '/dashboard/revisao',
      roles: ['coordenador'] 
    },
    { 
      icon: FileText, 
      label: 'Boletim',
      path: '/dashboard/boletim',
      roles: ['professor', 'admin', 'coordenador', 'super_admin'] 
    },
    { 
      icon: FileText, 
      label: 'Relatórios', 
      path: '/dashboard/relatorios',
      roles: ['admin', 'diretor', 'coordenador'] 
    },
    { 
      icon: Settings, 
      label: 'Configurações', 
      path: '/dashboard/configuracoes',
      roles: ['super_admin', 'admin'] 
    },
    { 
      icon: Users, 
      label: 'Usuários', 
      path: '/dashboard/usuarios',
      roles: ['super_admin', 'admin'] 
    },
    { 
      icon: Shield, 
      label: 'Permissões', 
      path: '/dashboard/permissoes',
      roles: ['super_admin', 'admin'] 
    },
  ];

  const visibleNavItems = navItems.filter(item => 
    item.roles.some(role => hasRole(role as any))
  );

  const getRoleLabel = () => {
    if (hasRole('super_admin')) return 'Super Administrador';
    if (hasRole('admin')) return 'Administrador';
    if (hasRole('diretor')) return 'Diretor';
    if (hasRole('gerente')) return 'Gerente';
    if (hasRole('coordenador')) return 'Coordenador';
    if (hasRole('professor')) return 'Professor';
    return 'Usuário';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-sidebar-primary" />
            </div>
            <span className="font-display text-lg font-bold text-sidebar-foreground">
              FrequênciaEDU
            </span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-6 py-4 mx-4 rounded-xl bg-sidebar-accent">
          <p className="font-medium text-sidebar-foreground truncate">
            {profile?.name || user.email}
          </p>
          <p className="text-sm text-sidebar-foreground/60">
            {getRoleLabel()}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "nav-item",
                location.pathname === item.path && "active"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-4 mt-auto">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-30">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            {location.pathname !== '/dashboard' && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground">
                  {visibleNavItems.find(item => item.path === location.pathname)?.label || 'Página'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/presenca')}
            >
              Ver QR Code
            </Button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 overflow-auto">
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
            <Routes>
              <Route index element={<DashboardHome />} />
              <Route path="instituicoes" element={<Instituicoes />} />
              <Route path="campi" element={<Campi />} />
              <Route path="unidades" element={<Unidades />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="cursos" element={<Cursos />} />
              <Route path="disciplinas" element={<Disciplinas />} />
              <Route path="matrizes" element={<Matrizes />} />
              <Route path="turmas" element={<Turmas />} />
              <Route path="minhas-turmas" element={<MinhasTurmas />} />
              <Route path="revisao" element={<RevisaoCoordenador />} />
              <Route path="alunos" element={<Alunos />} />
              <Route path="boletim" element={<Boletim />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="permissoes" element={<Permissoes />} />
              <Route path="*" element={<div className="text-center py-16 text-muted-foreground">Página em construção</div>} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

function DashboardHome() {
  const { profile, hasRole } = useAuth();

  // Professor gets full real-data dashboard
  if (hasRole('professor') && !hasRole('admin') && !hasRole('coordenador') && !hasRole('super_admin')) {
    return <ProfessorDashboard />;
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Olá, {profile?.name?.split(' ')[0] || 'Usuário'}!
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao painel de controle de frequência.
        </p>
      </div>

      {(hasRole('admin') || hasRole('coordenador')) && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Gestão
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <QuickAction 
              icon={Users}
              title="Gerenciar Turmas"
              description="Criar e editar turmas e vínculos"
              href="/dashboard/turmas"
            />
            <QuickAction 
              icon={UserCheck}
              title="Revisão"
              description="Sugestões de inclusão e planos de aula"
              href="/dashboard/revisao"
            />
            <QuickAction 
              icon={UserCheck}
              title="Alunos"
              description="Cadastro e matrícula de alunos"
              href="/dashboard/alunos"
            />
            <QuickAction 
              icon={FileText}
              title="Relatórios"
              description="Estatísticas e indicadores"
              href="/dashboard/relatorios"
            />
          </div>
        </div>
      )}
    </div>
  );
}




function QuickAction({ 
  icon: Icon, 
  title, 
  description, 
  href 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  href: string;
}) {
  return (
    <Link 
      to={href}
      className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

export default Dashboard;
