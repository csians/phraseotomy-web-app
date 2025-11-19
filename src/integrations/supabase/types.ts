export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customer_licenses: {
        Row: {
          activated_at: string
          created_at: string
          customer_email: string | null
          customer_id: string
          customer_name: string | null
          id: string
          license_code_id: string
          shop_domain: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_id: string
          customer_name?: string | null
          id?: string
          license_code_id: string
          shop_domain: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string
          customer_name?: string | null
          id?: string
          license_code_id?: string
          shop_domain?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_licenses_license_code_id_fkey"
            columns: ["license_code_id"]
            isOneToOne: false
            referencedRelation: "license_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_licenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      game_audio: {
        Row: {
          audio_url: string
          created_at: string | null
          id: string
          player_id: string
          round_number: number
          session_id: string
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          id?: string
          player_id: string
          round_number: number
          session_id: string
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          id?: string
          player_id?: string
          round_number?: number
          session_id?: string
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_audio_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          created_at: string | null
          id: string
          name: string
          player_id: string
          session_id: string
          turn_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          player_id: string
          session_id: string
          turn_order: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          player_id?: string
          session_id?: string
          turn_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_players_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          round_number: number
          session_id: string
          started_at: string | null
          storyteller_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          round_number: number
          session_id: string
          started_at?: string | null
          storyteller_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          round_number?: number
          session_id?: string
          started_at?: string | null
          storyteller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_rounds_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          host_customer_id: string
          host_customer_name: string | null
          id: string
          lobby_code: string
          packs_used: string[]
          shop_domain: string
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          host_customer_id: string
          host_customer_name?: string | null
          id?: string
          lobby_code: string
          packs_used?: string[]
          shop_domain: string
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          host_customer_id?: string
          host_customer_name?: string | null
          id?: string
          lobby_code?: string
          packs_used?: string[]
          shop_domain?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      license_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          packs_unlocked: string[]
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          packs_unlocked?: string[]
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          packs_unlocked?: string[]
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          environment: Database["public"]["Enums"]["tenant_environment"]
          id: string
          is_active: boolean
          name: string
          shop_domain: string
          shopify_client_id: string
          shopify_client_secret: string
          tenant_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: Database["public"]["Enums"]["tenant_environment"]
          id?: string
          is_active?: boolean
          name: string
          shop_domain: string
          shopify_client_id: string
          shopify_client_secret: string
          tenant_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: Database["public"]["Enums"]["tenant_environment"]
          id?: string
          is_active?: boolean
          name?: string
          shop_domain?: string
          shopify_client_id?: string
          shopify_client_secret?: string
          tenant_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      tenant_environment: "staging" | "production"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      tenant_environment: ["staging", "production"],
    },
  },
} as const
