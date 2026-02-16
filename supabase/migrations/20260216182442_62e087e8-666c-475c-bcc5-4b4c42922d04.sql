
-- Update the function to also check attendance (75% minimum)
CREATE OR REPLACE FUNCTION public.update_enrollment_status_from_grades()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  avg_grade NUMERIC(5,2);
  grade_count INTEGER;
  total_sessions INTEGER;
  present_count INTEGER;
  attendance_pct NUMERIC(5,2);
  v_enrollment_id UUID;
  v_student_id UUID;
  v_subject_id UUID;
BEGIN
  v_enrollment_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);

  -- Get student_id and subject_id from enrollment
  SELECT student_id, subject_id INTO v_student_id, v_subject_id
  FROM public.student_subject_enrollments
  WHERE id = v_enrollment_id;

  -- Calculate average of all grades for this enrollment
  SELECT AVG(grade_value), COUNT(*)
  INTO avg_grade, grade_count
  FROM public.student_grades
  WHERE enrollment_id = v_enrollment_id;

  -- Calculate attendance percentage
  -- Total sessions for this subject across all classes the student is in
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
    attendance_pct := 100; -- No sessions yet, assume full attendance
  END IF;

  -- Only update status if there are grades
  IF grade_count > 0 THEN
    IF avg_grade >= 7.0 AND attendance_pct >= 75.0 THEN
      UPDATE public.student_subject_enrollments
      SET status = 'APROVADO'
      WHERE id = v_enrollment_id;
    ELSE
      UPDATE public.student_subject_enrollments
      SET status = 'REPROVADO'
      WHERE id = v_enrollment_id;
    END IF;
  ELSE
    -- If all grades removed, set back to CURSANDO
    UPDATE public.student_subject_enrollments
    SET status = 'CURSANDO'
    WHERE id = v_enrollment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
