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
      customer_audio: {
        Row: {
          audio_url: string
          created_at: string | null
          customer_id: string
          filename: string | null
          id: string
          shop_domain: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          customer_id: string
          filename?: string | null
          id?: string
          shop_domain: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          customer_id?: string
          filename?: string | null
          id?: string
          shop_domain?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_audio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          ip_address: string | null
          last_used_at: string
          session_token: string
          shop_domain: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_used_at?: string
          session_token: string
          shop_domain: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string
          session_token?: string
          shop_domain?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string
          customer_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          prod_customer_id: string | null
          shop_domain: string
          staging_customer_id: string | null
          tenant_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id: string
          customer_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          prod_customer_id?: string | null
          shop_domain: string
          staging_customer_id?: string | null
          tenant_id: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string
          customer_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          prod_customer_id?: string | null
          shop_domain?: string
          staging_customer_id?: string | null
          tenant_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      elements: {
        Row: {
          color: string | null
          created_at: string
          icon: string
          id: string
          image_url: string | null
          is_whisp: boolean
          name: string
          theme_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon: string
          id?: string
          image_url?: string | null
          is_whisp?: boolean
          name: string
          theme_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_whisp?: boolean
          name?: string
          theme_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elements_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      game_audio: {
        Row: {
          audio_url: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          mime_type: string | null
          player_id: string
          round_number: number
          session_id: string
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
          player_id: string
          round_number: number
          session_id: string
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
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
      game_guesses: {
        Row: {
          created_at: string
          guessed_elements: string[] | null
          id: string
          player_id: string
          points_earned: number | null
          turn_id: string
        }
        Insert: {
          created_at?: string
          guessed_elements?: string[] | null
          id?: string
          player_id: string
          points_earned?: number | null
          turn_id: string
        }
        Update: {
          created_at?: string
          guessed_elements?: string[] | null
          id?: string
          player_id?: string
          points_earned?: number | null
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_guesses_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "game_turns"
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
          score: number | null
          session_id: string
          turn_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          player_id: string
          score?: number | null
          session_id: string
          turn_order: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          player_id?: string
          score?: number | null
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
          current_round: number | null
          current_storyteller_id: string | null
          ended_at: string | null
          game_mode: string
          game_name: string | null
          guess_time_seconds: number | null
          host_customer_id: string
          host_customer_name: string | null
          id: string
          lobby_code: string
          packs_used: string[]
          selected_audio_id: string | null
          selected_theme_id: string | null
          shop_domain: string
          started_at: string | null
          status: string
          story_time_seconds: number | null
          tenant_id: string
          timer_preset: string | null
          total_rounds: number | null
          turn_mode: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_round?: number | null
          current_storyteller_id?: string | null
          ended_at?: string | null
          game_mode?: string
          game_name?: string | null
          guess_time_seconds?: number | null
          host_customer_id: string
          host_customer_name?: string | null
          id?: string
          lobby_code: string
          packs_used?: string[]
          selected_audio_id?: string | null
          selected_theme_id?: string | null
          shop_domain: string
          started_at?: string | null
          status?: string
          story_time_seconds?: number | null
          tenant_id: string
          timer_preset?: string | null
          total_rounds?: number | null
          turn_mode?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_round?: number | null
          current_storyteller_id?: string | null
          ended_at?: string | null
          game_mode?: string
          game_name?: string | null
          guess_time_seconds?: number | null
          host_customer_id?: string
          host_customer_name?: string | null
          id?: string
          lobby_code?: string
          packs_used?: string[]
          selected_audio_id?: string | null
          selected_theme_id?: string | null
          shop_domain?: string
          started_at?: string | null
          status?: string
          story_time_seconds?: number | null
          tenant_id?: string
          timer_preset?: string | null
          total_rounds?: number | null
          turn_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_selected_audio_id_fkey"
            columns: ["selected_audio_id"]
            isOneToOne: false
            referencedRelation: "customer_audio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_selected_theme_id_fkey"
            columns: ["selected_theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      game_turns: {
        Row: {
          completed_at: string | null
          created_at: string
          icon_order: number[] | null
          id: string
          recording_url: string | null
          round_number: number
          secret_element: string | null
          selected_elements: string | null
          selected_icon_ids: string[] | null
          session_id: string
          storyteller_id: string
          theme_id: string | null
          turn_mode: string | null
          whisp: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          icon_order?: number[] | null
          id?: string
          recording_url?: string | null
          round_number: number
          secret_element?: string | null
          selected_elements?: string | null
          selected_icon_ids?: string[] | null
          session_id: string
          storyteller_id: string
          theme_id?: string | null
          turn_mode?: string | null
          whisp?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          icon_order?: number[] | null
          id?: string
          recording_url?: string | null
          round_number?: number
          secret_element?: string | null
          selected_elements?: string | null
          selected_icon_ids?: string[] | null
          session_id?: string
          storyteller_id?: string
          theme_id?: string | null
          turn_mode?: string | null
          whisp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_turns_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      license_code_packs: {
        Row: {
          created_at: string
          id: string
          license_code_id: string
          pack_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_code_id: string
          pack_id: string
        }
        Update: {
          created_at?: string
          id?: string
          license_code_id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_code_packs_license_code_id_fkey"
            columns: ["license_code_id"]
            isOneToOne: false
            referencedRelation: "license_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_code_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
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
      packs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          access_token: string | null
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
          access_token?: string | null
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
          access_token?: string | null
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
      theme_packs: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          theme_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          theme_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_packs_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_core: boolean
          name: string
          pack_id: string | null
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          is_core?: boolean
          name: string
          pack_id?: string | null
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_core?: boolean
          name?: string
          pack_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "themes_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_sessions: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_customer_total_points: {
        Args: { p_customer_id: string; p_points: number }
        Returns: undefined
      }
      increment_player_score: {
        Args: { p_player_id: string; p_points: number }
        Returns: undefined
      }
      user_is_in_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      verify_tenant_for_proxy: {
        Args: { shop_domain_param: string }
        Returns: {
          environment: Database["public"]["Enums"]["tenant_environment"]
          shop_domain: string
          tenant_id: string
          tenant_name: string
        }[]
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
