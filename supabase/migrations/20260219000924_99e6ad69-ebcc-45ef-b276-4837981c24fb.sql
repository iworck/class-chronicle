
-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO')),
  response TEXT NULL,
  responded_by_user_id UUID NULL,
  responded_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Students can insert their own tickets
CREATE POLICY "Students can create their own tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- Students can view their own tickets
CREATE POLICY "Students can view their own tickets"
ON public.support_tickets FOR SELECT
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- Staff (admin, coordenador, gerente, diretor) can manage tickets
CREATE POLICY "Staff can view all tickets"
ON public.support_tickets FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can update tickets"
ON public.support_tickets FOR UPDATE
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Students can view class_subjects (for lesson plan access)
CREATE POLICY "Students can view class subjects for their enrollments"
ON public.class_subjects FOR SELECT
USING (
  subject_id IN (
    SELECT sse.subject_id
    FROM public.student_subject_enrollments sse
    JOIN public.students s ON s.id = sse.student_id
    WHERE s.user_id = auth.uid()
  )
);

-- RLS: Students can view lesson_plan_entries for their class subjects
CREATE POLICY "Students can view lesson plan entries for their subjects"
ON public.lesson_plan_entries FOR SELECT
USING (
  class_subject_id IN (
    SELECT cs.id
    FROM public.class_subjects cs
    WHERE cs.subject_id IN (
      SELECT sse.subject_id
      FROM public.student_subject_enrollments sse
      JOIN public.students s ON s.id = sse.student_id
      WHERE s.user_id = auth.uid()
    )
  )
);
