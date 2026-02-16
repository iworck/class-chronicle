
-- Email SMTP settings per institution
CREATE TABLE public.email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT 'FrequênciaEDU',
  use_tls BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id)
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email settings of their institution"
  ON public.email_settings FOR SELECT
  USING (public.is_staff(auth.uid()) AND institution_id = public.get_user_institution_id(auth.uid()));

CREATE POLICY "Staff can insert email settings for their institution"
  ON public.email_settings FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()) AND institution_id = public.get_user_institution_id(auth.uid()));

CREATE POLICY "Staff can update email settings of their institution"
  ON public.email_settings FOR UPDATE
  USING (public.is_staff(auth.uid()) AND institution_id = public.get_user_institution_id(auth.uid()));

CREATE POLICY "Staff can delete email settings of their institution"
  ON public.email_settings FOR DELETE
  USING (public.is_staff(auth.uid()) AND institution_id = public.get_user_institution_id(auth.uid()));

-- Email message logs
CREATE TABLE public.email_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'GERAL',
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  error_message TEXT,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email logs of their institution"
  ON public.email_message_logs FOR SELECT
  USING (public.is_staff(auth.uid()) AND institution_id = public.get_user_institution_id(auth.uid()));

CREATE POLICY "Staff can insert email logs"
  ON public.email_message_logs FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));
