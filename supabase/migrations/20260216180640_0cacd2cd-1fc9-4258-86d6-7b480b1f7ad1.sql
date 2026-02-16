-- Increase length limit on classes.code to allow longer class names
ALTER TABLE public.classes ALTER COLUMN code TYPE character varying(255);