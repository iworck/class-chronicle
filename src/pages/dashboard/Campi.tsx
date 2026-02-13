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
  Plus, Search, Pencil, Trash2, Loader2, Building2,
} from 'lucide-react';

interface Campus {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  institution_id: string;
  director_user_id: string | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface Institution {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
  email: string | null;
}

const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const Campi = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin');

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campus | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [formDirectorId, setFormDirectorId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [campusRes, instRes, profileRes] = await Promise.all([
      supabase.from('campuses').select('*').order('name'),
      supabase.from('institutions').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('profiles').select('id, name, email').eq('status', 'ATIVO').order('name'),
    ]);

    if (campusRes.error) {
      toast({ title: 'Erro ao carregar campi', description: campusRes.error.message, variant: 'destructive' });
    } else {
      setCampuses((campusRes.data as Campus[]) || []);
    }
    setInstitutions((instRes.data as Institution[]) || []);
    setProfiles((profileRes.data as Profile[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormCity('');
    setFormState('');
    setFormInstitutionId('');
    setFormDirectorId('');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(campus: Campus) {
    setEditing(campus);
    setFormName(campus.name);
    setFormCity(campus.city || '');
    setFormState(campus.state || '');
    setFormInstitutionId(campus.institution_id);
    setFormDirectorId(campus.director_user_id || '');
    setFormStatus(campus.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast({ title: 'Preencha o nome do campus', variant: 'destructive' });
      return;
    }
    if (!formInstitutionId) {
      toast({ title: 'Selecione a instituição', variant: 'destructive' });
      return;
    }

    const payload = {
      name: formName.trim(),
      city: formCity.trim() || null,
      state: formState || null,
      institution_id: formInstitutionId,
      director_user_id: formDirectorId || null,
      status: formStatus,
    };

    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('campuses').update(payload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Campus atualizado com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    } else {
      const { error } = await supabase.from('campuses').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Campus criado com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase.from('campuses').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Campus inativado' });
      fetchAll();
    }
  }

  const institutionMap = Object.fromEntries(institutions.map(i => [i.id, i.name]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));

  const filtered = campuses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (institutionMap[c.institution_id] || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = campuses.filter(c => c.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Campi</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os campi vinculados às instituições.
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{campuses.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{campuses.length - activeCount}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campus..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Novo Campus
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhum campus encontrado.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro campus
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Cidade / UF</TableHead>
                <TableHead>Diretor</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campus) => (
                <TableRow key={campus.id}>
                  <TableCell className="font-medium">{campus.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {institutionMap[campus.institution_id] || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[campus.city, campus.state].filter(Boolean).join(' / ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {campus.director_user_id ? (profileMap[campus.director_user_id] || '—') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={campus.status === 'ATIVO' ? 'default' : 'secondary'}>
                      {campus.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(campus)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {campus.status === 'ATIVO' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(campus.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: Create/Edit Campus */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Campus' : 'Novo Campus'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Instituição *</Label>
              <Select value={formInstitutionId} onValueChange={setFormInstitutionId}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  {institutions.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Campus Centro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              <div>
                <Label>UF</Label>
                <Select value={formState} onValueChange={setFormState}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Diretor</Label>
              <Select value={formDirectorId} onValueChange={setFormDirectorId}>
                <SelectTrigger><SelectValue placeholder="Selecione o diretor (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
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

export default Campi;
