import { useEffect, Suspense, useState } from 'react';
import { useNavigate, Link, useLocation, Routes, Route } from 'react-router-dom';
import ProfessorDashboard from '@/components/dashboard/ProfessorDashboard';
import { ImpersonateSubordinateModal } from '@/components/dashboard/ImpersonateSubordinateModal';
import { useAuth, AppRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar,
  CalendarCheck,
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
  ChevronDown,
  UserCog,
  RefreshCw,
} from 'lucide-react';
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
import Aulas from '@/pages/dashboard/Aulas';

// Hierarchy levels: lower index = more privilege
const ROLE_HIERARCHY: AppRole[] = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];

function roleIndex(role: AppRole | null): number {
  if (!role) return 999;
  return ROLE_HIERARCHY.indexOf(role);
}

// Returns true if activeRole can access items visible to targetRole
function canAccessRoleItems(activeRole: AppRole | null, targetRole: AppRole): boolean {
  return roleIndex(activeRole) <= roleIndex(targetRole);
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: AppRole[];
  // if set, clicking this item requires selecting a subordinate of this role first
  requiresImpersonation?: AppRole;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, roles, activeRole, setActiveRole, impersonatedUser, setImpersonatedUser, loading, signOut, hasRole, hasRoleOrAbove } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [impersonateModal, setImpersonateModal] = useState<{ open: boolean; targetRole: AppRole; pendingPath: string }>({
    open: false,
    targetRole: 'professor',
    pendingPath: '',
  });

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

  // ─── Navigation items ───────────────────────────────────────────────────────
  // "roles" here = which activeRoles can see this item natively
  // Items that need impersonation will be added separately
  const baseNavItems: NavItem[] = [
    { 
      icon: LayoutDashboard, label: 'Visão Geral', path: '/dashboard',
      roles: ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor'],
    },
    { 
      icon: Building2, label: 'Instituições', path: '/dashboard/instituicoes',
      roles: ['super_admin'],
    },
    { 
      icon: Building2, label: 'Campi', path: '/dashboard/campi',
      roles: ['super_admin', 'admin'],
    },
    { 
      icon: Building2, label: 'Unidades', path: '/dashboard/unidades',
      roles: ['super_admin', 'admin', 'diretor', 'gerente'],
    },
    { 
      icon: GraduationCap, label: 'Cursos', path: '/dashboard/cursos',
      roles: ['super_admin', 'admin', 'diretor', 'gerente'],
    },
    { 
      icon: BookOpen, label: 'Disciplinas', path: '/dashboard/disciplinas',
      roles: ['admin', 'coordenador', 'gerente', 'diretor'],
    },
    { 
      icon: GraduationCap, label: 'Matrizes', path: '/dashboard/matrizes',
      roles: ['admin', 'super_admin', 'coordenador', 'gerente', 'diretor'],
    },
    { 
      icon: Calendar, label: 'Turmas', path: '/dashboard/turmas',
      roles: ['admin', 'coordenador', 'gerente', 'diretor'],
    },
    { 
      icon: UserCheck, label: 'Alunos', path: '/dashboard/alunos',
      roles: ['admin', 'coordenador', 'gerente', 'diretor'],
    },
    { 
      icon: UserCheck, label: 'Revisão', path: '/dashboard/revisao',
      roles: ['coordenador', 'gerente', 'diretor'],
    },
    { 
      icon: FileText, label: 'Boletim', path: '/dashboard/boletim',
      roles: ['professor', 'admin', 'coordenador', 'super_admin', 'gerente', 'diretor'],
    },
    { 
      icon: FileText, label: 'Relatórios', path: '/dashboard/relatorios',
      roles: ['admin', 'diretor', 'coordenador', 'gerente'],
    },
    { 
      icon: Settings, label: 'Configurações', path: '/dashboard/configuracoes',
      roles: ['super_admin', 'admin', 'coordenador'],
    },
    { 
      icon: Users, label: 'Usuários', path: '/dashboard/usuarios',
      roles: ['super_admin', 'admin'],
    },
    { 
      icon: Shield, label: 'Permissões', path: '/dashboard/permissoes',
      roles: ['super_admin', 'admin'],
    },
  ];

  // Items that require impersonation (only shown for superior roles, not when already that role)
  const impersonationNavItems: NavItem[] = [
    {
      icon: Calendar,
      label: 'Minhas Turmas',
      path: '/dashboard/minhas-turmas',
      roles: ['professor'],
      requiresImpersonation: 'professor',
    },
    {
      icon: CalendarCheck,
      label: 'Aulas',
      path: '/dashboard/aulas',
      roles: ['professor'],
      requiresImpersonation: 'professor',
    },
  ];

  const visibleNavItems = baseNavItems.filter(item =>
    item.roles.some(role => hasRole(role as AppRole))
  );

  // For superior roles: show professor/coordenador items with impersonation gate
  const visibleImpersonationItems: NavItem[] = [];

  if (activeRole && !hasRole('professor') && canAccessRoleItems(activeRole, 'professor')) {
    // Superior roles (gerente, coordenador, diretor, admin, super_admin) see professor-specific items
    // These always require impersonation
    impersonationNavItems.forEach(item => {
      visibleImpersonationItems.push(item);
    });
  } else if (hasRole('professor')) {
    // Pure professor sees them directly
    impersonationNavItems.forEach(item => {
      visibleNavItems.push({ ...item, requiresImpersonation: undefined });
    });
  }

  // ─── Click handler for nav items that require impersonation ─────────────────
  function handleNavClick(item: NavItem, e: React.MouseEvent) {
    if (item.requiresImpersonation && !hasRole(item.requiresImpersonation)) {
      e.preventDefault();
      setImpersonateModal({ open: true, targetRole: item.requiresImpersonation, pendingPath: item.path });
    } else {
      setSidebarOpen(false);
    }
  }

  // ─── Role labels ─────────────────────────────────────────────────────────────
  const roleLabels: Record<string, string> = {
    super_admin: 'Super Administrador',
    admin: 'Administrador',
    diretor: 'Diretor',
    gerente: 'Gerente',
    coordenador: 'Coordenador',
    professor: 'Professor',
    aluno: 'Aluno',
  };

  const getRoleLabel = (role?: string | null) => {
    if (role) return roleLabels[role] ?? 'Usuário';
    const priority = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];
    const found = priority.find(r => roles.includes(r as AppRole));
    return found ? roleLabels[found] : 'Usuário';
  };

  const hasMultipleRoles = roles.length > 1;

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
        <div className="px-4 py-3 mx-4 rounded-xl bg-sidebar-accent space-y-1">
          <p className="font-medium text-sidebar-foreground truncate text-sm">
            {profile?.name || user.email}
          </p>

          {/* Role switcher */}
          {hasMultipleRoles ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-sidebar-primary hover:text-sidebar-primary/80 transition-colors group">
                  <UserCog className="w-3 h-3" />
                  <span className="font-medium">{getRoleLabel(activeRole)}</span>
                  <ChevronDown className="w-3 h-3 group-data-[state=open]:rotate-180 transition-transform" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {roles.map(role => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => {
                      setActiveRole(role);
                      navigate('/dashboard');
                    }}
                    className={cn(
                      "cursor-pointer",
                      activeRole === role && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    {activeRole === role && <span className="mr-2">✓</span>}
                    {roleLabels[role] ?? role}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <p className="text-xs text-sidebar-foreground/60">
              {getRoleLabel(activeRole)}
            </p>
          )}

          {/* Impersonation indicator */}
          {impersonatedUser && (
            <div className="flex items-center justify-between pt-1 border-t border-sidebar-primary/20">
              <div className="min-w-0">
                <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wide">Emulando</p>
                <p className="text-xs font-medium text-primary truncate">{impersonatedUser.name}</p>
              </div>
              <button
                onClick={() => setImpersonatedUser(null)}
                className="ml-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/80 shrink-0"
                title="Cancelar emulação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => handleNavClick(item, e)}
              className={cn(
                "nav-item",
                location.pathname === item.path && "active"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}

          {/* Impersonation items — shown for superior roles */}
          {visibleImpersonationItems.length > 0 && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Funções de Professor
                </p>
              </div>
              {visibleImpersonationItems.map((item) => (
                <button
                  key={item.path}
                  onClick={(e) => {
                    // Check if we already have the right impersonation active
                    if (impersonatedUser?.role === item.requiresImpersonation) {
                      navigate(item.path);
                      setSidebarOpen(false);
                    } else {
                      setImpersonateModal({
                        open: true,
                        targetRole: item.requiresImpersonation!,
                        pendingPath: item.path,
                      });
                    }
                  }}
                  className={cn(
                    "nav-item w-full",
                    location.pathname === item.path && "active"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {item.requiresImpersonation && (
                    <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1.5 border-sidebar-primary/30 text-sidebar-primary/70">
                      Prof
                    </Badge>
                  )}
                </button>
              ))}
            </>
          )}
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
                  {[...visibleNavItems, ...visibleImpersonationItems]
                    .find(item => item.path === location.pathname)?.label || 'Página'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Impersonation banner in header */}
            {impersonatedUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-warning">
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-xs font-medium hidden sm:inline">
                  Emulando: <strong>{impersonatedUser.name}</strong>
                </span>
                <button
                  onClick={() => setImpersonatedUser(null)}
                  className="hover:opacity-70 transition-opacity"
                  title="Encerrar emulação"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
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
              <Route path="aulas" element={<Aulas />} />
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

      {/* Impersonate modal */}
      <ImpersonateSubordinateModal
        open={impersonateModal.open}
        onOpenChange={(open) => setImpersonateModal(prev => ({ ...prev, open }))}
        targetRole={impersonateModal.targetRole}
        onSelect={(impersonated) => {
          setImpersonatedUser(impersonated);
          navigate(impersonateModal.pendingPath);
          setSidebarOpen(false);
        }}
      />
    </div>
  );
};

function DashboardHome() {
  const { profile, hasRole, hasRoleOrAbove } = useAuth();

  if (hasRole('professor')) {
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

      {hasRoleOrAbove('coordenador') && (
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
