-- Update element colors based on their theme
-- First update themes table with proper colors
UPDATE public.themes SET color = '#b65acc' WHERE LOWER(name) = 'at work';
UPDATE public.themes SET color = '#7a7978' WHERE LOWER(name) = 'core';
UPDATE public.themes SET color = '#2eb81b' WHERE LOWER(name) IN ('at home', 'home');
UPDATE public.themes SET color = '#fe9b01' WHERE LOWER(name) = 'travel';
UPDATE public.themes SET color = '#ff342d' WHERE LOWER(name) = 'lifestyle';
UPDATE public.themes SET color = '#00E5FF' WHERE LOWER(name) IN ('sci-fi', 'scifi');
UPDATE public.themes SET color = '#7A0000' WHERE LOWER(name) = 'horror';
UPDATE public.themes SET color = '#CFAF00' WHERE LOWER(name) = 'fantasy';
UPDATE public.themes SET color = '#8C0078' WHERE LOWER(name) = 'adult';

-- Now update elements color to match their theme's color
UPDATE public.elements e
SET color = t.color
FROM public.themes t
WHERE e.theme_id = t.id
AND t.color IS NOT NULL;