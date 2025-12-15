-- Add color column to themes table
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS color text;

-- Update theme colors
UPDATE public.themes SET color = '#b65acc' WHERE name = 'At Work';
UPDATE public.themes SET color = '#2eb81b' WHERE name = 'At Home';
UPDATE public.themes SET color = '#fe9b01' WHERE name = 'Travel';
UPDATE public.themes SET color = '#ff342d' WHERE name = 'Lifestyle';