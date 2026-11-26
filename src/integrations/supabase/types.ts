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
      apple_offers: {
        Row: {
          applicable_category: string
          applicable_product: string | null
          bank_name: string | null
          created_at: string | null
          discount_amount: number | null
          discount_description: string | null
          end_date: string | null
          id: string
          offer_type: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          applicable_category: string
          applicable_product?: string | null
          bank_name?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_description?: string | null
          end_date?: string | null
          id?: string
          offer_type: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          applicable_category?: string
          applicable_product?: string | null
          bank_name?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_description?: string | null
          end_date?: string | null
          id?: string
          offer_type?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      apple_pricing_rules: {
        Row: {
          cash_discount_mode: string | null
          cash_discount_type: string | null
          cash_discount_value: number | null
          category: string
          created_at: string | null
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          rule_name: string | null
          status: string | null
        }
        Insert: {
          cash_discount_mode?: string | null
          cash_discount_type?: string | null
          cash_discount_value?: number | null
          category: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          rule_name?: string | null
          status?: string | null
        }
        Update: {
          cash_discount_mode?: string | null
          cash_discount_type?: string | null
          cash_discount_value?: number | null
          category?: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          rule_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      apple_products: {
        Row: {
          alp_ex_vat: number
          category: string
          created_at: string | null
          description: string
          gst_percentage: number | null
          id: string
          is_new: boolean | null
          mrp: number
          part_number: string
          sap_description: string | null
          status: string | null
          subcategory: string | null
        }
        Insert: {
          alp_ex_vat?: number
          category: string
          created_at?: string | null
          description: string
          gst_percentage?: number | null
          id?: string
          is_new?: boolean | null
          mrp?: number
          part_number: string
          sap_description?: string | null
          status?: string | null
          subcategory?: string | null
        }
        Update: {
          alp_ex_vat?: number
          category?: string
          created_at?: string | null
          description?: string
          gst_percentage?: number | null
          id?: string
          is_new?: boolean | null
          mrp?: number
          part_number?: string
          sap_description?: string | null
          status?: string | null
          subcategory?: string | null
        }
        Relationships: []
      }
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
          bank_account_number: string | null
          bank_branch: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bank_upi_id: string | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          created_at: string
          default_cgst_rate: number | null
          default_igst_rate: number | null
          default_sgst_rate: number | null
          gst_number: string | null
          gst_state_code: string | null
          gst_type: string | null
          hsn_default: string | null
          id: string
          integrations: Json | null
          invoice_prefix: string | null
          logo_url: string | null
          quotation_prefix: string | null
          timezone: string | null
          updated_at: string
          whatsapp_api_key: string | null
          whatsapp_api_url: string | null
          whatsapp_phone_id: string | null
        }
        Insert: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bank_upi_id?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_cgst_rate?: number | null
          default_igst_rate?: number | null
          default_sgst_rate?: number | null
          gst_number?: string | null
          gst_state_code?: string | null
          gst_type?: string | null
          hsn_default?: string | null
          id?: string
          integrations?: Json | null
          invoice_prefix?: string | null
          logo_url?: string | null
          quotation_prefix?: string | null
          timezone?: string | null
          updated_at?: string
          whatsapp_api_key?: string | null
          whatsapp_api_url?: string | null
          whatsapp_phone_id?: string | null
        }
        Update: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bank_upi_id?: string | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_cgst_rate?: number | null
          default_igst_rate?: number | null
          default_sgst_rate?: number | null
          gst_number?: string | null
          gst_state_code?: string | null
          gst_type?: string | null
          hsn_default?: string | null
          id?: string
          integrations?: Json | null
          invoice_prefix?: string | null
          logo_url?: string | null
          quotation_prefix?: string | null
          timezone?: string | null
          updated_at?: string
          whatsapp_api_key?: string | null
          whatsapp_api_url?: string | null
          whatsapp_phone_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          category: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string
          title: string
        }
        Insert: {
          all_day?: boolean | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date: string
          title: string
        }
        Update: {
          all_day?: boolean | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          channel: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          participant_ids: string[]
          title: string | null
          type: string
          whatsapp_phone: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_ids?: string[]
          title?: string | null
          type?: string
          whatsapp_phone?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_ids?: string[]
          title?: string | null
          type?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel: string | null
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          read_at: string | null
          sender_id: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          channel?: string | null
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          channel?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          issue_category_id: string | null
          options: Json | null
          sort_order: number | null
          stage: string
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          issue_category_id?: string | null
          options?: Json | null
          sort_order?: number | null
          stage?: string
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          issue_category_id?: string | null
          options?: Json | null
          sort_order?: number | null
          stage?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_issue_category_id_fkey"
            columns: ["issue_category_id"]
            isOneToOne: false
            referencedRelation: "issue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          avatar_url: string | null
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
          shipping_address: string | null
          shipping_city: string | null
          shipping_pincode: string | null
          shipping_state: string | null
          state: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
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
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_pincode?: string | null
          shipping_state?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
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
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_pincode?: string | null
          shipping_state?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_cash_control: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          created_by: string | null
          date: string
          denominations: Json | null
          difference: number | null
          expected_closing: number | null
          id: string
          manual_expense: number | null
          manual_income: number | null
          notes: string | null
          opening_cash: number
          pos_total: number | null
          staff_name: string | null
          status: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          denominations?: Json | null
          difference?: number | null
          expected_closing?: number | null
          id?: string
          manual_expense?: number | null
          manual_income?: number | null
          notes?: string | null
          opening_cash?: number
          pos_total?: number | null
          staff_name?: string | null
          status?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          denominations?: Json | null
          difference?: number | null
          expected_closing?: number | null
          id?: string
          manual_expense?: number | null
          manual_income?: number | null
          notes?: string | null
          opening_cash?: number
          pos_total?: number | null
          staff_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      delivery_challan_items: {
        Row: {
          challan_id: string
          gst_amount: number | null
          gst_percentage: number | null
          hsn_code: string | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          challan_id: string
          gst_amount?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          challan_id?: string
          gst_amount?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challan_items_challan_id_fkey"
            columns: ["challan_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          challan_number: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_person: string | null
          gst_amount: number | null
          gst_inclusive: boolean | null
          id: string
          invoice_id: string | null
          notes: string | null
          receiver_signature: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string | null
          vehicle_number: string | null
        }
        Insert: {
          challan_number?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_person?: string | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          receiver_signature?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          vehicle_number?: string | null
        }
        Update: {
          challan_number?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivery_person?: string | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          receiver_signature?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          device_department_id: string | null
          device_id: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          device_department_id?: string | null
          device_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          device_department_id?: string | null
          device_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "hikvision_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      device_brands: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      device_models: {
        Row: {
          brand: string
          color_options: Json | null
          created_at: string
          device_type: string
          id: string
          is_active: boolean
          name: string
          series: string | null
          sort_order: number
          storage_options: Json | null
        }
        Insert: {
          brand: string
          color_options?: Json | null
          created_at?: string
          device_type: string
          id?: string
          is_active?: boolean
          name: string
          series?: string | null
          sort_order?: number
          storage_options?: Json | null
        }
        Update: {
          brand?: string
          color_options?: Json | null
          created_at?: string
          device_type?: string
          id?: string
          is_active?: boolean
          name?: string
          series?: string | null
          sort_order?: number
          storage_options?: Json | null
        }
        Relationships: []
      }
      device_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          department_id: string | null
          designation: string | null
          device_employee_code: string | null
          email: string | null
          employee_type: string | null
          id: string
          joining_date: string | null
          name: string
          phone: string | null
          role: string | null
          salary: number | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          device_employee_code?: string | null
          email?: string | null
          employee_type?: string | null
          id?: string
          joining_date?: string | null
          name: string
          phone?: string | null
          role?: string | null
          salary?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          device_employee_code?: string | null
          email?: string | null
          employee_type?: string | null
          id?: string
          joining_date?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          salary?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          name: string
          opening_balance: number
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          name: string
          opening_balance?: number
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          name?: string
          opening_balance?: number
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          staff_name: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          staff_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          staff_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          balance_after: number | null
          category_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          description: string | null
          id: string
          payment_mode: string | null
          reference: string | null
          staff_name: string | null
          to_account_id: string | null
          transaction_id: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          balance_after?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          description?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
          staff_name?: string | null
          to_account_id?: string | null
          transaction_id?: string
          type: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          balance_after?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          description?: string | null
          id?: string
          payment_mode?: string | null
          reference?: string | null
          staff_name?: string | null
          to_account_id?: string | null
          transaction_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          next_follow_up_date: string | null
          note: string
          outcome: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          next_follow_up_date?: string | null
          note: string
          outcome?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          next_follow_up_date?: string | null
          note?: string
          outcome?: string | null
        }
        Relationships: []
      }
      hikvision_attendance_logs: {
        Row: {
          attendance_status: string | null
          created_at: string
          dedupe_key: string | null
          device_id: string | null
          device_ip: string | null
          device_name: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          event_serial_no: string | null
          event_time: string
          event_type: string | null
          id: string
          raw_data: Json | null
          source_mode: string | null
          verify_mode: string | null
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string
          dedupe_key?: string | null
          device_id?: string | null
          device_ip?: string | null
          device_name?: string | null
          employee_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          event_serial_no?: string | null
          event_time: string
          event_type?: string | null
          id?: string
          raw_data?: Json | null
          source_mode?: string | null
          verify_mode?: string | null
        }
        Update: {
          attendance_status?: string | null
          created_at?: string
          dedupe_key?: string | null
          device_id?: string | null
          device_ip?: string | null
          device_name?: string | null
          employee_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          event_serial_no?: string | null
          event_time?: string
          event_type?: string | null
          id?: string
          raw_data?: Json | null
          source_mode?: string | null
          verify_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hikvision_attendance_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "hikvision_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hikvision_attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hikvision_devices: {
        Row: {
          created_at: string
          created_by: string | null
          device_model: string | null
          device_serial: string | null
          device_version: string | null
          id: string
          ip_address: string
          last_sync_at: string | null
          name: string
          password: string | null
          port: number
          site_id: string | null
          site_name: string | null
          status: string
          username: string | null
          zone: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          device_serial?: string | null
          device_version?: string | null
          id?: string
          ip_address: string
          last_sync_at?: string | null
          name: string
          password?: string | null
          port?: number
          site_id?: string | null
          site_name?: string | null
          status?: string
          username?: string | null
          zone?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          device_serial?: string | null
          device_version?: string | null
          id?: string
          ip_address?: string
          last_sync_at?: string | null
          name?: string
          password?: string | null
          port?: number
          site_id?: string | null
          site_name?: string | null
          status?: string
          username?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      hikvision_employee_mapping: {
        Row: {
          avatar_synced: boolean | null
          card_number: string | null
          created_at: string
          department_name: string | null
          device_employee_code: string
          device_employee_name: string | null
          device_id: string | null
          erp_employee_id: string | null
          id: string
          synced_at: string | null
        }
        Insert: {
          avatar_synced?: boolean | null
          card_number?: string | null
          created_at?: string
          department_name?: string | null
          device_employee_code: string
          device_employee_name?: string | null
          device_id?: string | null
          erp_employee_id?: string | null
          id?: string
          synced_at?: string | null
        }
        Update: {
          avatar_synced?: boolean | null
          card_number?: string | null
          created_at?: string
          department_name?: string | null
          device_employee_code?: string
          device_employee_name?: string | null
          device_id?: string | null
          erp_employee_id?: string | null
          id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hikvision_employee_mapping_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "hikvision_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hikvision_employee_mapping_erp_employee_id_fkey"
            columns: ["erp_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hikvision_sync_log: {
        Row: {
          action: string
          created_at: string
          device_id: string | null
          error_message: string | null
          id: string
          records_synced: number | null
          status: string
          sync_type: string | null
        }
        Insert: {
          action: string
          created_at?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          status?: string
          sync_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hikvision_sync_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "hikvision_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string | null
          discount_type: string | null
          discount_value: number | null
          gst_percentage: number | null
          hsn_code: string | null
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          gst_amount: number | null
          gst_inclusive: boolean | null
          id: string
          invoice_number: string
          job_sheet_id: string | null
          notes: string | null
          paid_amount: number | null
          payment_status: string | null
          payment_terms: string | null
          public_token: string | null
          quotation_id: string | null
          salesperson_id: string | null
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          status: string | null
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          invoice_number?: string
          job_sheet_id?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          payment_terms?: string | null
          public_token?: string | null
          quotation_id?: string | null
          salesperson_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          invoice_number?: string
          job_sheet_id?: string | null
          notes?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          payment_terms?: string | null
          public_token?: string | null
          quotation_id?: string | null
          salesperson_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      job_sheet_audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          job_sheet_id: string
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          job_sheet_id: string
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          job_sheet_id?: string
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheet_audit_log_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheet_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_type: string
          image_url: string
          job_sheet_id: string
          stage: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_type?: string
          image_url: string
          job_sheet_id: string
          stage?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_type?: string
          image_url?: string
          job_sheet_id?: string
          stage?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheet_images_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sheets: {
        Row: {
          actual_cost: number | null
          apple_id: string | null
          apple_id_password: string | null
          approval_ip: string | null
          approval_status: string | null
          approval_timestamp: string | null
          assigned_technician_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_approved_at: string | null
          delivery_signature_data: string | null
          delivery_signature_name: string | null
          device_brand: string
          device_color: string | null
          device_lock_code: string | null
          device_model: string | null
          device_received_at: string | null
          device_received_by: string | null
          device_sent_at: string | null
          device_sent_by: string | null
          device_type: string
          discount_type: string | null
          discount_value: number | null
          estimated_completion: string | null
          estimated_cost: number | null
          final_cost: number | null
          google_account: string | null
          google_account_password: string | null
          gst_amount: number | null
          gst_mode: string | null
          gst_percentage: number | null
          id: string
          imei_number: string | null
          invoice_id: string | null
          issue_category_id: string | null
          issue_tags: Json | null
          job_number: string
          parts_total: number | null
          payment_status: string | null
          post_repair_checklist: Json | null
          pre_repair_checklist: Json | null
          priority: Database["public"]["Enums"]["repair_priority"]
          problem_description: string
          public_token: string
          repair_notes: string | null
          serial_number: string | null
          service_charge: number | null
          service_items: Json | null
          staff_notes: string | null
          status: Database["public"]["Enums"]["job_sheet_status"]
          storage_capacity: string | null
          technician_payment: number | null
          technician_payment_date: string | null
          technician_payment_status: string | null
          total_amount: number | null
          updated_at: string
          warranty_days: number | null
          warranty_start_date: string | null
          warranty_terms: string | null
        }
        Insert: {
          actual_cost?: number | null
          apple_id?: string | null
          apple_id_password?: string | null
          approval_ip?: string | null
          approval_status?: string | null
          approval_timestamp?: string | null
          assigned_technician_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_approved_at?: string | null
          delivery_signature_data?: string | null
          delivery_signature_name?: string | null
          device_brand: string
          device_color?: string | null
          device_lock_code?: string | null
          device_model?: string | null
          device_received_at?: string | null
          device_received_by?: string | null
          device_sent_at?: string | null
          device_sent_by?: string | null
          device_type: string
          discount_type?: string | null
          discount_value?: number | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          google_account?: string | null
          google_account_password?: string | null
          gst_amount?: number | null
          gst_mode?: string | null
          gst_percentage?: number | null
          id?: string
          imei_number?: string | null
          invoice_id?: string | null
          issue_category_id?: string | null
          issue_tags?: Json | null
          job_number?: string
          parts_total?: number | null
          payment_status?: string | null
          post_repair_checklist?: Json | null
          pre_repair_checklist?: Json | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          problem_description: string
          public_token?: string
          repair_notes?: string | null
          serial_number?: string | null
          service_charge?: number | null
          service_items?: Json | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["job_sheet_status"]
          storage_capacity?: string | null
          technician_payment?: number | null
          technician_payment_date?: string | null
          technician_payment_status?: string | null
          total_amount?: number | null
          updated_at?: string
          warranty_days?: number | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Update: {
          actual_cost?: number | null
          apple_id?: string | null
          apple_id_password?: string | null
          approval_ip?: string | null
          approval_status?: string | null
          approval_timestamp?: string | null
          assigned_technician_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_approved_at?: string | null
          delivery_signature_data?: string | null
          delivery_signature_name?: string | null
          device_brand?: string
          device_color?: string | null
          device_lock_code?: string | null
          device_model?: string | null
          device_received_at?: string | null
          device_received_by?: string | null
          device_sent_at?: string | null
          device_sent_by?: string | null
          device_type?: string
          discount_type?: string | null
          discount_value?: number | null
          estimated_completion?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          google_account?: string | null
          google_account_password?: string | null
          gst_amount?: number | null
          gst_mode?: string | null
          gst_percentage?: number | null
          id?: string
          imei_number?: string | null
          invoice_id?: string | null
          issue_category_id?: string | null
          issue_tags?: Json | null
          job_number?: string
          parts_total?: number | null
          payment_status?: string | null
          post_repair_checklist?: Json | null
          pre_repair_checklist?: Json | null
          priority?: Database["public"]["Enums"]["repair_priority"]
          problem_description?: string
          public_token?: string
          repair_notes?: string | null
          serial_number?: string | null
          service_charge?: number | null
          service_items?: Json | null
          staff_notes?: string | null
          status?: Database["public"]["Enums"]["job_sheet_status"]
          storage_capacity?: string | null
          technician_payment?: number | null
          technician_payment_date?: string | null
          technician_payment_status?: string | null
          total_amount?: number | null
          updated_at?: string
          warranty_days?: number | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sheets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sheets_issue_category_id_fkey"
            columns: ["issue_category_id"]
            isOneToOne: false
            referencedRelation: "issue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          outcome: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          outcome?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          outcome?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_customer_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expected_value: number | null
          id: string
          lost_reason: string | null
          name: string
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          score: number | null
          source: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          name: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expected_value?: number | null
          id?: string
          lost_reason?: string | null
          name?: string
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_feed: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_register: {
        Row: {
          bank_charges: number
          bank_name: string | null
          card_network: string | null
          card_type: string | null
          cheque_clearance_date: string | null
          cheque_deposit_date: string | null
          cheque_number: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string
          deposit_bank_name: string | null
          difference_amount: number | null
          difference_type: string | null
          document_url: string | null
          id: string
          invoice_amount: number
          invoice_id: string | null
          invoice_number: string | null
          mdr_percentage: number | null
          net_received_amount: number | null
          notes: string | null
          payment_mode: string
          payment_sub_mode: string | null
          received_amount: number
          register_number: string
          settlement_date: string | null
          status: string
          transaction_date: string
          transaction_reference: string | null
        }
        Insert: {
          bank_charges?: number
          bank_name?: string | null
          card_network?: string | null
          card_type?: string | null
          cheque_clearance_date?: string | null
          cheque_deposit_date?: string | null
          cheque_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          deposit_bank_name?: string | null
          difference_amount?: number | null
          difference_type?: string | null
          document_url?: string | null
          id?: string
          invoice_amount?: number
          invoice_id?: string | null
          invoice_number?: string | null
          mdr_percentage?: number | null
          net_received_amount?: number | null
          notes?: string | null
          payment_mode?: string
          payment_sub_mode?: string | null
          received_amount?: number
          register_number?: string
          settlement_date?: string | null
          status?: string
          transaction_date?: string
          transaction_reference?: string | null
        }
        Update: {
          bank_charges?: number
          bank_name?: string | null
          card_network?: string | null
          card_type?: string | null
          cheque_clearance_date?: string | null
          cheque_deposit_date?: string | null
          cheque_number?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          deposit_bank_name?: string | null
          difference_amount?: number | null
          difference_type?: string | null
          document_url?: string | null
          id?: string
          invoice_amount?: number
          invoice_id?: string | null
          invoice_number?: string | null
          mdr_percentage?: number | null
          net_received_amount?: number | null
          notes?: string | null
          payment_mode?: string
          payment_sub_mode?: string | null
          received_amount?: number
          register_number?: string
          settlement_date?: string | null
          status?: string
          transaction_date?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_register_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_register_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          job_sheet_id: string | null
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
          job_sheet_id?: string | null
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
          job_sheet_id?: string | null
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
            foreignKeyName: "payments_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
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
      payroll: {
        Row: {
          basic_salary: number | null
          bonus: number | null
          created_at: string
          created_by: string | null
          deductions: number | null
          employee_id: string
          id: string
          month: string
          net_salary: number | null
          notes: string | null
          paid_date: string | null
          payment_status: string | null
        }
        Insert: {
          basic_salary?: number | null
          bonus?: number | null
          created_at?: string
          created_by?: string | null
          deductions?: number | null
          employee_id: string
          id?: string
          month: string
          net_salary?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
        }
        Update: {
          basic_salary?: number | null
          bonus?: number | null
          created_at?: string
          created_by?: string | null
          deductions?: number | null
          employee_id?: string
          id?: string
          month?: string
          net_salary?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      purchase_bill_items: {
        Row: {
          batch_number: string | null
          bill_id: string
          expiry_date: string | null
          gst_percentage: number | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          serial_numbers: string[] | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          batch_number?: string | null
          bill_id: string
          expiry_date?: string | null
          gst_percentage?: number | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          serial_numbers?: string[] | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          batch_number?: string | null
          bill_id?: string
          expiry_date?: string | null
          gst_percentage?: number | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          serial_numbers?: string[] | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_bills: {
        Row: {
          bill_date: string | null
          bill_number: string
          created_at: string | null
          created_by: string | null
          discount_value: number | null
          due_date: string | null
          gst_amount: number | null
          id: string
          notes: string | null
          paid_amount: number | null
          payment_status: string | null
          po_id: string | null
          status: string | null
          subtotal: number | null
          supplier_id: string | null
          total: number | null
        }
        Insert: {
          bill_date?: string | null
          bill_number?: string
          created_at?: string | null
          created_by?: string | null
          discount_value?: number | null
          due_date?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          po_id?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
        }
        Update: {
          bill_date?: string | null
          bill_number?: string
          created_at?: string | null
          created_by?: string | null
          discount_value?: number | null
          due_date?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          po_id?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bills_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          gst_percentage: number | null
          id: string
          po_id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          received_quantity: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          gst_percentage?: number | null
          id?: string
          po_id: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          received_quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          gst_percentage?: number | null
          id?: string
          po_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          received_quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          expected_date: string | null
          gst_amount: number | null
          id: string
          notes: string | null
          po_number: string
          status: string | null
          subtotal: number | null
          supplier_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          po_number?: string
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expected_date?: string | null
          gst_amount?: number | null
          id?: string
          notes?: string | null
          po_number?: string
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          return_id: string
          total: number | null
          unit_price: number | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          return_id: string
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          return_id?: string
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          bill_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          reason: string | null
          return_number: string
          status: string | null
          subtotal: number | null
          supplier_id: string | null
          total: number | null
        }
        Insert: {
          bill_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          return_number?: string
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
        }
        Update: {
          bill_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          return_number?: string
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          description: string | null
          discount_type: string | null
          discount_value: number | null
          gst_percentage: number | null
          hsn_code: string | null
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
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
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
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_percentage?: number | null
          hsn_code?: string | null
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
          converted_invoice_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_type: string | null
          discount_value: number | null
          gst_amount: number | null
          gst_inclusive: boolean | null
          id: string
          last_viewed_at: string | null
          notes: string | null
          payment_terms: string | null
          public_token: string
          quotation_number: string
          reminder_sent_at: string | null
          salesperson_id: string | null
          signature_data: string | null
          signature_name: string | null
          signed_at: string | null
          signed_ip: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number | null
          terms: string | null
          total: number | null
          updated_at: string
          valid_until: string | null
          view_count: number | null
        }
        Insert: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          payment_terms?: string | null
          public_token?: string
          quotation_number: string
          reminder_sent_at?: string | null
          salesperson_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number | null
        }
        Update: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          gst_amount?: number | null
          gst_inclusive?: boolean | null
          id?: string
          last_viewed_at?: string | null
          notes?: string | null
          payment_terms?: string | null
          public_token?: string
          quotation_number?: string
          reminder_sent_at?: string | null
          salesperson_id?: string | null
          signature_data?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number | null
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
      repair_parts: {
        Row: {
          cost: number
          created_at: string
          gst_percentage: number | null
          id: string
          job_sheet_id: string
          name: string
          quantity: number
          total: number
        }
        Insert: {
          cost?: number
          created_at?: string
          gst_percentage?: number | null
          id?: string
          job_sheet_id: string
          name: string
          quantity?: number
          total?: number
        }
        Update: {
          cost?: number
          created_at?: string
          gst_percentage?: number | null
          id?: string
          job_sheet_id?: string
          name?: string
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
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
      service_charge_categories: {
        Row: {
          created_at: string
          default_charge: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_charge?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_charge?: number
          id?: string
          name?: string
        }
        Relationships: []
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
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          name: string
          outstanding_balance: number | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          outstanding_balance?: number | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          outstanding_balance?: number | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_audit_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          module: string | null
          staff_name: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          staff_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string | null
          staff_name?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      technician_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          finance_transaction_id: string | null
          id: string
          job_sheet_id: string | null
          notes: string | null
          payment_date: string | null
          payment_mode: string | null
          status: string
          technician_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          finance_transaction_id?: string | null
          id?: string
          job_sheet_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          status?: string
          technician_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          finance_transaction_id?: string | null
          id?: string
          job_sheet_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_mode?: string | null
          status?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_payments_job_sheet_id_fkey"
            columns: ["job_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_type: string | null
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
          event_type?: string | null
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
          event_type?: string | null
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
      whatsapp_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          lead_id: string | null
          phone_number: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          phone_number: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          lead_id?: string | null
          phone_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          lead_id: string | null
          media_url: string | null
          status: string
          timestamp: string
          type: string
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string | null
          media_url?: string | null
          status?: string
          timestamp?: string
          type?: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string | null
          media_url?: string | null
          status?: string
          timestamp?: string
          type?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      job_sheet_status:
        | "created"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "assigned"
        | "in_progress"
        | "waiting_parts"
        | "repair_completed"
        | "quality_check"
        | "invoice_generated"
        | "delivered"
        | "qc_failed"
        | "ready_for_delivery"
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
      job_sheet_status: [
        "created",
        "pending_approval",
        "approved",
        "rejected",
        "assigned",
        "in_progress",
        "waiting_parts",
        "repair_completed",
        "quality_check",
        "invoice_generated",
        "delivered",
        "qc_failed",
        "ready_for_delivery",
      ],
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
