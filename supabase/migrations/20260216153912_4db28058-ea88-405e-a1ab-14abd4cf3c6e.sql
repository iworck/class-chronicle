
-- WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  status TEXT NOT NULL DEFAULT 'ATIVO',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp campaigns
CREATE TABLE public.whatsapp_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.whatsapp_templates(id),
  status TEXT NOT NULL DEFAULT 'RASCUNHO',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contact lists for campaigns
CREATE TABLE public.whatsapp_contact_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts within lists
CREATE TABLE public.whatsapp_contact_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.whatsapp_contact_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign recipients (junction between campaign and contacts/lists)
CREATE TABLE public.whatsapp_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_list_id UUID REFERENCES public.whatsapp_contact_lists(id),
  name TEXT,
  phone TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message logs (for password resets and campaign messages)
CREATE TABLE public.whatsapp_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  campaign_id UUID REFERENCES public.whatsapp_campaigns(id),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'CAMPAIGN',
  message_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ENVIADO',
  external_id TEXT,
  error_message TEXT,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp API settings per institution
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) UNIQUE,
  provider TEXT NOT NULL DEFAULT 'whaticket',
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  default_connection_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: staff of the same institution can manage
CREATE POLICY "Staff can view templates" ON public.whatsapp_templates
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage templates" ON public.whatsapp_templates
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view campaigns" ON public.whatsapp_campaigns
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage campaigns" ON public.whatsapp_campaigns
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view contact lists" ON public.whatsapp_contact_lists
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage contact lists" ON public.whatsapp_contact_lists
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view contact list members" ON public.whatsapp_contact_list_members
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage contact list members" ON public.whatsapp_contact_list_members
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view campaign recipients" ON public.whatsapp_campaign_recipients
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage campaign recipients" ON public.whatsapp_campaign_recipients
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view message logs" ON public.whatsapp_message_logs
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage message logs" ON public.whatsapp_message_logs
  FOR ALL USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can view whatsapp settings" ON public.whatsapp_settings
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage whatsapp settings" ON public.whatsapp_settings
  FOR ALL USING (public.is_staff(auth.uid()));
