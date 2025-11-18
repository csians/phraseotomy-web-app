import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Example function to check connection and interact with a placeholder table
export async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.warn('Supabase query error (table may not exist yet):', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Supabase connection error:', err);
    return { success: false, error: err };
  }
}

// Example function to create a game session
export async function createGameSession(sessionData: {
  shop_domain: string;
  tenant_id: string;
  players?: number;
}) {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .insert([
        {
          ...sessionData,
          created_at: new Date().toISOString(),
        },
      ])
      .select();
    
    if (error) {
      console.warn('Error creating game session:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Error creating game session:', err);
    return { success: false, error: err };
  }
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '');
}
