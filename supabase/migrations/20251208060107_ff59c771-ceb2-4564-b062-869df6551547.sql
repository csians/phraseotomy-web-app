-- Add pack_id and is_core to themes table to link themes to packs
ALTER TABLE public.themes
ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.packs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_core boolean NOT NULL DEFAULT false;

-- Add columns to game_turns for storing selected icons and their order
ALTER TABLE public.game_turns
ADD COLUMN IF NOT EXISTS selected_icon_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS icon_order integer[] DEFAULT '{}';

-- Create index for faster theme lookups by pack
CREATE INDEX IF NOT EXISTS idx_themes_pack_id ON public.themes(pack_id);
CREATE INDEX IF NOT EXISTS idx_themes_is_core ON public.themes(is_core);

-- Add comments
COMMENT ON COLUMN public.themes.pack_id IS 'Links theme to a pack - null for base game themes';
COMMENT ON COLUMN public.themes.is_core IS 'True for base game themes (4 themes), false for expansion packs';
COMMENT ON COLUMN public.game_turns.selected_icon_ids IS 'Array of 5 element IDs: 3 from theme + 2 from core';
COMMENT ON COLUMN public.game_turns.icon_order IS 'Order indices for displaying icons (0-4)';