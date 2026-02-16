
-- Grade change audit log
CREATE TABLE public.grade_change_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.student_subject_enrollments(id) ON DELETE CASCADE,
  grade_type TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC NOT NULL,
  action TEXT NOT NULL DEFAULT 'INSERT', -- INSERT, UPDATE, DELETE
  changed_by_user_id UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.grade_change_logs ENABLE ROW LEVEL SECURITY;

-- Staff (admin, coordenador, super_admin) can view all logs
CREATE POLICY "Staff can view grade change logs"
ON public.grade_change_logs
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Professors can view logs for their own changes
CREATE POLICY "Professors can view own grade change logs"
ON public.grade_change_logs
FOR SELECT
TO authenticated
USING (changed_by_user_id = auth.uid());

-- Insert policy: authenticated users who are staff or professors
CREATE POLICY "Authenticated users can insert grade change logs"
ON public.grade_change_logs
FOR INSERT
TO authenticated
WITH CHECK (changed_by_user_id = auth.uid());

-- Create trigger function to auto-log grade changes
CREATE OR REPLACE FUNCTION public.log_grade_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.grade_change_logs (enrollment_id, grade_type, old_value, new_value, action, changed_by_user_id)
    VALUES (NEW.enrollment_id, NEW.grade_type, NULL, NEW.grade_value, 'INSERT', NEW.professor_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.grade_value IS DISTINCT FROM NEW.grade_value THEN
      INSERT INTO public.grade_change_logs (enrollment_id, grade_type, old_value, new_value, action, changed_by_user_id)
      VALUES (NEW.enrollment_id, NEW.grade_type, OLD.grade_value, NEW.grade_value, 'UPDATE', NEW.professor_user_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.grade_change_logs (enrollment_id, grade_type, old_value, new_value, action, changed_by_user_id)
    VALUES (OLD.enrollment_id, OLD.grade_type, OLD.grade_value, 0, 'DELETE', OLD.professor_user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
CREATE TRIGGER trg_log_grade_change
AFTER INSERT OR UPDATE OR DELETE ON public.student_grades
FOR EACH ROW EXECUTE FUNCTION public.log_grade_change();

-- Index for fast lookups
CREATE INDEX idx_grade_change_logs_enrollment ON public.grade_change_logs(enrollment_id);
CREATE INDEX idx_grade_change_logs_changed_at ON public.grade_change_logs(changed_at DESC);
