export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activities: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by: string
          done: boolean
          due_date: string | null
          id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by?: string
          done?: boolean
          due_date?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string
          email: string | null
          event_type_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          stage_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string
          email?: string | null
          event_type_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          stage_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string
          email?: string | null
          event_type_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_services: {
        Row: {
          created_at: string
          event_id: string
          id: string
          price_cents: number
          service_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          price_cents: number
          service_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          price_cents?: number
          service_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_services_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_services_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_financials"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_services_variant_id_service_id_fkey"
            columns: ["variant_id", "service_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id", "service_id"]
          },
        ]
      }
      event_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          canceled: boolean
          contact_id: string | null
          created_at: string
          discount_cents: number
          event_date: string
          event_time: string | null
          event_type_id: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          canceled?: boolean
          contact_id?: string | null
          created_at?: string
          discount_cents?: number
          event_date: string
          event_time?: string | null
          event_type_id: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          canceled?: boolean
          contact_id?: string | null
          created_at?: string
          discount_cents?: number
          event_date?: string
          event_time?: string | null
          event_type_id?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          position: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          name: string
          role_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          name: string
          role_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          name?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_services: {
        Row: {
          id: string
          price_cents: number
          proposal_id: string
          service_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          price_cents: number
          proposal_id: string
          service_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          price_cents?: number
          proposal_id?: string
          service_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_services_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_services_variant_id_service_id_fkey"
            columns: ["variant_id", "service_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id", "service_id"]
          },
        ]
      }
      proposals: {
        Row: {
          contact_id: string
          created_at: string
          discount_cents: number
          id: string
          notes: string | null
          sent_date: string
          status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          sent_date: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          sent_date?: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          manage_crm: boolean
          manage_events: boolean
          manage_finance: boolean
          manage_settings: boolean
          manage_team: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          manage_crm?: boolean
          manage_events?: boolean
          manage_finance?: boolean
          manage_settings?: boolean
          manage_team?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          manage_crm?: boolean
          manage_events?: boolean
          manage_finance?: boolean
          manage_settings?: boolean
          manage_team?: boolean
          name?: string
        }
        Relationships: []
      }
      service_variants: {
        Row: {
          active: boolean
          created_at: string
          default_price_cents: number
          id: string
          name: string
          service_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_price_cents: number
          id?: string
          name: string
          service_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_price_cents?: number
          id?: string
          name?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          default_price_cents: number | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_price_cents?: number | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_price_cents?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          pay_notes: string | null
          phone: string | null
          role_label: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          pay_notes?: string | null
          phone?: string | null
          role_label: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          pay_notes?: string | null
          phone?: string | null
          role_label?: string
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          category_id: string
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
        }
        Insert: {
          amount_cents: number
          category_id: string
          created_at?: string
          created_by?: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
        }
        Update: {
          amount_cents?: number
          category_id?: string
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_kind_fkey"
            columns: ["category_id", "kind"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id", "kind"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_financials"
            referencedColumns: ["event_id"]
          },
        ]
      }
    }
    Views: {
      v_cash_position: {
        Row: {
          cash_cents: number | null
        }
        Relationships: []
      }
      v_category_expenses: {
        Row: {
          category_id: string | null
          category_name: string | null
          date: string | null
          total_cents: number | null
        }
        Relationships: []
      }
      v_event_financials: {
        Row: {
          contract_cents: number | null
          cost_cents: number | null
          event_id: string | null
          profit_cents: number | null
          receivable_cents: number | null
          received_cents: number | null
        }
        Relationships: []
      }
      v_monthly_flow: {
        Row: {
          expenses_cents: number | null
          month: string | null
          profit_cents: number | null
          revenue_cents: number | null
        }
        Relationships: []
      }
      v_service_sales: {
        Row: {
          closed_at: string | null
          event_id: string | null
          event_service_id: string | null
          price_cents: number | null
          service_id: string | null
          service_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_services_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_services_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_financials"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      convert_lead: {
        Args: {
          p_contact_id: string
          p_event_date: string
          p_event_name: string
          p_event_time?: string
          p_proposal_id: string
        }
        Returns: string
      }
      create_proposal_with_items: {
        Args: {
          p_contact_id: string
          p_discount_cents: number
          p_items?: Json
          p_notes?: string
          p_sent_date: string
        }
        Returns: string
      }
      has_perm: { Args: { p_permission: string }; Returns: boolean }
      reorder_stages: { Args: { p_ordered_ids: string[] }; Returns: undefined }
      set_pipeline_stage_active: {
        Args: { p_active: boolean; p_stage_id: string }
        Returns: {
          active: boolean
          created_at: string
          id: string
          name: string
          position: number
        }
        SetofOptions: {
          from: "*"
          to: "pipeline_stages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_transaction: { Args: { p_transaction_id: string }; Returns: string }
    }
    Enums: {
      proposal_status: "sent" | "accepted" | "rejected"
      transaction_kind: "in" | "out"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      proposal_status: ["sent", "accepted", "rejected"],
      transaction_kind: ["in", "out"],
    },
  },
} as const
