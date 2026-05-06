-- Create user_courses table
CREATE TABLE public.user_courses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, course_id)
);

-- Create user_subjects table
CREATE TABLE public.user_subjects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

-- Create policies for user_courses
CREATE POLICY "Allow read access for all authenticated users to user_courses" 
ON public.user_courses FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow full access for admins to user_courses" 
ON public.user_courses FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- Create policies for user_subjects
CREATE POLICY "Allow read access for all authenticated users to user_subjects" 
ON public.subjects FOR SELECT 
TO authenticated 
USING (true);

-- Wait, I should make sure policies for user_subjects are correct
CREATE POLICY "Allow read access for all authenticated users to user_subjects_table" 
ON public.user_subjects FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow full access for admins to user_subjects" 
ON public.user_subjects FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);
