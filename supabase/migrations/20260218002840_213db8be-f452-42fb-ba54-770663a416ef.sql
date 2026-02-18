-- Allow all staff members to view user roles (needed for filtering directors/coordinators in forms)
CREATE POLICY "Staff can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));
