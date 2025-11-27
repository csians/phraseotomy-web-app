import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egrwijzbxxhkhrrelsgi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVncndpanpieHhoa2hycmVsc2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTk1MTQsImV4cCI6MjA3ODk3NTUxNH0._Vwhvuyh7PN8yfja1xkymBwQLrCxzVzP8E_MO_iGxdc';

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return true; // Always configured with hardcoded values
}

// Create single Supabase client instance with realtime enabled
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'phraseotomy-auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Helper to get client and throw error if not configured
function getClient() {
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
