import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && 
            supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '');
}

// Create Supabase client only if configured, otherwise null
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!);
}

// Export the client (may be null if not configured)
export const supabase = supabaseInstance;

// Helper to get client and throw error if not configured
function getClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  return supabase;
}

// Example function to check connection and interact with a placeholder table
export async function testConnection() {
  try {
    const client = getClient();
    const { data, error } = await client
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
    const client = getClient();
    const { data, error } = await client
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
