import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole, ImpersonatedUser } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserCheck, X } from 'lucide-react';

interface SubordinateProfile {
  userId: string;
  name: string;
  email: string | null;
  role: AppRole;
}

interface ImpersonateSubordinateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetRole: AppRole; // which role we want to emulate
  onSelect: (user: ImpersonatedUser) => void;
}

const roleLabels: Record<string, string> = {
  professor: 'Professor',
  coordenador: 'Coordenador',
  gerente: 'Gerente',
};

export function ImpersonateSubordinateModal({
  open,
  onOpenChange,
  targetRole,
  onSelect,
}: ImpersonateSubordinateModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<SubordinateProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setUsers([]);
      return;
    }
    fetchSubordinates();
  }, [open, targetRole]);

  async function fetchSubordinates() {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user_ids with the target role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', targetRole);

      if (roleError) throw roleError;
      if (!roleData || roleData.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = roleData.map(r => r.user_id);

      // Fetch their profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)
        .eq('status', 'ATIVO');

      if (profileError) throw profileError;

      setUsers(
        (profiles ?? []).map(p => ({
          userId: p.id,
          name: p.name,
          email: p.email,
          role: targetRole,
        }))
      );
    } catch (err) {
      console.error('Error fetching subordinates:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(subordinate: SubordinateProfile) {
    onSelect({
      userId: subordinate.userId,
      name: subordinate.name,
      role: subordinate.role,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Acessar como {roleLabels[targetRole] ?? targetRole}
          </DialogTitle>
          <DialogDescription>
            Selecione qual {roleLabels[targetRole] ?? targetRole} deseja emular. Os dados exibidos serão filtrados pelo contexto desse usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {users.length === 0
                ? `Nenhum ${roleLabels[targetRole] ?? targetRole} encontrado`
                : 'Nenhum resultado para a busca'}
            </p>
          ) : (
            filtered.map(u => (
              <button
                key={u.userId}
                onClick={() => handleSelect(u)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-sm font-semibold">
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">{u.name}</p>
                  {u.email && (
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {roleLabels[u.role] ?? u.role}
                </Badge>
              </button>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
