export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      booking_clients: {
        Row: {
          booking_id: number
          client_id: number
          id: number
        }
        Insert: {
          booking_id: number
          client_id: number
          id?: number
        }
        Update: {
          booking_id?: number
          client_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_clients_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pets: {
        Row: {
          booking_id: number
          created_at: string
          id: number
          pet_id: number
        }
        Insert: {
          booking_id: number
          created_at?: string
          id?: number
          pet_id: number
        }
        Update: {
          booking_id?: number
          created_at?: string
          id?: number
          pet_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_pets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_pets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_staff_id: string | null
          assignment_notes: string | null
          booking_field_ids: number[] | null
          end_time: string
          id: number
          is_paid: boolean
          max_capacity: number | null
          service_type: string | null
          start_time: string
          status: string | null
          vehicle_id: number | null
        }
        Insert: {
          assigned_staff_id?: string | null
          assignment_notes?: string | null
          booking_field_ids?: number[] | null
          end_time: string
          id?: number
          is_paid?: boolean
          max_capacity?: number | null
          service_type?: string | null
          start_time: string
          status?: string | null
          vehicle_id?: number | null
        }
        Update: {
          assigned_staff_id?: string | null
          assignment_notes?: string | null
          booking_field_ids?: number[] | null
          end_time?: string
          id?: number
          is_paid?: boolean
          max_capacity?: number | null
          service_type?: string | null
          start_time?: string
          status?: string | null
          vehicle_id?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          default_staff_id: number | null
          email: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          default_staff_id?: number | null
          email?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          default_staff_id?: number | null
          email?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_default_staff_id_fkey"
            columns: ["default_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fields: {
        Row: {
          field_type: string | null
          id: number
          name: string | null
          site_id: number
        }
        Insert: {
          field_type?: string | null
          id?: number
          name?: string | null
          site_id: number
        }
        Update: {
          field_type?: string | null
          id?: number
          name?: string | null
          site_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fields_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          booking_id: number | null
          client_id: number
          created_at: string | null
          currency: string | null
          id: number
          status: string | null
        }
        Insert: {
          amount?: number | null
          booking_id?: number | null
          client_id: number
          created_at?: string | null
          currency?: string | null
          id?: number
          status?: string | null
        }
        Update: {
          amount?: number | null
          booking_id?: number | null
          client_id?: number
          created_at?: string | null
          currency?: string | null
          id?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          breed: string | null
          client_id: number
          id: number
          is_confirmed: boolean | null
          name: string | null
          size: string | null
        }
        Insert: {
          breed?: string | null
          client_id: number
          id?: number
          is_confirmed?: boolean | null
          name?: string | null
          size?: string | null
        }
        Update: {
          breed?: string | null
          client_id?: number
          id?: number
          is_confirmed?: boolean | null
          name?: string | null
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          country: string | null
          county: string | null
          email_allow_informational: boolean
          email_allow_promotional: boolean
          first_name: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          postcode: string | null
          town_or_city: string | null
          user_id: string
          welcome_email_sent: boolean | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          country?: string | null
          county?: string | null
          email_allow_informational?: boolean
          email_allow_promotional?: boolean
          first_name?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          postcode?: string | null
          town_or_city?: string | null
          user_id: string
          welcome_email_sent?: boolean | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          country?: string | null
          county?: string | null
          email_allow_informational?: boolean
          email_allow_promotional?: boolean
          first_name?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          postcode?: string | null
          town_or_city?: string | null
          user_id?: string
          welcome_email_sent?: boolean | null
        }
        Relationships: []
      }
      service_availability: {
        Row: {
          created_at: string | null
          days_of_week: number[] | null
          end_time: string
          field_ids: number[]
          id: number
          is_active: boolean | null
          override_price: number | null
          service_id: number
          specific_date: string | null
          start_time: string
          use_staff_vehicle_capacity: boolean
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[] | null
          end_time: string
          field_ids: number[]
          id?: number
          is_active?: boolean | null
          override_price?: number | null
          service_id: number
          specific_date?: string | null
          start_time: string
          use_staff_vehicle_capacity?: boolean
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[] | null
          end_time?: string
          field_ids?: number[]
          id?: number
          is_active?: boolean | null
          override_price?: number | null
          service_id?: number
          specific_date?: string | null
          start_time?: string
          use_staff_vehicle_capacity?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_availability_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string | null
          default_price: number | null
          description: string | null
          id: number
          name: string
          requires_field_selection: boolean
          service_type: string
        }
        Insert: {
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          id?: number
          name: string
          requires_field_selection?: boolean
          service_type: string
        }
        Update: {
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          id?: number
          name?: string
          requires_field_selection?: boolean
          service_type?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          address: string | null
          id: number
          is_active: boolean | null
          name: string
        }
        Insert: {
          address?: string | null
          id?: number
          is_active?: boolean | null
          name: string
        }
        Update: {
          address?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          default_vehicle_id: number | null
          id: number
          notes: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          default_vehicle_id?: number | null
          id?: number
          notes?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          default_vehicle_id?: number | null
          id?: number
          notes?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_default_vehicle"
            columns: ["default_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          created_at: string | null
          days_of_week: number[] | null
          end_time: string
          id: number
          is_available: boolean
          specific_date: string | null
          staff_id: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[] | null
          end_time: string
          id?: number
          is_available?: boolean
          specific_date?: string | null
          staff_id: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[] | null
          end_time?: string
          id?: number
          is_available?: boolean
          specific_date?: string | null
          staff_id?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_business_affiliations: {
        Row: {
          business_type: string
          created_at: string
          user_id: string
        }
        Insert: {
          business_type: string
          created_at?: string
          user_id: string
        }
        Update: {
          business_type?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          color: string | null
          id: number
          license_plate: string | null
          make: string
          model: string
          notes: string | null
          pet_capacity: number | null
          year: number | null
        }
        Insert: {
          color?: string | null
          id?: number
          license_plate?: string | null
          make: string
          model: string
          notes?: string | null
          pet_capacity?: number | null
          year?: number | null
        }
        Update: {
          color?: string | null
          id?: number
          license_plate?: string | null
          make?: string
          model?: string
          notes?: string | null
          pet_capacity?: number | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_available_slots: {
        Args: {
          in_service_id: number
          in_start_date: string
          in_end_date: string
          in_client_default_staff_id?: number
        }
        Returns: {
          slot_start_time: string
          slot_end_time: string
          slot_remaining_capacity: number
          rule_uses_staff_capacity: boolean
          associated_field_ids: number[]
          zero_capacity_reason: string
          other_staff_potentially_available: boolean
        }[]
      }
      check_array_elements_range: {
        Args: { arr: number[]; min_val: number; max_val: number }
        Returns: boolean
      }
    }
    Enums: {
      capacity_type_enum: "field" | "staff_vehicle"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
      PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never