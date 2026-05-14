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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      import_logs: {
        Row: {
          created_at: string
          id: string
          imported_by: string | null
          records_imported: number | null
          records_skipped: number | null
          round_id: string
          skipped_records: Json | null
          source: string
          source_url: string | null
          status: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          imported_by?: string | null
          records_imported?: number | null
          records_skipped?: number | null
          round_id: string
          skipped_records?: Json | null
          source: string
          source_url?: string | null
          status?: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          imported_by?: string | null
          records_imported?: number | null
          records_skipped?: number | null
          round_id?: string
          skipped_records?: Json | null
          source?: string
          source_url?: string | null
          status?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      news_drafts: {
        Row: {
          body: string | null
          created_at: string
          highlights: Json | null
          id: string
          language: string
          published_at: string | null
          round_id: string
          seo_excerpt: string | null
          special_mention: string | null
          status: string
          subtitle: string | null
          title: string | null
          tone: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          highlights?: Json | null
          id?: string
          language: string
          published_at?: string | null
          round_id: string
          seo_excerpt?: string | null
          special_mention?: string | null
          status?: string
          subtitle?: string | null
          title?: string | null
          tone: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          highlights?: Json | null
          id?: string
          language?: string
          published_at?: string | null
          round_id?: string
          seo_excerpt?: string | null
          special_mention?: string | null
          status?: string
          subtitle?: string | null
          title?: string | null
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_drafts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          id: string
          round_id: string
          sort_order: number | null
          type: string
          url: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          round_id: string
          sort_order?: number | null
          type: string
          url: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          id?: string
          round_id?: string
          sort_order?: number | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_year: number | null
          club: string | null
          created_at: string
          current_handicap: number | null
          gender: string | null
          id: string
          initial_handicap: number | null
          is_senior: boolean
          license: string
          name: string
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          club?: string | null
          created_at?: string
          current_handicap?: number | null
          gender?: string | null
          id?: string
          initial_handicap?: number | null
          is_senior?: boolean
          license: string
          name: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          club?: string | null
          created_at?: string
          current_handicap?: number | null
          gender?: string | null
          id?: string
          initial_handicap?: number | null
          is_senior?: boolean
          license?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          category: Database["public"]["Enums"]["player_category"] | null
          created_at: string
          handicap_at_round: number | null
          id: string
          is_female_prize: boolean
          is_senior_prize: boolean
          play_date: string | null
          player_id: string
          round_id: string
          scorecard: Json | null
          scratch_score: number | null
          source_url: string | null
          stableford_points: number | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["player_category"] | null
          created_at?: string
          handicap_at_round?: number | null
          id?: string
          is_female_prize?: boolean
          is_senior_prize?: boolean
          play_date?: string | null
          player_id: string
          round_id: string
          scorecard?: Json | null
          scratch_score?: number | null
          source_url?: string | null
          stableford_points?: number | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["player_category"] | null
          created_at?: string
          handicap_at_round?: number | null
          id?: string
          is_female_prize?: boolean
          is_senior_prize?: boolean
          play_date?: string | null
          player_id?: string
          round_id?: string
          scorecard?: Json | null
          scratch_score?: number | null
          source_url?: string | null
          stableford_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          club: string | null
          course: string | null
          course_handicap: Json | null
          course_handicap_women: Json | null
          course_par: Json | null
          created_at: string
          date: string
          end_date: string | null
          external_links: Json | null
          id: string
          is_master: boolean
          master_coefficient: number
          name: string
          round_number: number
          season_id: string
          sponsor: string | null
          sponsor_logo_url: string | null
          status: Database["public"]["Enums"]["round_status"]
          updated_at: string
        }
        Insert: {
          club?: string | null
          course?: string | null
          course_handicap?: Json | null
          course_handicap_women?: Json | null
          course_par?: Json | null
          created_at?: string
          date: string
          end_date?: string | null
          external_links?: Json | null
          id?: string
          is_master?: boolean
          master_coefficient?: number
          name: string
          round_number: number
          season_id: string
          sponsor?: string | null
          sponsor_logo_url?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
        }
        Update: {
          club?: string | null
          course?: string | null
          course_handicap?: Json | null
          course_handicap_women?: Json | null
          course_par?: Json | null
          created_at?: string
          date?: string
          end_date?: string | null
          external_links?: Json | null
          id?: string
          is_master?: boolean
          master_coefficient?: number
          name?: string
          round_number?: number
          season_id?: string
          sponsor?: string | null
          sponsor_logo_url?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          active: boolean
          created_at: string
          id: string
          rules_config: Json
          updated_at: string
          year: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          rules_config?: Json
          updated_at?: string
          year: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          rules_config?: Json
          updated_at?: string
          year?: number
        }
        Relationships: []
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
      players_public: {
        Row: {
          club: string | null
          created_at: string | null
          current_handicap: number | null
          gender: string | null
          id: string | null
          initial_handicap: number | null
          is_senior: boolean | null
          license: string | null
          name: string | null
          photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          club?: string | null
          created_at?: string | null
          current_handicap?: number | null
          gender?: string | null
          id?: string | null
          initial_handicap?: number | null
          is_senior?: boolean | null
          license?: string | null
          name?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          club?: string | null
          created_at?: string | null
          current_handicap?: number | null
          gender?: string | null
          id?: string | null
          initial_handicap?: number | null
          is_senior?: boolean | null
          license?: string | null
          name?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      app_role: "admin"
      player_category: "hcp_low" | "hcp_high"
      round_status: "draft" | "imported" | "review" | "validated" | "published"
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
      app_role: ["admin"],
      player_category: ["hcp_low", "hcp_high"],
      round_status: ["draft", "imported", "review", "validated", "published"],
    },
  },
} as const
