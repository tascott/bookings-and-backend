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
  capacity: number | null;
  field_type: string | null;
}

// Booking type
export type Booking = {
  id: number;
  field_id: number;
  start_time: string; // ISO string format from DB
  end_time: string; // ISO string format from DB
  service_type: string | null;
  status: string;
  max_capacity: number | null;
}

// Service type
export type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  requires_field_selection: boolean;
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
  base_capacity: number | null;
  is_active: boolean;
  created_at: string;
}

// User with role information
export type UserWithRole = {
  id: string;
  email?: string;
  role: string;
  created_at?: string;
  last_sign_in_at?: string;
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

// Client type
export type Client = {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  pets?: Pet[];
}