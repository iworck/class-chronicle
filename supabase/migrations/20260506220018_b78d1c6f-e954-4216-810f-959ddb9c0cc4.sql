-- Create user_classes table
CREATE TABLE IF NOT EXISTS public.user_classes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, class_id)
);

-- Enable RLS
ALTER TABLE public.user_classes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own class assignments"
ON public.user_classes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and coordinators can view all class assignments"
ON public.user_classes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'coordenador')
    )
);

CREATE POLICY "Admins and coordinators can manage class assignments"
ON public.user_classes
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'coordenador')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'coordenador')
    )
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_classes_user_id ON public.user_classes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_classes_class_id ON public.user_classes(class_id);
