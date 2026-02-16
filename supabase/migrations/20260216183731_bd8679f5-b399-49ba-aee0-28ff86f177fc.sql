
-- Add weight and grade_category columns to student_grades
ALTER TABLE public.student_grades
ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS grade_category TEXT NOT NULL DEFAULT 'prova';

-- Update the trigger function to calculate weighted average
CREATE OR REPLACE FUNCTION public.update_enrollment_status_from_grades()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  weighted_sum NUMERIC(10,4);
  total_weight NUMERIC(10,4);
  avg_grade NUMERIC(5,2);
  grade_count INTEGER;
  total_sessions INTEGER;
  present_count INTEGER;
  attendance_pct NUMERIC(5,2);
  v_enrollment_id UUID;
  v_student_id UUID;
  v_subject_id UUID;
  v_min_grade NUMERIC(5,2);
  v_min_attendance NUMERIC(5,2);
BEGIN
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  -- Get student_id and subject_id from enrollment
  SELECT student_id, subject_id INTO v_student_id, v_subject_id
  FROM public.student_subject_enrollments
  WHERE id = v_enrollment_id;

  -- Get per-subject approval criteria
  SELECT min_grade, min_attendance_pct INTO v_min_grade, v_min_attendance
  FROM public.subjects
  WHERE id = v_subject_id;

  v_min_grade := COALESCE(v_min_grade, 7.0);
  v_min_attendance := COALESCE(v_min_attendance, 75.0);

  -- Calculate weighted average of all grades for this enrollment
  SELECT SUM(grade_value * weight), SUM(weight), COUNT(*)
  INTO weighted_sum, total_weight, grade_count
  FROM public.student_grades
  WHERE enrollment_id = v_enrollment_id;

  IF grade_count > 0 AND total_weight > 0 THEN
    avg_grade := weighted_sum / total_weight;
  ELSE
    avg_grade := NULL;
  END IF;

  -- Calculate attendance percentage
  SELECT COUNT(DISTINCT s.id)
  INTO total_sessions
  FROM public.attendance_sessions s
  JOIN public.class_students cs ON cs.class_id = s.class_id AND cs.student_id = v_student_id
  WHERE s.subject_id = v_subject_id
    AND s.status IN ('ENCERRADA', 'AUDITORIA_FINALIZADA');

  SELECT COUNT(*)
  INTO present_count
  FROM public.attendance_records r
  JOIN public.attendance_sessions s ON s.id = r.session_id
  WHERE r.student_id = v_student_id
    AND s.subject_id = v_subject_id
    AND r.final_status = 'PRESENTE';

  IF total_sessions > 0 THEN
    attendance_pct := (present_count::NUMERIC / total_sessions::NUMERIC) * 100;
  ELSE
    attendance_pct := 100;
  END IF;

  -- Only update status if there are grades
  IF grade_count > 0 THEN
    IF avg_grade >= v_min_grade AND attendance_pct >= v_min_attendance THEN
      UPDATE public.student_subject_enrollments
      SET status = 'APROVADO'
      WHERE id = v_enrollment_id;
    ELSE
      UPDATE public.student_subject_enrollments
      SET status = 'REPROVADO'
      WHERE id = v_enrollment_id;
    END IF;
  ELSE
    UPDATE public.student_subject_enrollments
    SET status = 'CURSANDO'
    WHERE id = v_enrollment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
