
-- Update trigger to use formula: MEDIA = (N1 + N2 + ...) / count of N's
-- Each N = sum of children's (grade_value * child_weight)
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
  v_cs_id UUID;
  v_n_sum NUMERIC := 0;
  v_n_count INT := 0;
  v_parent RECORD;
  v_child_sum NUMERIC;
  v_child_count INT;
  v_has_template BOOLEAN := false;
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

  -- Find class_subject_id for this enrollment's subject
  SELECT cs.id INTO v_cs_id
  FROM class_subjects cs
  JOIN class_students cst ON cst.class_id = cs.class_id
  WHERE cs.subject_id = v_subject_id
    AND cst.student_id = v_student_id
  LIMIT 1;

  -- Check if there's a grade template
  IF v_cs_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM grade_template_items WHERE class_subject_id = v_cs_id AND counts_in_final = true
    ) INTO v_has_template;
  END IF;

  IF v_has_template THEN
    -- New formula: MEDIA = (N1 + N2 + ...) / count of N's
    FOR v_parent IN
      SELECT id, name FROM grade_template_items
      WHERE class_subject_id = v_cs_id AND counts_in_final = true
      ORDER BY order_index
    LOOP
      -- Check if this parent has children
      SELECT COUNT(*) INTO v_child_count
      FROM grade_template_items
      WHERE class_subject_id = v_cs_id AND parent_item_id = v_parent.id AND counts_in_final = false;

      IF v_child_count > 0 THEN
        -- N = sum of children's (grade_value * child_template_weight)
        SELECT COALESCE(SUM(sg.grade_value * gti.weight), 0)
        INTO v_child_sum
        FROM grade_template_items gti
        JOIN student_grades sg ON sg.enrollment_id = v_enrollment_id AND sg.grade_type = gti.name
        WHERE gti.class_subject_id = v_cs_id AND gti.parent_item_id = v_parent.id AND gti.counts_in_final = false;

        v_n_sum := v_n_sum + v_child_sum;
        v_n_count := v_n_count + 1;
      ELSE
        -- No children — use the grade value directly
        SELECT sg.grade_value INTO v_child_sum
        FROM student_grades sg
        WHERE sg.enrollment_id = v_enrollment_id AND sg.grade_type = v_parent.name
        LIMIT 1;

        IF v_child_sum IS NOT NULL THEN
          v_n_sum := v_n_sum + v_child_sum;
          v_n_count := v_n_count + 1;
        END IF;
      END IF;
    END LOOP;

    IF v_n_count = 0 THEN RETURN COALESCE(NEW, OLD); END IF;
    v_avg := v_n_sum / v_n_count;
  ELSE
    -- Fallback: weighted average of counts_in_final grades
    SELECT CASE WHEN SUM(weight) > 0 THEN SUM(grade_value * weight) / SUM(weight) ELSE NULL END
    INTO v_avg
    FROM student_grades
    WHERE enrollment_id = v_enrollment_id AND counts_in_final = true;

    IF v_avg IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  END IF;

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
