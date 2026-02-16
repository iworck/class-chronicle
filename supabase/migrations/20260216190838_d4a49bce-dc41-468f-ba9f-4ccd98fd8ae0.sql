
-- Update the trigger function to only consider grades where counts_in_final = true
CREATE OR REPLACE FUNCTION public.update_enrollment_status_from_grades()
RETURNS TRIGGER AS $$
DECLARE
  v_enrollment_id UUID;
  v_subject_id UUID;
  v_student_id UUID;
  v_min_grade NUMERIC;
  v_min_att NUMERIC;
  v_avg NUMERIC;
  v_att_pct NUMERIC;
  v_total_sessions INT;
  v_present_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_enrollment_id := OLD.enrollment_id;
  ELSE
    v_enrollment_id := NEW.enrollment_id;
  END IF;

  SELECT subject_id, student_id INTO v_subject_id, v_student_id
  FROM student_subject_enrollments WHERE id = v_enrollment_id;

  IF v_subject_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT min_grade, min_attendance_pct INTO v_min_grade, v_min_att
  FROM subjects WHERE id = v_subject_id;

  -- Only consider grades where counts_in_final = true
  SELECT CASE WHEN SUM(weight) > 0 THEN SUM(grade_value * weight) / SUM(weight) ELSE NULL END
  INTO v_avg
  FROM student_grades
  WHERE enrollment_id = v_enrollment_id AND counts_in_final = true;

  IF v_avg IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Attendance check
  SELECT COUNT(*) INTO v_total_sessions
  FROM attendance_sessions
  WHERE subject_id = v_subject_id
    AND status IN ('ENCERRADA', 'AUDITORIA_FINALIZADA');

  IF v_total_sessions > 0 THEN
    SELECT COUNT(*) INTO v_present_count
    FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE ar.student_id = v_student_id
      AND s.subject_id = v_subject_id
      AND s.status IN ('ENCERRADA', 'AUDITORIA_FINALIZADA')
      AND ar.final_status = 'PRESENTE';

    v_att_pct := (v_present_count::NUMERIC / v_total_sessions) * 100;
  ELSE
    v_att_pct := 100;
  END IF;

  IF v_avg >= v_min_grade AND v_att_pct >= v_min_att THEN
    UPDATE student_subject_enrollments SET status = 'APROVADO', updated_at = now() WHERE id = v_enrollment_id;
  ELSE
    UPDATE student_subject_enrollments SET status = 'REPROVADO', updated_at = now() WHERE id = v_enrollment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
