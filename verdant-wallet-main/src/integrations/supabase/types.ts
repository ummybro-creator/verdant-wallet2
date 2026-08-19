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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          apk_url: string
          channel_url: string
          id: boolean
          level1_rate: number
          level2_rate: number
          level3_rate: number
          maintenance: boolean
          min_recharge: number
          min_withdraw: number
          payee_name: string
          recharge_presets: number[]
          support_url: string
          tax_percent: number
          updated_at: string
          upi_id: string
        }
        Insert: {
          apk_url?: string
          channel_url?: string
          id?: boolean
          level1_rate?: number
          level2_rate?: number
          level3_rate?: number
          maintenance?: boolean
          min_recharge?: number
          min_withdraw?: number
          payee_name?: string
          recharge_presets?: number[]
          support_url?: string
          tax_percent?: number
          updated_at?: string
          upi_id?: string
        }
        Update: {
          apk_url?: string
          channel_url?: string
          id?: boolean
          level1_rate?: number
          level2_rate?: number
          level3_rate?: number
          maintenance?: boolean
          min_recharge?: number
          min_withdraw?: number
          payee_name?: string
          recharge_presets?: number[]
          support_url?: string
          tax_percent?: number
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          upi_id: string | null
          user_id: string
          utr: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          upi_id?: string | null
          user_id: string
          utr: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          upi_id?: string | null
          user_id?: string
          utr?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          status: string
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          daily: number
          days: number
          id: string
          image: string
          kind: string
          name: string
          price: number
          sort: number
          total: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          daily: number
          days: number
          id?: string
          image?: string
          kind?: string
          name: string
          price: number
          sort?: number
          total: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          daily?: number
          days?: number
          id?: string
          image?: string
          kind?: string
          name?: string
          price?: number
          sort?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_number: string | null
          balance: number
          bank_name: string | null
          blocked: boolean
          created_at: string
          deposit_balance: number
          email: string | null
          fixed_income: number
          full_name: string | null
          id: string
          ifsc: string | null
          invite_code: string
          phone: string
          referred_by: string | null
          total_income: number
          total_recharge: number
          updated_at: string
          upi_id: string | null
          user_code: string
          vip: string
          withdraw_password: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          blocked?: boolean
          created_at?: string
          deposit_balance?: number
          email?: string | null
          fixed_income?: number
          full_name?: string | null
          id: string
          ifsc?: string | null
          invite_code: string
          phone: string
          referred_by?: string | null
          total_income?: number
          total_recharge?: number
          updated_at?: string
          upi_id?: string | null
          user_code: string
          vip?: string
          withdraw_password?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          blocked?: boolean
          created_at?: string
          deposit_balance?: number
          email?: string | null
          fixed_income?: number
          full_name?: string | null
          id?: string
          ifsc?: string | null
          invite_code?: string
          phone?: string
          referred_by?: string | null
          total_income?: number
          total_recharge?: number
          updated_at?: string
          upi_id?: string | null
          user_code?: string
          vip?: string
          withdraw_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          daily: number
          days: number
          ends_at: string
          id: string
          plan_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          daily: number
          days: number
          ends_at: string
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          daily?: number
          days?: number
          ends_at?: string
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          status?: string
          type?: string
          user_id?: string
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
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          destination: string | null
          id: string
          method: string
          net: number
          reviewed_at: string | null
          status: string
          tax: number
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          destination?: string | null
          id?: string
          method?: string
          net: number
          reviewed_at?: string | null
          status?: string
          tax?: number
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          destination?: string | null
          id?: string
          method?: string
          net?: number
          reviewed_at?: string | null
          status?: string
          tax?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { _amount: number; _note: string; _user_id: string }
        Returns: undefined
      }
      admin_review_deposit: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      admin_review_withdrawal: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      buy_plan: { Args: { _plan_id: string }; Returns: string }
      create_payment_request: { Args: { _amount: number }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_team: { Args: never; Returns: Json }
      request_withdrawal: {
        Args: { _amount: number; _password: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
