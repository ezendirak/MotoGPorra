export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bet_picks: {
        Row: {
          bet_id: string
          position: number
          rider_id: string
        }
        Insert: {
          bet_id: string
          position: number
          rider_id: string
        }
        Update: {
          bet_id?: string
          position?: number
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bet_picks_bet_id_fkey'
            columns: ['bet_id']
            isOneToOne: false
            referencedRelation: 'bets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bet_picks_rider_id_fkey'
            columns: ['rider_id']
            isOneToOne: false
            referencedRelation: 'riders'
            referencedColumns: ['id']
          },
        ]
      }
      bets: {
        Row: {
          id: string
          race_id: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          race_id: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          race_id?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bets_race_id_fkey'
            columns: ['race_id']
            isOneToOne: false
            referencedRelation: 'races'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bets_race_id_fkey'
            columns: ['race_id']
            isOneToOne: false
            referencedRelation: 'races_view'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          code: string
          created_at: string
          id: string
          motogp_category_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          motogp_category_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          motogp_category_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      circuits: {
        Row: {
          city: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          id: string
          latitude: number | null
          layout_svg_url: string | null
          left_corners: number | null
          length_meters: number | null
          longitude: number | null
          motogp_circuit_id: string | null
          motogp_circuit_uuid: string | null
          name: string
          right_corners: number | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          layout_svg_url?: string | null
          left_corners?: number | null
          length_meters?: number | null
          longitude?: number | null
          motogp_circuit_id?: string | null
          motogp_circuit_uuid?: string | null
          name: string
          right_corners?: number | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          layout_svg_url?: string | null
          left_corners?: number | null
          length_meters?: number | null
          longitude?: number | null
          motogp_circuit_id?: string | null
          motogp_circuit_uuid?: string | null
          name?: string
          right_corners?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      constructors: {
        Row: {
          created_at: string
          id: string
          motogp_constructor_id: string | null
          motogp_legacy_id: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          motogp_constructor_id?: string | null
          motogp_legacy_id?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          motogp_constructor_id?: string | null
          motogp_legacy_id?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          circuit_id: string | null
          country_code: string | null
          created_at: string
          ends_at: string | null
          has_results: boolean
          id: string
          is_cancelled: boolean
          motogp_event_id: string
          motogp_event_uuid: string | null
          name: string
          round: number | null
          season_id: string
          short_name: string | null
          starts_at: string | null
          time_zone: string | null
          updated_at: string
        }
        Insert: {
          circuit_id?: string | null
          country_code?: string | null
          created_at?: string
          ends_at?: string | null
          has_results?: boolean
          id?: string
          is_cancelled?: boolean
          motogp_event_id: string
          motogp_event_uuid?: string | null
          name: string
          round?: number | null
          season_id: string
          short_name?: string | null
          starts_at?: string | null
          time_zone?: string | null
          updated_at?: string
        }
        Update: {
          circuit_id?: string | null
          country_code?: string | null
          created_at?: string
          ends_at?: string | null
          has_results?: boolean
          id?: string
          is_cancelled?: boolean
          motogp_event_id?: string
          motogp_event_uuid?: string | null
          name?: string
          round?: number | null
          season_id?: string
          short_name?: string | null
          starts_at?: string | null
          time_zone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_circuit_id_fkey'
            columns: ['circuit_id']
            isOneToOne: false
            referencedRelation: 'circuits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'events_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      race_result_entries: {
        Row: {
          championship_points: number | null
          constructor_id: string | null
          gap_laps: string | null
          gap_to_first: string | null
          id: string
          is_classified: boolean
          number: number | null
          position: number | null
          race_result_id: string
          rider_id: string
          status_raw: string | null
          team_name: string | null
          total_time: string | null
        }
        Insert: {
          championship_points?: number | null
          constructor_id?: string | null
          gap_laps?: string | null
          gap_to_first?: string | null
          id?: string
          is_classified?: boolean
          number?: number | null
          position?: number | null
          race_result_id: string
          rider_id: string
          status_raw?: string | null
          team_name?: string | null
          total_time?: string | null
        }
        Update: {
          championship_points?: number | null
          constructor_id?: string | null
          gap_laps?: string | null
          gap_to_first?: string | null
          id?: string
          is_classified?: boolean
          number?: number | null
          position?: number | null
          race_result_id?: string
          rider_id?: string
          status_raw?: string | null
          team_name?: string | null
          total_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'race_result_entries_constructor_id_fkey'
            columns: ['constructor_id']
            isOneToOne: false
            referencedRelation: 'constructors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'race_result_entries_race_result_id_fkey'
            columns: ['race_result_id']
            isOneToOne: false
            referencedRelation: 'race_results'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'race_result_entries_rider_id_fkey'
            columns: ['rider_id']
            isOneToOne: false
            referencedRelation: 'riders'
            referencedColumns: ['id']
          },
        ]
      }
      race_results: {
        Row: {
          created_at: string
          id: string
          imported_at: string
          race_id: string
          raw_payload: Json | null
          source: string
          status: Database['public']['Enums']['result_status']
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string
          race_id: string
          raw_payload?: Json | null
          source?: string
          status?: Database['public']['Enums']['result_status']
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string
          race_id?: string
          raw_payload?: Json | null
          source?: string
          status?: Database['public']['Enums']['result_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'race_results_race_id_fkey'
            columns: ['race_id']
            isOneToOne: true
            referencedRelation: 'races'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'race_results_race_id_fkey'
            columns: ['race_id']
            isOneToOne: true
            referencedRelation: 'races_view'
            referencedColumns: ['id']
          },
        ]
      }
      race_scores: {
        Row: {
          breakdown: Json
          computed_at: string
          exact_hits: number
          points: number
          race_id: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          computed_at?: string
          exact_hits?: number
          points?: number
          race_id: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          computed_at?: string
          exact_hits?: number
          points?: number
          race_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'race_scores_race_id_fkey'
            columns: ['race_id']
            isOneToOne: false
            referencedRelation: 'races'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'race_scores_race_id_fkey'
            columns: ['race_id']
            isOneToOne: false
            referencedRelation: 'races_view'
            referencedColumns: ['id']
          },
        ]
      }
      races: {
        Row: {
          betting_closes_at: string | null
          betting_closes_at_override: string | null
          category_id: string
          closes_at: string | null
          created_at: string
          event_id: string
          id: string
          is_cancelled: boolean
          kind: Database['public']['Enums']['session_kind']
          scheduled_at: string | null
          season_id: string
          session_id: string | null
          status_override: Database['public']['Enums']['race_status'] | null
          updated_at: string
        }
        Insert: {
          betting_closes_at?: string | null
          betting_closes_at_override?: string | null
          category_id: string
          closes_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_cancelled?: boolean
          kind: Database['public']['Enums']['session_kind']
          scheduled_at?: string | null
          season_id: string
          session_id?: string | null
          status_override?: Database['public']['Enums']['race_status'] | null
          updated_at?: string
        }
        Update: {
          betting_closes_at?: string | null
          betting_closes_at_override?: string | null
          category_id?: string
          closes_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_cancelled?: boolean
          kind?: Database['public']['Enums']['session_kind']
          scheduled_at?: string | null
          season_id?: string
          session_id?: string | null
          status_override?: Database['public']['Enums']['race_status'] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'races_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      rider_season_entries: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          number: number | null
          rider_id: string
          season_id: string
          sponsored_team: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          number?: number | null
          rider_id: string
          season_id: string
          sponsored_team?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          number?: number | null
          rider_id?: string
          season_id?: string
          sponsored_team?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rider_season_entries_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rider_season_entries_rider_id_fkey'
            columns: ['rider_id']
            isOneToOne: false
            referencedRelation: 'riders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rider_season_entries_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rider_season_entries_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      riders: {
        Row: {
          birth_city: string | null
          birth_date: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          first_name: string | null
          full_name: string
          headshot_url: string | null
          id: string
          is_retired: boolean
          last_name: string | null
          motogp_legacy_id: number | null
          motogp_rider_id: string
          nickname: string | null
          number_image_url: string | null
          photo_url: string | null
          start_year: number | null
          updated_at: string
        }
        Insert: {
          birth_city?: string | null
          birth_date?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          first_name?: string | null
          full_name: string
          headshot_url?: string | null
          id?: string
          is_retired?: boolean
          last_name?: string | null
          motogp_legacy_id?: number | null
          motogp_rider_id: string
          nickname?: string | null
          number_image_url?: string | null
          photo_url?: string | null
          start_year?: number | null
          updated_at?: string
        }
        Update: {
          birth_city?: string | null
          birth_date?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string
          headshot_url?: string | null
          id?: string
          is_retired?: boolean
          last_name?: string | null
          motogp_legacy_id?: number | null
          motogp_rider_id?: string
          nickname?: string | null
          number_image_url?: string | null
          photo_url?: string | null
          start_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      scoring_rules: {
        Row: {
          created_at: string
          id: string
          points_by_pattern: Json
          season_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_by_pattern?: Json
          season_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_by_pattern?: Json
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'scoring_rules_season_id_fkey'
            columns: ['season_id']
            isOneToOne: true
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      season_participants: {
        Row: {
          joined_at: string
          season_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          season_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'season_participants_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          starts_on: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_on?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_on?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          category_id: string
          code: string
          created_at: string
          event_id: string
          id: string
          is_bettable: boolean
          kind: Database['public']['Enums']['session_kind']
          motogp_session_id: string
          number: number | null
          scheduled_at: string | null
          type_code: string
          updated_at: string
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          event_id: string
          id?: string
          is_bettable?: boolean
          kind: Database['public']['Enums']['session_kind']
          motogp_session_id: string
          number?: number | null
          scheduled_at?: string | null
          type_code: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          event_id?: string
          id?: string
          is_bettable?: boolean
          kind?: Database['public']['Enums']['session_kind']
          motogp_session_id?: string
          number?: number | null
          scheduled_at?: string | null
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sessions_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job: Database['public']['Enums']['sync_job']
          season_id: string | null
          started_at: string
          state: Database['public']['Enums']['sync_state']
          stats: Json
          triggered_by: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job: Database['public']['Enums']['sync_job']
          season_id?: string | null
          started_at?: string
          state?: Database['public']['Enums']['sync_state']
          stats?: Json
          triggered_by?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: Database['public']['Enums']['sync_job']
          season_id?: string | null
          started_at?: string
          state?: Database['public']['Enums']['sync_state']
          stats?: Json
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sync_runs_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          constructor_id: string | null
          created_at: string
          id: string
          motogp_legacy_id: number | null
          motogp_team_id: string | null
          name: string
          picture_url: string | null
          text_color: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          constructor_id?: string | null
          created_at?: string
          id?: string
          motogp_legacy_id?: number | null
          motogp_team_id?: string | null
          name: string
          picture_url?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          constructor_id?: string | null
          created_at?: string
          id?: string
          motogp_legacy_id?: number | null
          motogp_team_id?: string | null
          name?: string
          picture_url?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teams_constructor_id_fkey'
            columns: ['constructor_id']
            isOneToOne: false
            referencedRelation: 'constructors'
            referencedColumns: ['id']
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database['public']['Enums']['app_role']
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      races_view: {
        Row: {
          category_code: string | null
          category_id: string | null
          category_name: string | null
          circuit_city: string | null
          circuit_country: string | null
          circuit_name: string | null
          closes_at: string | null
          country_code: string | null
          event_id: string | null
          event_name: string | null
          event_short_name: string | null
          has_official_result: boolean | null
          id: string | null
          is_cancelled: boolean | null
          kind: Database['public']['Enums']['session_kind'] | null
          layout_svg_url: string | null
          round: number | null
          scheduled_at: string | null
          season_id: string | null
          session_id: string | null
          status: Database['public']['Enums']['race_status'] | null
          time_zone: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'races_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'races_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      season_standings: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          position: number | null
          races_played: number | null
          season_id: string | null
          total_exact_hits: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'races_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      place_bet: {
        Args: { p_race_id: string; p_rider_ids: string[] }
        Returns: string
      }
      recalculate_race_scores: { Args: { p_race_id: string }; Returns: number }
    }
    Enums: {
      app_role: 'admin' | 'player'
      race_status: 'upcoming' | 'open' | 'closed' | 'finished' | 'cancelled'
      result_status: 'provisional' | 'official'
      session_kind:
        'fp' | 'practice' | 'qualifying' | 'sprint' | 'race' | 'warmup' | 'other'
      sync_job: 'calendar' | 'riders' | 'results' | 'backfill' | 'recalculate' | 'images'
      sync_state: 'running' | 'success' | 'failed' | 'partial'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ['admin', 'player'],
      race_status: ['upcoming', 'open', 'closed', 'finished', 'cancelled'],
      result_status: ['provisional', 'official'],
      session_kind: ['fp', 'practice', 'qualifying', 'sprint', 'race', 'warmup', 'other'],
      sync_job: ['calendar', 'riders', 'results', 'backfill', 'recalculate', 'images'],
      sync_state: ['running', 'success', 'failed', 'partial'],
    },
  },
} as const
