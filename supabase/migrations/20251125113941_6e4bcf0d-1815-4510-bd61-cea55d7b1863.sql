-- Create themes table
CREATE TABLE IF NOT EXISTS public.themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create elements table
CREATE TABLE IF NOT EXISTS public.elements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  theme_id UUID REFERENCES public.themes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add game state columns to game_sessions
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS current_storyteller_id TEXT,
ADD COLUMN IF NOT EXISTS selected_theme_id UUID REFERENCES public.themes(id);

-- Add score column to game_players
ALTER TABLE public.game_players 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;

-- Create game_turns table for tracking each turn
CREATE TABLE IF NOT EXISTS public.game_turns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  storyteller_id TEXT NOT NULL,
  theme_id UUID REFERENCES public.themes(id),
  selected_elements UUID[] DEFAULT '{}',
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create game_guesses table for tracking player guesses
CREATE TABLE IF NOT EXISTS public.game_guesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turn_id UUID NOT NULL REFERENCES public.game_turns(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  guessed_elements UUID[] DEFAULT '{}',
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_guesses ENABLE ROW LEVEL SECURITY;

-- RLS policies for themes and elements (public read)
CREATE POLICY "Anyone can view themes" ON public.themes FOR SELECT USING (true);
CREATE POLICY "Anyone can view elements" ON public.elements FOR SELECT USING (true);

-- RLS policies for game_turns
CREATE POLICY "Players can view turns in their session" ON public.game_turns 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.game_players 
    WHERE game_players.session_id = game_turns.session_id
  )
);

CREATE POLICY "Storyteller can insert turn" ON public.game_turns 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Storyteller can update their turn" ON public.game_turns 
FOR UPDATE USING (true);

-- RLS policies for game_guesses
CREATE POLICY "Players can view guesses in their game" ON public.game_guesses 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.game_turns 
    JOIN public.game_players ON game_players.session_id = game_turns.session_id
    WHERE game_turns.id = game_guesses.turn_id
  )
);

CREATE POLICY "Players can insert their guesses" ON public.game_guesses 
FOR INSERT WITH CHECK (true);

-- Insert default themes
INSERT INTO public.themes (name, icon) VALUES
  ('At Work', 'briefcase'),
  ('At Home', 'home'),
  ('Travel', 'plane'),
  ('Lifestyle', 'bike'),
  ('Adult', 'wine'),
  ('Sci-Fi', 'rocket'),
  ('Horror', 'skull'),
  ('Fantasy', 'sparkles')
ON CONFLICT DO NOTHING;

-- Insert sample elements for each theme (you can add more later)
-- At Work elements
INSERT INTO public.elements (name, icon, theme_id) 
SELECT 'Meeting', 'users', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Coffee', 'coffee', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Computer', 'monitor', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Boss', 'user-check', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Deadline', 'clock', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Email', 'mail', id FROM public.themes WHERE name = 'At Work'
UNION ALL
SELECT 'Presentation', 'presentation', id FROM public.themes WHERE name = 'At Work';

-- At Home elements
INSERT INTO public.elements (name, icon, theme_id) 
SELECT 'Kitchen', 'utensils', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'TV', 'tv', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'Bed', 'bed', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'Garden', 'flower', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'Pet', 'cat', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'Couch', 'armchair', id FROM public.themes WHERE name = 'At Home'
UNION ALL
SELECT 'Laundry', 'shirt', id FROM public.themes WHERE name = 'At Home';

-- Travel elements
INSERT INTO public.elements (name, icon, theme_id) 
SELECT 'Airport', 'plane', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Beach', 'umbrella', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Mountain', 'mountain', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Hotel', 'building', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Suitcase', 'luggage', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Camera', 'camera', id FROM public.themes WHERE name = 'Travel'
UNION ALL
SELECT 'Map', 'map', id FROM public.themes WHERE name = 'Travel';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_elements_theme_id ON public.elements(theme_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_session_id ON public.game_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_game_guesses_turn_id ON public.game_guesses(turn_id);