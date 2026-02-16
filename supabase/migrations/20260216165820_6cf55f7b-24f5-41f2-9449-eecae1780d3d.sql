
-- Add lesson_plan column to subjects
ALTER TABLE public.subjects ADD COLUMN lesson_plan TEXT;

-- Create storage bucket for lesson plan PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-plans', 'lesson-plans', true);

-- Storage policies for lesson-plans bucket
CREATE POLICY "Staff can view lesson plan files" ON storage.objects FOR SELECT USING (bucket_id = 'lesson-plans' AND is_staff(auth.uid()));
CREATE POLICY "Admin can upload lesson plan files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lesson-plans' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete lesson plan files" ON storage.objects FOR DELETE USING (bucket_id = 'lesson-plans' AND has_role(auth.uid(), 'admin'::app_role));
