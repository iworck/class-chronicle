import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, Loader2, Building,
} from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  campus_id: string;
  manager_user_id: string | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface CampusOption {
  id: string;
  name: string;
  institution_name: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string | null;
}

const Unidades = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin') || hasRole('diretor');

  const [units, setUnits] = useState<Unit[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCampusId, setFormCampusId] = useState('');
  const [formManagerId, setFormManagerId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [unitRes, campusRes, profileRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('campuses').select('id, name, institutions(name)').eq('status', 'ATIVO').order('name'),
      supabase.from('profiles').select('id, name, email').eq('status', 'ATIVO').order('name'),
    ]);

    if (unitRes.error) {
      toast({ title: 'Erro ao carregar unidades', description: unitRes.error.message, variant: 'destructive' });
    } else {
      setUnits((unitRes.data as Unit[]) || []);
    }

    const campusData = (campusRes.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      institution_name: c.institutions?.name || null,
    }));
    setCampuses(campusData);
    setProfiles((profileRes.data as Profile[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormCampusId('');
    setFormManagerId('');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditing(unit);
    setFormName(unit.name);
    setFormCampusId(unit.campus_id);
    setFormManagerId(unit.manager_user_id || '');
    setFormStatus(unit.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast({ title: 'Preencha o nome da unidade', variant: 'destructive' });
      return;
    }
    if (!formCampusId) {
      toast({ title: 'Selecione o campus', variant: 'destructive' });
      return;
    }

    const payload = {
      name: formName.trim(),
      campus_id: formCampusId,
      manager_user_id: formManagerId || null,
      status: formStatus,
    };

    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('units').update(payload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Unidade atualizada com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    } else {
      const { error } = await supabase.from('units').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Unidade criada com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase.from('units').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Unidade inativada' });
      fetchAll();
    }
  }

  const campusMap = Object.fromEntries(campuses.map(c => [c.id, c]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));

  const filtered = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (campusMap[u.campus_id]?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = units.filter(u => u.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Unidades</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as unidades vinculadas aos campi.
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{units.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{units.length - activeCount}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Nova Unidade
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhuma unidade encontrada.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira unidade
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Gerente</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((unit) => {
                const campus = campusMap[unit.campus_id];
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campus?.name || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campus?.institution_name || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {unit.manager_user_id ? (profileMap[unit.manager_user_id] || '—') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.status === 'ATIVO' ? 'default' : 'secondary'}>
                        {unit.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(unit)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {unit.status === 'ATIVO' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeactivate(unit.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: Create/Edit Unit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Campus *</Label>
              <Select value={formCampusId} onValueChange={setFormCampusId}>
                <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                <SelectContent>
                  {campuses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.institution_name ? `(${c.institution_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Unidade de Tecnologia"
              />
            </div>
            <div>
              <Label>Gerente</Label>
              <Select value={formManagerId || "none"} onValueChange={(v) => setFormManagerId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o gerente (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'ATIVO' | 'INATIVO')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">Ativo</SelectItem>
                    <SelectItem value="INATIVO">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Unidades;
