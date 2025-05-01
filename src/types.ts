// Common types for the application

// Site type
export type Site = {
  id: number;
  name: string;
  address: string | null;
  is_active: boolean;
  fields?: Field[]; // Optional: for nesting fields under sites
}

// Field type
export type Field = {
  id: number;
  site_id: number;
  name: string | null;
  field_type: string | null;
}

// Booking type
export type Booking = {
  id: number;
  booking_field_ids?: number[];
  start_time: string;
  end_time: string;
  service_type: string | null;
  status: string;
  is_paid: boolean;
  client_id?: number | null;
  client_name?: string | null;
  pet_names?: string[];
  created_at?: string;
}

// Service type
export type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  requires_field_selection: boolean;
  default_price?: number | null; // Add default price
}

// Service Availability type
export type ServiceAvailability = {
  id: number;
  service_id: number;
  field_ids: number[];
  start_time: string;
  end_time: string;
  days_of_week: number[] | null;
  specific_date: string | null;
  use_staff_vehicle_capacity: boolean;
  is_active: boolean;
  created_at: string;
  override_price?: number | null;
}

// User with role information
export type UserWithRole = {
  id: string; // This is the Supabase Auth User ID
  email?: string;
  role: string;
  created_at?: string;
  last_sign_in_at?: string;
  // Optional profile fields (from join)
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  // Optional staff fields (from join)
  staff_id?: number | null; // Corresponds to staff.id
  default_vehicle_id?: number | null;
  notes?: string | null;
}

// Pet type
export type Pet = {
  id: number;
  client_id: number;
  name: string;
  breed?: string | null;
  size?: string | null;
  is_active: boolean;
}

// Profile type
export type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

// Client type
export type Client = {
  id: number;
  user_id: string;
  email: string;
  pets?: Pet[];
}

// Staff type
export type Staff = {
  id: number;
  user_id: string;
  role: string;
  notes?: string | null;
  profile?: { // Nested profile
    first_name: string | null;
    last_name: string | null;
  } | null; // Allow profile to be null if join fails or profile doesn't exist
  default_vehicle_id?: number | null; // Add default vehicle ID field
}

// Simplified Staff type for listing with profile names
export type StaffMemberListItem = {
  id: number;
  user_id: string;
  role: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  default_vehicle_id?: number | null;
}

// Vehicle type
export type Vehicle = {
  id: number;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  license_plate?: string | null;
  notes?: string | null;
  pet_capacity?: number | null;
}