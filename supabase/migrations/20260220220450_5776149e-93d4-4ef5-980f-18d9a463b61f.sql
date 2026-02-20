-- Allow professors to delete attendance records from their own sessions
CREATE POLICY "Professors can delete records of their sessions"
ON public.attendance_records
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM attendance_sessions
    WHERE attendance_sessions.id = attendance_records.session_id
      AND attendance_sessions.professor_user_id = auth.uid()
      AND attendance_sessions.status = 'ABERTA'
  )
);
