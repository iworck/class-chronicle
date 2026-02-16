-- Create the trigger that was missing on student_grades
CREATE TRIGGER trg_update_enrollment_status_on_grade
  AFTER INSERT OR UPDATE OR DELETE ON public.student_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_enrollment_status_from_grades();