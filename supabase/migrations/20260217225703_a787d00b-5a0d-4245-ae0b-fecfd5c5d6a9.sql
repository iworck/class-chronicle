
-- Add new columns to lesson_plan_entries for full lesson plan table
ALTER TABLE public.lesson_plan_entries
ADD COLUMN IF NOT EXISTS objective text,
ADD COLUMN IF NOT EXISTS activities text,
ADD COLUMN IF NOT EXISTS resource text,
ADD COLUMN IF NOT EXISTS methodology text,
ADD COLUMN IF NOT EXISTS lesson_number integer,
ADD COLUMN IF NOT EXISTS exam_type text;

-- Add ementa override and bibliography fields to class_subjects
ALTER TABLE public.class_subjects
ADD COLUMN IF NOT EXISTS ementa_override text,
ADD COLUMN IF NOT EXISTS bibliografia_basica text,
ADD COLUMN IF NOT EXISTS bibliografia_complementar text;
