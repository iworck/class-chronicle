
-- Create student_grades table
CREATE TABLE public.student_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.student_subject_enrollments(id) ON DELETE CASCADE,
  grade_type VARCHAR(20) NOT NULL, -- N1, N2, N3, FINAL, etc.
  grade_value NUMERIC(5,2) NOT NULL,
  professor_user_id UUID NOT NULL,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, grade_type)
);

-- Enable RLS
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

-- Professors can manage grades they created
CREATE POLICY "Professors can insert grades"
  ON public.student_grades FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'professor'::app_role) AND professor_user_id = auth.uid());

CREATE POLICY "Professors can update their own grades"
  ON public.student_grades FOR UPDATE
  USING (has_role(auth.uid(), 'professor'::app_role) AND professor_user_id = auth.uid());

-- Staff can view all grades
CREATE POLICY "Staff can view grades"
  ON public.student_grades FOR SELECT
  USING (is_staff(auth.uid()));

-- Admin/coord/super_admin can manage all grades
CREATE POLICY "Admin and coord can manage all grades"
  ON public.student_grades FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role) OR is_super_admin(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_student_grades_updated_at
  BEFORE UPDATE ON public.student_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-update enrollment status based on grades average
CREATE OR REPLACE FUNCTION public.update_enrollment_status_from_grades()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  avg_grade NUMERIC(5,2);
  grade_count INTEGER;
BEGIN
  -- Calculate average of all grades for this enrollment
  SELECT AVG(grade_value), COUNT(*)
  INTO avg_grade, grade_count
  FROM public.student_grades
  WHERE enrollment_id = COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  -- Only update status if there are grades
  IF grade_count > 0 THEN
    IF avg_grade >= 7.0 THEN
      UPDATE public.student_subject_enrollments
      SET status = 'APROVADO'
      WHERE id = COALESCE(NEW.enrollment_id, OLD.enrollment_id);
    ELSE
      UPDATE public.student_subject_enrollments
      SET status = 'REPROVADO'
      WHERE id = COALESCE(NEW.enrollment_id, OLD.enrollment_id);
    END IF;
  ELSE
    -- If all grades removed, set back to CURSANDO
    UPDATE public.student_subject_enrollments
    SET status = 'CURSANDO'
    WHERE id = OLD.enrollment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger after insert/update/delete on grades
CREATE TRIGGER auto_update_enrollment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.student_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_enrollment_status_from_grades();
