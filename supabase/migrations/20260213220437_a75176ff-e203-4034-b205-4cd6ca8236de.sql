-- Allow super_admin to manage all user roles
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Allow super_admin to manage all profiles
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));