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
      app_state: {
        Row: {
          key: string
          updated_at: string | null
          user_id: string
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          user_id: string
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          user_id?: string
          value?: Json | null
        }
        Relationships: []
      }
      clearances: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          kind: Database["public"]["Enums"]["clearance_kind"]
          note: string | null
          phase_id: string | null
          recovery_id: string
          source: Database["public"]["Enums"]["clearance_source"]
          value_pct: number | null
          value_text: string | null
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          kind: Database["public"]["Enums"]["clearance_kind"]
          note?: string | null
          phase_id?: string | null
          recovery_id: string
          source: Database["public"]["Enums"]["clearance_source"]
          value_pct?: number | null
          value_text?: string | null
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          kind?: Database["public"]["Enums"]["clearance_kind"]
          note?: string | null
          phase_id?: string | null
          recovery_id?: string
          source?: Database["public"]["Enums"]["clearance_source"]
          value_pct?: number | null
          value_text?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clearances_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearances_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "recoveries"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checks: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          numbness: boolean | null
          pain_0_10: number | null
          recovery_id: string
          scale_recalibrated: boolean | null
          skin_check: boolean | null
          updated_at: string
          upright_minutes: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          numbness?: boolean | null
          pain_0_10?: number | null
          recovery_id: string
          scale_recalibrated?: boolean | null
          skin_check?: boolean | null
          updated_at?: string
          upright_minutes?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          numbness?: boolean | null
          pain_0_10?: number | null
          recovery_id?: string
          scale_recalibrated?: boolean | null
          skin_check?: boolean | null
          updated_at?: string
          upright_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checks_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "recoveries"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date: string
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          label: string
          note: string | null
          questions: string[]
          recovery_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          kind: Database["public"]["Enums"]["event_kind"]
          label: string
          note?: string | null
          questions?: string[]
          recovery_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          label?: string
          note?: string | null
          questions?: string[]
          recovery_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "recoveries"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_alternates: {
        Row: {
          _notion_id: string | null
          alternate_exercise_id: string
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          position: number
        }
        Insert: {
          _notion_id?: string | null
          alternate_exercise_id: string
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          position: number
        }
        Update: {
          _notion_id?: string | null
          alternate_exercise_id?: string
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_alternates_alternate_exercise_id_fkey"
            columns: ["alternate_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_alternates_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          _notion_id: string | null
          ankle_involvement: boolean | null
          created_at: string
          equipment_needed:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          equipment_type: Database["public"]["Enums"]["equipment_type"]
          floor_transfer_required: boolean | null
          id: string
          load_direction: Database["public"]["Enums"]["load_direction"] | null
          loads_booted_foot: boolean | null
          machine_location:
            | Database["public"]["Enums"]["machine_location"]
            | null
          max_sessions_per_week: number | null
          min_hours_between_sessions: number | null
          muscle_group_id: string | null
          name: string
          notes: string | null
          slug: string | null
          support_required: Database["public"]["Enums"]["support_type"] | null
          updated_at: string
          video_credit: string | null
          video_url: string | null
          video_verified_at: string | null
        }
        Insert: {
          _notion_id?: string | null
          ankle_involvement?: boolean | null
          created_at?: string
          equipment_needed?:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          equipment_type?: Database["public"]["Enums"]["equipment_type"]
          floor_transfer_required?: boolean | null
          id?: string
          load_direction?: Database["public"]["Enums"]["load_direction"] | null
          loads_booted_foot?: boolean | null
          machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          max_sessions_per_week?: number | null
          min_hours_between_sessions?: number | null
          muscle_group_id?: string | null
          name: string
          notes?: string | null
          slug?: string | null
          support_required?: Database["public"]["Enums"]["support_type"] | null
          updated_at?: string
          video_credit?: string | null
          video_url?: string | null
          video_verified_at?: string | null
        }
        Update: {
          _notion_id?: string | null
          ankle_involvement?: boolean | null
          created_at?: string
          equipment_needed?:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          equipment_type?: Database["public"]["Enums"]["equipment_type"]
          floor_transfer_required?: boolean | null
          id?: string
          load_direction?: Database["public"]["Enums"]["load_direction"] | null
          loads_booted_foot?: boolean | null
          machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          max_sessions_per_week?: number | null
          min_hours_between_sessions?: number | null
          muscle_group_id?: string | null
          name?: string
          notes?: string | null
          slug?: string | null
          support_required?: Database["public"]["Enums"]["support_type"] | null
          updated_at?: string
          video_credit?: string | null
          video_url?: string | null
          video_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          _notion_id: string | null
          created_at: string
          display_order: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          _notion_id?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          _notion_id?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_phases: {
        Row: {
          block: string | null
          created_at: string
          flag: string | null
          flag_source_id: string | null
          gate: string | null
          guidance: Json
          id: string
          label: string
          load_pct: number | null
          position: number
          program_id: string
          updated_at: string
          week_from: number
          week_to: number | null
        }
        Insert: {
          block?: string | null
          created_at?: string
          flag?: string | null
          flag_source_id?: string | null
          gate?: string | null
          guidance?: Json
          id?: string
          label: string
          load_pct?: number | null
          position: number
          program_id: string
          updated_at?: string
          week_from: number
          week_to?: number | null
        }
        Update: {
          block?: string | null
          created_at?: string
          flag?: string | null
          flag_source_id?: string | null
          gate?: string | null
          guidance?: Json
          id?: string
          label?: string
          load_pct?: number | null
          position?: number
          program_id?: string
          updated_at?: string
          week_from?: number
          week_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_phases_flag_source_id_fkey"
            columns: ["flag_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_phases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          authority_notes: string | null
          citation: string | null
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["program_kind"]
          name: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          authority_notes?: string | null
          citation?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["program_kind"]
          name: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          authority_notes?: string | null
          citation?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["program_kind"]
          name?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      recoveries: {
        Row: {
          created_at: string
          id: string
          injury_date: string
          label: string
          notes: string | null
          program_id: string
          side: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          injury_date: string
          label: string
          notes?: string | null
          program_id: string
          side: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          injury_date?: string
          label?: string
          notes?: string | null
          program_id?: string
          side?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recoveries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          active: boolean
          created_at: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["rule_kind"]
          position: number
          recovery_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["rule_kind"]
          position: number
          recovery_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["rule_kind"]
          position?: number
          recovery_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "recoveries"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          _notion_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_warm_up: boolean
          notes: string | null
          reps: number | null
          rpe: number | null
          seconds: number | null
          set_number: number
          weight: number | null
          workout_exercise_id: string
        }
        Insert: {
          _notion_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_warm_up?: boolean
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          seconds?: number | null
          set_number: number
          weight?: number | null
          workout_exercise_id: string
        }
        Update: {
          _notion_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_warm_up?: boolean
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          seconds?: number | null
          set_number?: number
          weight?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "v_workout_exercise_e1rm"
            referencedColumns: ["workout_exercise_id"]
          },
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "v_workout_exercise_tonnage"
            referencedColumns: ["workout_exercise_id"]
          },
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "v_workout_exercise_top_set"
            referencedColumns: ["workout_exercise_id"]
          },
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          citation: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["source_kind"]
          notes: string | null
          quality: string
          updated_at: string
          url: string | null
        }
        Insert: {
          citation: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["source_kind"]
          notes?: string | null
          quality: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          citation?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          notes?: string | null
          quality?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          _notion_id: string | null
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          override_reason: string | null
          override_rule: number | null
          position: number
          prescribed_reps_max: number | null
          prescribed_reps_min: number | null
          prescribed_rest_seconds: number | null
          prescribed_rir_max: number | null
          prescribed_rir_min: number | null
          prescribed_rpe: string | null
          prescribed_seconds_max: number | null
          prescribed_seconds_min: number | null
          prescribed_sets_max: number | null
          prescribed_sets_min: number | null
          template_id: string
          updated_at: string
          warm_up_sets_max: number | null
          warm_up_sets_min: number | null
        }
        Insert: {
          _notion_id?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          override_reason?: string | null
          override_rule?: number | null
          position: number
          prescribed_reps_max?: number | null
          prescribed_reps_min?: number | null
          prescribed_rest_seconds?: number | null
          prescribed_rir_max?: number | null
          prescribed_rir_min?: number | null
          prescribed_rpe?: string | null
          prescribed_seconds_max?: number | null
          prescribed_seconds_min?: number | null
          prescribed_sets_max?: number | null
          prescribed_sets_min?: number | null
          template_id: string
          updated_at?: string
          warm_up_sets_max?: number | null
          warm_up_sets_min?: number | null
        }
        Update: {
          _notion_id?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          override_reason?: string | null
          override_rule?: number | null
          position?: number
          prescribed_reps_max?: number | null
          prescribed_reps_min?: number | null
          prescribed_rest_seconds?: number | null
          prescribed_rir_max?: number | null
          prescribed_rir_min?: number | null
          prescribed_rpe?: string | null
          prescribed_seconds_max?: number | null
          prescribed_seconds_min?: number | null
          prescribed_sets_max?: number | null
          prescribed_sets_min?: number | null
          template_id?: string
          updated_at?: string
          warm_up_sets_max?: number | null
          warm_up_sets_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_phases: {
        Row: {
          phase_id: string
          position: number | null
          template_id: string
        }
        Insert: {
          phase_id: string
          position?: number | null
          template_id: string
        }
        Update: {
          phase_id?: string
          position?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_phases_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_phases_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          _notion_id: string | null
          category: Database["public"]["Enums"]["template_category"] | null
          created_at: string
          estimated_minutes: number | null
          id: string
          name: string
          notes: string | null
          program_id: string | null
          tutorial_url: string | null
          updated_at: string
          variant: string | null
        }
        Insert: {
          _notion_id?: string | null
          category?: Database["public"]["Enums"]["template_category"] | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          name: string
          notes?: string | null
          program_id?: string | null
          tutorial_url?: string | null
          updated_at?: string
          variant?: string | null
        }
        Update: {
          _notion_id?: string | null
          category?: Database["public"]["Enums"]["template_category"] | null
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          program_id?: string | null
          tutorial_url?: string | null
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          default_machine_location:
            | Database["public"]["Enums"]["machine_location"]
            | null
          default_rest_seconds: number
          equipment_available:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          updated_at: string
          user_id: string
          weight_unit: Database["public"]["Enums"]["weight_unit"]
        }
        Insert: {
          created_at?: string
          default_machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          default_rest_seconds?: number
          equipment_available?:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          updated_at?: string
          user_id: string
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
        }
        Update: {
          created_at?: string
          default_machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          default_rest_seconds?: number
          equipment_available?:
            | Database["public"]["Enums"]["equipment_item"][]
            | null
          updated_at?: string
          user_id?: string
          weight_unit?: Database["public"]["Enums"]["weight_unit"]
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          _notion_id: string | null
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          position: number
          prescribed_reps_max: number | null
          prescribed_reps_min: number | null
          prescribed_rest_seconds: number | null
          prescribed_rir_max: number | null
          prescribed_rir_min: number | null
          prescribed_rpe: string | null
          prescribed_seconds_max: number | null
          prescribed_seconds_min: number | null
          prescribed_sets_max: number | null
          prescribed_sets_min: number | null
          updated_at: string
          warm_up_sets_max: number | null
          warm_up_sets_min: number | null
          workout_id: string
        }
        Insert: {
          _notion_id?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          position: number
          prescribed_reps_max?: number | null
          prescribed_reps_min?: number | null
          prescribed_rest_seconds?: number | null
          prescribed_rir_max?: number | null
          prescribed_rir_min?: number | null
          prescribed_rpe?: string | null
          prescribed_seconds_max?: number | null
          prescribed_seconds_min?: number | null
          prescribed_sets_max?: number | null
          prescribed_sets_min?: number | null
          updated_at?: string
          warm_up_sets_max?: number | null
          warm_up_sets_min?: number | null
          workout_id: string
        }
        Update: {
          _notion_id?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          prescribed_reps_max?: number | null
          prescribed_reps_min?: number | null
          prescribed_rest_seconds?: number | null
          prescribed_rir_max?: number | null
          prescribed_rir_min?: number | null
          prescribed_rpe?: string | null
          prescribed_seconds_max?: number | null
          prescribed_seconds_min?: number | null
          prescribed_sets_max?: number | null
          prescribed_sets_min?: number | null
          updated_at?: string
          warm_up_sets_max?: number | null
          warm_up_sets_min?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          _notion_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          machine_location:
            | Database["public"]["Enums"]["machine_location"]
            | null
          notes: string | null
          perceived_effort: number | null
          scheduled_for: string | null
          started_at: string | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          _notion_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          notes?: string | null
          perceived_effort?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          _notion_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_location?:
            | Database["public"]["Enums"]["machine_location"]
            | null
          notes?: string | null
          perceived_effort?: number | null
          scheduled_for?: string | null
          started_at?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_muscle_group_weekly_sets: {
        Row: {
          muscle_group_id: string | null
          set_count: number | null
          user_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      v_user_weekly_workouts: {
        Row: {
          user_id: string | null
          week_start: string | null
          workout_count: number | null
        }
        Relationships: []
      }
      v_workout_exercise_e1rm: {
        Row: {
          estimated_1rm: number | null
          exercise_id: string | null
          reps: number | null
          user_id: string | null
          weight: number | null
          workout_completed_at: string | null
          workout_exercise_id: string | null
          workout_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_workout_exercise_tonnage: {
        Row: {
          exercise_id: string | null
          tonnage: number | null
          user_id: string | null
          working_set_count: number | null
          workout_exercise_id: string | null
          workout_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_workout_exercise_top_set: {
        Row: {
          completed_at: string | null
          exercise_id: string | null
          reps: number | null
          set_id: string | null
          user_id: string | null
          volume: number | null
          weight: number | null
          workout_completed_at: string | null
          workout_exercise_id: string | null
          workout_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      clearance_kind:
        | "weight_bearing"
        | "ankle_rom"
        | "wedge_removal"
        | "boot_weaning"
        | "out_of_boot"
        | "strength_gate"
      clearance_source: "clinic" | "self" | "planned"
      equipment_item:
        | "cable_tower"
        | "dumbbells"
        | "adjustable_bench"
        | "half_rack"
        | "pull_up_bar"
        | "plate_tree"
        | "mat"
        | "medicine_ball"
        | "stability_ball"
        | "treadmill"
        | "elliptical"
        | "stepper"
        | "spin_bike"
        | "upright_bike"
        | "resistance_band"
        | "hanging_ab_straps"
        | "barbell"
        | "rower"
        | "leg_press"
        | "calf_machine"
        | "assisted_pull_up"
        | "captains_chair"
        | "chest_press_machine"
        | "shoulder_press_machine"
        | "step_platform"
        | "bathroom_scale"
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "cardio_machine"
        | "other"
      event_kind: "appointment" | "milestone" | "reminder"
      load_direction: "vertical" | "sagittal" | "lateral" | "none"
      machine_location: "upstairs" | "downstairs"
      program_kind: "recovery" | "training"
      rule_kind: "rule" | "prohibition"
      source_kind:
        | "trial"
        | "review"
        | "cohort"
        | "handout"
        | "convention"
        | "anecdote"
      support_type:
        | "hanging"
        | "lying"
        | "seated_supported"
        | "standing_supported"
        | "standing_free"
      template_category:
        | "push"
        | "pull"
        | "legs"
        | "arms"
        | "full_body"
        | "cardio"
        | "abs"
      weight_unit: "lbs" | "kg"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      clearance_kind: [
        "weight_bearing",
        "ankle_rom",
        "wedge_removal",
        "boot_weaning",
        "out_of_boot",
        "strength_gate",
      ],
      clearance_source: ["clinic", "self", "planned"],
      equipment_item: [
        "cable_tower",
        "dumbbells",
        "adjustable_bench",
        "half_rack",
        "pull_up_bar",
        "plate_tree",
        "mat",
        "medicine_ball",
        "stability_ball",
        "treadmill",
        "elliptical",
        "stepper",
        "spin_bike",
        "upright_bike",
        "resistance_band",
        "hanging_ab_straps",
        "barbell",
        "rower",
        "leg_press",
        "calf_machine",
        "assisted_pull_up",
        "captains_chair",
        "chest_press_machine",
        "shoulder_press_machine",
        "step_platform",
        "bathroom_scale",
      ],
      equipment_type: [
        "barbell",
        "dumbbell",
        "machine",
        "cable",
        "bodyweight",
        "cardio_machine",
        "other",
      ],
      event_kind: ["appointment", "milestone", "reminder"],
      load_direction: ["vertical", "sagittal", "lateral", "none"],
      machine_location: ["upstairs", "downstairs"],
      program_kind: ["recovery", "training"],
      rule_kind: ["rule", "prohibition"],
      source_kind: [
        "trial",
        "review",
        "cohort",
        "handout",
        "convention",
        "anecdote",
      ],
      support_type: [
        "hanging",
        "lying",
        "seated_supported",
        "standing_supported",
        "standing_free",
      ],
      template_category: [
        "push",
        "pull",
        "legs",
        "arms",
        "full_body",
        "cardio",
        "abs",
      ],
      weight_unit: ["lbs", "kg"],
    },
  },
} as const
