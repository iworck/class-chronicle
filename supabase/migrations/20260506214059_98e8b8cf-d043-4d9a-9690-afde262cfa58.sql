-- Access Control Tables
CREATE TABLE IF NOT EXISTS public.user_courses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.user_subjects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, subject_id)
);

-- Audit Logging Table
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    changed_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    target_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'ADD_ROLE', 'REMOVE_ROLE', 'ADD_COURSE', 'REMOVE_COURSE', 'ADD_SUBJECT', 'REMOVE_SUBJECT'
    entity_id UUID, -- course_id or subject_id
    entity_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_courses
CREATE POLICY "user_courses_read_policy" ON public.user_courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_courses_all_admin_policy" ON public.user_courses
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- RLS Policies for user_subjects
CREATE POLICY "user_subjects_read_policy" ON public.user_subjects
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_subjects_all_admin_policy" ON public.user_subjects
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- RLS Policies for permission_audit_logs
CREATE POLICY "audit_logs_read_policy" ON public.permission_audit_logs
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'diretor'))
    );

CREATE POLICY "audit_logs_insert_policy" ON public.permission_audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);
