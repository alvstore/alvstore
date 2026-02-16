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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          date: string
          device_id: string | null
          employee_id: string
          id: string
          notes: string | null
          source: Database["public"]["Enums"]["attendance_source"]
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          device_id?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["attendance_source"]
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          device_id?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          source?: Database["public"]["Enums"]["attendance_source"]
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          gst_number: string | null
          id: string
          integrations: Json | null
          invoice_prefix: string | null
          logo_url: string | null
          quotation_prefix: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          integrations?: Json | null
          invoice_prefix?: string | null
          logo_url?: string | null
          quotation_prefix?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          integrations?: Json | null
          invoice_prefix?: string | null
          logo_url?: string | null
          quotation_prefix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_number: string
          pos_transaction_id: string | null
          quotation_id: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_number?: string
          pos_transaction_id?: string | null
          quotation_id?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_number?: string
          pos_transaction_id?: string | null
          quotation_id?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          gst_amount: number
          id: string
          items: Json
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          subtotal: number
          total: number
          transaction_number: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gst_amount?: number
          id?: string
          items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          subtotal?: number
          total?: number
          transaction_number?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gst_amount?: number
          id?: string
          items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          subtotal?: number
          total?: number
          transaction_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gst_percentage: number | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          purchase_price: number | null
          selling_price: number | null
          sku: string | null
          stock_quantity: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          purchase_price?: number | null
          selling_price?: number | null
          sku?: string | null
          stock_quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          purchase_price?: number | null
          selling_price?: number | null
          sku?: string | null
          stock_quantity?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          gst_percentage: number | null
          id: string
          image_url: string | null
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          quotation_id: string
          total: number
          unit_price: number
        }
        Insert: {
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          quotation_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          quotation_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          gst_amount: number | null
          id: string
          notes: string | null
          public_token: string
          quotation_number: string
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number | null
          terms: string | null
          total: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          public_token?: string
          quotation_number: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          public_token?: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_images_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["repair_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["repair_status"] | null
          ticket_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["repair_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["repair_status"] | null
          ticket_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["repair_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["repair_status"] | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          assigned_technician_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          device_brand: string | null
          device_model: string | null
          device_type: string | null
          diagnosis_notes: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          issue_description: string | null
          priority: Database["public"]["Enums"]["repair_priority"]
          repair_notes: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["repair_status"]
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_technician_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type?: string | null
          diagnosis_notes?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          issue_description?: string | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          repair_notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          ticket_number?: string
          updated_at?: string
        }
        Update: {
          assigned_technician_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type?: string | null
          diagnosis_notes?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          issue_description?: string | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          repair_notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          subject: string | null
          type: Database["public"]["Enums"]["template_type"]
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          subject?: string | null
          type: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "technician" | "customer"
      attendance_source: "manual" | "biometric"
      payment_method_type: "cash" | "card" | "upi" | "online"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      payment_type: "invoice" | "pos" | "online"
      quotation_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      repair_priority: "low" | "normal" | "high" | "urgent"
      repair_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "waiting_parts"
        | "completed"
        | "delivered"
      stock_movement_type: "in" | "out" | "adjustment"
      template_type: "email" | "sms" | "invoice" | "quotation"
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
      app_role: ["admin", "staff", "technician", "customer"],
      attendance_source: ["manual", "biometric"],
      payment_method_type: ["cash", "card", "upi", "online"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      payment_type: ["invoice", "pos", "online"],
      quotation_status: ["draft", "sent", "accepted", "rejected", "expired"],
      repair_priority: ["low", "normal", "high", "urgent"],
      repair_status: [
        "pending",
        "assigned",
        "in_progress",
        "waiting_parts",
        "completed",
        "delivered",
      ],
      stock_movement_type: ["in", "out", "adjustment"],
      template_type: ["email", "sms", "invoice", "quotation"],
    },
  },
} as const
