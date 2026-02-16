import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  MessageSquare, Plus, Loader2, Settings, Send, Users, FileText,
  BarChart3, Trash2, Pencil, Play, Eye, Phone,
} from 'lucide-react';

interface WhatsAppSettings {
  id: string;
  institution_id: string;
  provider: string;
  api_url: string;
  api_token: string;
  default_connection_id: string | null;
  is_active: boolean;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: string;
  status: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  template_id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface ContactMember {
  id: string;
  list_id: string;
  name: string;
  phone: string;
  variables: Record<string, string>;
}

interface MessageLog {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: string;
  message_content: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const WhatsApp = () => {
  const { profile, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);

  // Settings
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ api_url: '', api_token: '', provider: 'whaticket' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', category: 'MARKETING' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', template_id: '', scheduled_at: '' });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Contact Lists
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [contactListDialogOpen, setContactListDialogOpen] = useState(false);
  const [contactListForm, setContactListForm] = useState({ name: '', description: '' });
  const [savingContactList, setSavingContactList] = useState(false);

  // Contact Members
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [members, setMembers] = useState<ContactMember[]>([]);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '' });
  const [savingMember, setSavingMember] = useState(false);

  // Campaign Recipients
  const [recipientsDialogOpen, setRecipientsDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedListForCampaign, setSelectedListForCampaign] = useState('');
  const [addingRecipients, setAddingRecipients] = useState(false);

  // Logs
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [processingCampaign, setProcessingCampaign] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const institutionId = profile?.institution_id;

    const [settingsRes, templatesRes, campaignsRes, listsRes, logsRes] = await Promise.all([
      institutionId
        ? supabase.from('whatsapp_settings').select('*').eq('institution_id', institutionId).maybeSingle()
        : { data: null, error: null },
      supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('whatsapp_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('whatsapp_contact_lists').select('*').order('created_at', { ascending: false }),
      supabase.from('whatsapp_message_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (settingsRes.data) {
      setSettings(settingsRes.data as any);
      setSettingsForm({
        api_url: (settingsRes.data as any).api_url || '',
        api_token: (settingsRes.data as any).api_token || '',
        provider: (settingsRes.data as any).provider || 'whaticket',
      });
    }
    setTemplates((templatesRes.data as any[]) || []);
    setCampaigns((campaignsRes.data as any[]) || []);
    setContactLists((listsRes.data as any[]) || []);
    setLogs((logsRes.data as any[]) || []);
    setLoading(false);
  }

  // --- Settings ---
  async function handleSaveSettings() {
    if (!settingsForm.api_url || !settingsForm.api_token) {
      toast({ title: 'Preencha URL e Token da API', variant: 'destructive' });
      return;
    }
    setSavingSettings(true);
    const institutionId = profile?.institution_id;
    if (!institutionId) {
      toast({ title: 'Usuário sem instituição vinculada', variant: 'destructive' });
      setSavingSettings(false);
      return;
    }

    if (settings) {
      const { error } = await supabase.from('whatsapp_settings').update({
        api_url: settingsForm.api_url,
        api_token: settingsForm.api_token,
        provider: settingsForm.provider,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id);
      if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      else toast({ title: 'Configurações atualizadas' });
    } else {
      const { error } = await supabase.from('whatsapp_settings').insert({
        institution_id: institutionId,
        api_url: settingsForm.api_url,
        api_token: settingsForm.api_token,
        provider: settingsForm.provider,
      });
      if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      else toast({ title: 'Configurações salvas' });
    }
    fetchAll();
    setSavingSettings(false);
  }

  // --- Templates ---
  function openTemplateDialog(template?: Template) {
    setEditingTemplate(template || null);
    setTemplateForm({
      name: template?.name || '',
      content: template?.content || '',
      category: template?.category || 'MARKETING',
    });
    setTemplateDialogOpen(true);
  }

  async function handleSaveTemplate() {
    if (!templateForm.name || !templateForm.content) {
      toast({ title: 'Preencha nome e conteúdo', variant: 'destructive' });
      return;
    }
    setSavingTemplate(true);
    // Extract variables like {{nome}}, {{senha}}
    const vars = [...templateForm.content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

    if (editingTemplate) {
      const { error } = await supabase.from('whatsapp_templates').update({
        name: templateForm.name,
        content: templateForm.content,
        category: templateForm.category,
        variables: vars,
        updated_at: new Date().toISOString(),
      }).eq('id', editingTemplate.id);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Template atualizado' }); setTemplateDialogOpen(false); }
    } else {
      const { error } = await supabase.from('whatsapp_templates').insert({
        name: templateForm.name,
        content: templateForm.content,
        category: templateForm.category,
        variables: vars,
        institution_id: profile?.institution_id || null,
        created_by: profile?.id || '',
      } as any);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Template criado' }); setTemplateDialogOpen(false); }
    }
    fetchAll();
    setSavingTemplate(false);
  }

  async function handleDeleteTemplate(id: string) {
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Template excluído' }); fetchAll(); }
  }

  // --- Contact Lists ---
  function openContactListDialog() {
    setContactListForm({ name: '', description: '' });
    setContactListDialogOpen(true);
  }

  async function handleSaveContactList() {
    if (!contactListForm.name) { toast({ title: 'Preencha o nome', variant: 'destructive' }); return; }
    setSavingContactList(true);
    const { error } = await supabase.from('whatsapp_contact_lists').insert({
      name: contactListForm.name,
      description: contactListForm.description || null,
      institution_id: profile?.institution_id || null,
      created_by: profile?.id || '',
    } as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Lista criada' }); setContactListDialogOpen(false); fetchAll(); }
    setSavingContactList(false);
  }

  async function openMembersDialog(listId: string) {
    setSelectedListId(listId);
    setMemberForm({ name: '', phone: '' });
    const { data } = await supabase.from('whatsapp_contact_list_members').select('*').eq('list_id', listId).order('name');
    setMembers((data as any[]) || []);
    setMembersDialogOpen(true);
  }

  async function handleAddMember() {
    if (!memberForm.name || !memberForm.phone || !selectedListId) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' }); return;
    }
    setSavingMember(true);
    const { error } = await supabase.from('whatsapp_contact_list_members').insert({
      list_id: selectedListId,
      name: memberForm.name,
      phone: memberForm.phone,
    });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      setMemberForm({ name: '', phone: '' });
      const { data } = await supabase.from('whatsapp_contact_list_members').select('*').eq('list_id', selectedListId).order('name');
      setMembers((data as any[]) || []);
    }
    setSavingMember(false);
  }

  async function handleDeleteMember(id: string) {
    await supabase.from('whatsapp_contact_list_members').delete().eq('id', id);
    if (selectedListId) {
      const { data } = await supabase.from('whatsapp_contact_list_members').select('*').eq('list_id', selectedListId).order('name');
      setMembers((data as any[]) || []);
    }
  }

  async function handleDeleteContactList(id: string) {
    const { error } = await supabase.from('whatsapp_contact_lists').delete().eq('id', id);
    if (error) toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Lista excluída' }); fetchAll(); }
  }

  // --- Campaigns ---
  function openCampaignDialog() {
    setCampaignForm({ name: '', template_id: '', scheduled_at: '' });
    setCampaignDialogOpen(true);
  }

  async function handleSaveCampaign() {
    if (!campaignForm.name || !campaignForm.template_id) {
      toast({ title: 'Preencha nome e template', variant: 'destructive' }); return;
    }
    setSavingCampaign(true);
    const { error } = await supabase.from('whatsapp_campaigns').insert({
      name: campaignForm.name,
      template_id: campaignForm.template_id,
      scheduled_at: campaignForm.scheduled_at || null,
      institution_id: profile?.institution_id || null,
      created_by: profile?.id || '',
    } as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Campanha criada' }); setCampaignDialogOpen(false); fetchAll(); }
    setSavingCampaign(false);
  }

  async function openRecipientsDialog(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setSelectedListForCampaign('');
    setRecipientsDialogOpen(true);
  }

  async function handleAddRecipientsFromList() {
    if (!selectedListForCampaign || !selectedCampaignId) return;
    setAddingRecipients(true);
    const { data: members } = await supabase
      .from('whatsapp_contact_list_members')
      .select('*')
      .eq('list_id', selectedListForCampaign);

    if (members && members.length > 0) {
      const recipients = members.map((m: any) => ({
        campaign_id: selectedCampaignId,
        contact_list_id: selectedListForCampaign,
        name: m.name,
        phone: m.phone,
        variables: m.variables || {},
      }));
      const { error } = await supabase.from('whatsapp_campaign_recipients').insert(recipients);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else {
        // Update total contacts
        const { count } = await supabase
          .from('whatsapp_campaign_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', selectedCampaignId);
        await supabase.from('whatsapp_campaigns').update({ total_contacts: count || 0 }).eq('id', selectedCampaignId);
        toast({ title: `${members.length} contatos adicionados` });
        setRecipientsDialogOpen(false);
        fetchAll();
      }
    } else {
      toast({ title: 'Lista sem contatos', variant: 'destructive' });
    }
    setAddingRecipients(false);
  }

  async function handleStartCampaign(campaignId: string) {
    setProcessingCampaign(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: 'Erro ao processar campanha', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `Campanha processada: ${result.sent} enviados, ${result.failed} falhas` });
        fetchAll();
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setProcessingCampaign(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie integrações, templates, listas de contatos e campanhas de WhatsApp.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="w-4 h-4" />Configurações</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><FileText className="w-4 h-4" />Templates</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><Users className="w-4 h-4" />Contatos</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Send className="w-4 h-4" />Campanhas</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><BarChart3 className="w-4 h-4" />Relatórios</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="bg-card rounded-xl border border-border shadow-card p-6 max-w-xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Integração Whaticket</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure a conexão com sua instância do Whaticket para envio de mensagens.
            </p>
            <div className="space-y-4">
              <div>
                <Label>Provedor</Label>
                <Select value={settingsForm.provider} onValueChange={(v) => setSettingsForm(prev => ({ ...prev, provider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whaticket">Whaticket</SelectItem>
                    <SelectItem value="oficial">API Oficial (Meta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL da API *</Label>
                <Input
                  value={settingsForm.api_url}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, api_url: e.target.value }))}
                  placeholder="https://sua-instancia.whaticket.com"
                />
              </div>
              <div>
                <Label>Token da API *</Label>
                <Input
                  value={settingsForm.api_token}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, api_token: e.target.value }))}
                  placeholder="Seu token de autenticação"
                  type="password"
                />
              </div>
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {settings ? 'Atualizar Configurações' : 'Salvar Configurações'}
              </Button>
              {settings && (
                <Badge variant="default" className="ml-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2 inline-block" />
                  Conectado
                </Badge>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <h2 className="font-semibold text-foreground">Templates de Mensagem</h2>
              <Button size="sm" onClick={() => openTemplateDialog()}>
                <Plus className="w-4 h-4 mr-1" />Novo Template
              </Button>
            </div>
            {templates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum template criado.</p>
                <p className="text-xs mt-1">Use variáveis como {"{{nome}}"} e {"{{senha}}"} para personalização.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Variáveis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(t.variables || []).map(v => (
                            <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={t.status === 'ATIVO' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openTemplateDialog(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteTemplate(t.id)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <h2 className="font-semibold text-foreground">Listas de Contatos</h2>
              <Button size="sm" onClick={openContactListDialog}>
                <Plus className="w-4 h-4 mr-1" />Nova Lista
              </Button>
            </div>
            {contactLists.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma lista de contatos criada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactLists.map(list => (
                    <TableRow key={list.id}>
                      <TableCell className="font-medium">{list.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{list.description || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(list.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openMembersDialog(list.id)} title="Gerenciar contatos">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteContactList(list.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <h2 className="font-semibold text-foreground">Campanhas</h2>
              <Button size="sm" onClick={openCampaignDialog}>
                <Plus className="w-4 h-4 mr-1" />Nova Campanha
              </Button>
            </div>
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma campanha criada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contatos</TableHead>
                    <TableHead>Enviados</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          c.status === 'CONCLUIDA' ? 'default' :
                          c.status === 'ENVIANDO' ? 'secondary' : 'outline'
                        }>{c.status}</Badge>
                      </TableCell>
                      <TableCell>{c.total_contacts}</TableCell>
                      <TableCell className="text-primary">{c.sent_count}</TableCell>
                      <TableCell className="text-destructive">{c.failed_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {c.status === 'RASCUNHO' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openRecipientsDialog(c.id)} title="Adicionar contatos">
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartCampaign(c.id)}
                              disabled={processingCampaign === c.id}
                              title="Iniciar campanha"
                            >
                              {processingCampaign === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-primary" />}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Histórico de Mensagens</h2>
              <p className="text-sm text-muted-foreground">Últimas 100 mensagens enviadas</p>
            </div>
            {logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mensagem enviada ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.recipient_name || '—'}</TableCell>
                        <TableCell className="text-sm">{log.recipient_phone}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.message_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'ENVIADO' ? 'default' : 'destructive'} className="text-xs">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                          {log.error_message || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Reset de Senha" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={templateForm.category} onValueChange={v => setTemplateForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="TRANSACIONAL">Transacional</SelectItem>
                  <SelectItem value="NOTIFICACAO">Notificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conteúdo *</Label>
              <Textarea
                value={templateForm.content}
                onChange={e => setTemplateForm(p => ({ ...p, content: e.target.value }))}
                placeholder={`Olá {{nome}}, sua nova senha é: {{senha}}`}
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{variavel}}"} para personalização. Ex: {"{{nome}}"}, {"{{senha}}"}, {"{{curso}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact List Dialog */}
      <Dialog open={contactListDialogOpen} onOpenChange={setContactListDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Lista de Contatos</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={contactListForm.name} onChange={e => setContactListForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Alunos 2024" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={contactListForm.description} onChange={e => setContactListForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição opcional..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveContactList} disabled={savingContactList}>
              {savingContactList && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar Lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Contatos da Lista</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input placeholder="Nome" value={memberForm.name} onChange={e => setMemberForm(p => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Telefone" value={memberForm.phone} onChange={e => setMemberForm(p => ({ ...p, phone: e.target.value }))} />
              <Button onClick={handleAddMember} disabled={savingMember} size="sm">
                {savingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato nesta lista.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.name}</TableCell>
                      <TableCell className="text-sm">{m.phone}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMember(m.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Promoção Janeiro" />
            </div>
            <div>
              <Label>Template *</Label>
              <Select value={campaignForm.template_id || "none"} onValueChange={v => setCampaignForm(p => ({ ...p, template_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agendar para (opcional)</Label>
              <Input type="datetime-local" value={campaignForm.scheduled_at} onChange={e => setCampaignForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveCampaign} disabled={savingCampaign}>
              {savingCampaign && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Recipients Dialog */}
      <Dialog open={recipientsDialogOpen} onOpenChange={setRecipientsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Contatos à Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Lista de Contatos</Label>
              <Select value={selectedListForCampaign || "none"} onValueChange={v => setSelectedListForCampaign(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione uma lista" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {contactLists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleAddRecipientsFromList} disabled={addingRecipients || !selectedListForCampaign}>
              {addingRecipients && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Adicionar Contatos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsApp;
