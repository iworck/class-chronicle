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

interface Institution {
  id: string;
  name: string;
  slug: string;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

const Instituicoes = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('super_admin');

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  async function fetchInstitutions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar instituições', description: error.message, variant: 'destructive' });
    } else {
      setInstitutions((data as Institution[]) || []);
    }
    setLoading(false);
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormSlug('');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(inst: Institution) {
    setEditing(inst);
    setFormName(inst.name);
    setFormSlug(inst.slug);
    setFormStatus(inst.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    const slug = formSlug.trim() || generateSlug(formName);
    if (!formName.trim() || !slug) {
      toast({ title: 'Preencha o nome da instituição', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('institutions')
        .update({
          name: formName.trim(),
          slug,
          status: formStatus,
        })
        .eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Instituição atualizada com sucesso' });
        setDialogOpen(false);
        fetchInstitutions();
      }
    } else {
      const { error } = await supabase
        .from('institutions')
        .insert({
          name: formName.trim(),
          slug,
          status: formStatus,
        });
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Instituição criada com sucesso' });
        setDialogOpen(false);
        fetchInstitutions();
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase
      .from('institutions')
      .update({ status: 'INATIVO' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Instituição inativada' });
      fetchInstitutions();
    }
  }

  const filtered = institutions.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.slug.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = institutions.filter((i) => i.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Instituições</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as instituições cadastradas no sistema.
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{institutions.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{institutions.length - activeCount}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar instituição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Nova Instituição
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
            <p>Nenhuma instituição encontrada.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar primeira instituição
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{inst.slug}</TableCell>
                  <TableCell>
                    <Badge variant={inst.status === 'ATIVO' ? 'default' : 'secondary'}>
                      {inst.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inst.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(inst)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {inst.status === 'ATIVO' && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(inst.id)}>
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

      {/* Dialog: Create/Edit Institution */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Instituição' : 'Nova Instituição'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editing) setFormSlug(generateSlug(e.target.value));
                }}
                placeholder="Universidade Federal de Exemplo"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="universidade-federal-de-exemplo"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Identificador único gerado automaticamente a partir do nome.
              </p>
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

export default Instituicoes;
