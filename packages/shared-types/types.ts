// Common types for the application

// Site type
export type Site = {
	id: number;
	name: string;
	address: string | null;
	is_active: boolean;
	fields?: Field[]; // Optional: for nesting fields under sites
};

// Field type
export type Field = {
	id: number;
	site_id: number;
	name: string | null;
	field_type: string | null;
	capacity: number | null;
};

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
	pets?: { id: number; name: string }[];
	created_at?: string;
	assigned_staff_id?: string | null;
	vehicle_id?: number | null;
	assignment_notes?: string | null;
};

// Service type
export type Service = {
	id: number;
	name: string;
	description: string | null;
	created_at: string;
	requires_field_selection?: boolean; // Optional based on docs
	default_price?: number | null;
	service_type?: 'Field Hire' | 'Daycare' | null; // Added service_type
	is_active: boolean; // Added active status
};

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
};

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

	// Added address and email preference fields, assuming they can be joined/fetched
	address_line_1?: string | null;
	address_line_2?: string | null;
	town_or_city?: string | null;
	county?: string | null;
	postcode?: string | null;
	country?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	email_allow_promotional?: boolean | null;
	email_allow_informational?: boolean | null;
};

// Pet type
export type Pet = {
	id: number;
	client_id: number;
	name: string;
	breed?: string | null;
	size?: string | null;
	age?: number | null;
	notes?: string | null;
	is_active: boolean;
	is_confirmed?: boolean; // Added confirmation status
	images?: PetImage[]; // Optional array of pet images
};

// PetImage type
export type PetImage = {
	id: string; // uuid
	pet_id: number; // Foreign key to Pet table
	uploaded_by_staff_id: number; // Foreign key to Staff table (staff.id)
	storage_object_path: string;
	caption?: string | null;
	file_name?: string | null;
	mime_type?: string | null;
	size_bytes?: number | null;
	created_at: string; // ISO timestamp string
	// Optional: To include a direct URL for the image if fetched (e.g., signed URL)
	image_url?: string | null;
};

// Profile type
export interface Profile {
	user_id: string;
	first_name: string | null;
	last_name: string | null;
	phone: string | null;
	email_allow_promotional?: boolean | null;
	email_allow_informational?: boolean | null;
	address_line_1?: string | null;
	address_line_2?: string | null;
	town_or_city?: string | null;
	county?: string | null;
	postcode?: string | null;
	country?: string | null;
	latitude?: number | null;
	longitude?: number | null;
}

// Combined Client type including profile data and pets
export type Client = {
	id: number;
	user_id: string | null; // From profiles table
	email: string | null; // From clients table
	first_name: string | null; // From profiles table
	last_name: string | null; // From profiles table
	phone: string | null; // From profiles table
	default_staff_id: number | null; // From clients table
	default_staff_name: string | null; // Joined from staff/profiles
	pets: Pet[]; // Array of Pet objects
	// Add new address fields (nullable)
	address_line_1: string | null;
	address_line_2: string | null;
	town_or_city: string | null;
	county: string | null;
	postcode: string | null;
	country: string | null;
	latitude: number | null;
	longitude: number | null;
};

// Staff type
export type Staff = {
	id: number;
	user_id: string;
	role: string;
	notes?: string | null;
	profile?: {
		// Nested profile
		first_name: string | null;
		last_name: string | null;
	} | null; // Allow profile to be null if join fails or profile doesn't exist
	default_vehicle_id?: number | null; // Add default vehicle ID field
};

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
};

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
};

// Staff Availability Rule type
export type StaffAvailabilityRule = {
	id: number;
	staff_id: number;
	start_time: string; // HH:mm:ss format
	end_time: string; // HH:mm:ss format
	days_of_week: number[] | null;
	specific_date: string | null; // YYYY-MM-DD format
	is_available: boolean;
	created_at: string;
	updated_at: string;
	staff?: {
		// Optional nested staff info from GET request
		profiles: { first_name: string | null; last_name: string | null } | null;
	} | null;
};

// Payload for updating a booking's details
export interface UpdateBookingPayload {
	start_time?: string;    // ISO string
	end_time?: string;      // ISO string
	service_type?: string;  // Changed from service_id to match component's existing logic
	status?: string;
	notes?: string | null;
	assigned_staff_id?: string | null;
	vehicle_id?: number | null;
}

// Type for available slots returned by the API
export interface AvailableSlot {
	start_time: string;           // ISO string
	end_time: string;             // ISO string
	remaining_capacity: number | null;
	price_per_pet?: number | null;
	zero_capacity_reason?: string | null; // e.g., 'staff_full', 'no_staff'
	uses_staff_capacity?: boolean;
	field_ids?: number[];
	capacity_display?: string;      // Optional display string like "3/5 pets"
	other_staff_potentially_available?: boolean; // Added based on ClientBooking.tsx comment "New field from RPC"
}

// Payload for creating a new booking
export interface CreateBookingPayload {
	service_id: number;
	start_time: string; // ISO string
	end_time: string; // ISO string
	field_ids?: number[];
	pet_ids?: number[];
	client_id?: number; // For admin booking
	assigned_staff_id?: string | null; // For admin booking - allow null
	vehicle_id?: number | null; // For admin booking - allow null
	notes?: string | null; // For admin booking - allow null
}

// Payload for adding a staff availability rule
export interface AddStaffAvailabilityRulePayload {
	staff_id: number;
	start_time: string; // HH:mm:ss
	end_time: string;   // HH:mm:ss
	is_available: boolean;
	days_of_week?: number[]; // ISO days (1-7, e.g., Monday=1, Sunday=7)
	specific_date?: string;  // YYYY-MM-DD
}

// Payload for updating a staff availability rule
export interface UpdateStaffAvailabilityRulePayload {
	start_time?: string;
	end_time?: string;
	is_available?: boolean;
	days_of_week?: number[] | null; // Allow null to clear recurring days
	specific_date?: string | null;  // Allow null to clear specific date
}

// Payload for adding a new service
export interface AddServicePayload {
	name: string;
	description?: string | null;
	requires_field_selection?: boolean;
	default_price?: number | null;
	service_type?: 'Field Hire' | 'Daycare' | null;
	is_active?: boolean;
}

// Payload for updating an existing service
export interface UpdateServicePayload {
	name?: string;
	description?: string | null;
	requires_field_selection?: boolean;
	default_price?: number | null;
	service_type?: 'Field Hire' | 'Daycare' | null;
	is_active?: boolean;
}

// Payload for updating an existing field
export interface UpdateFieldPayload {
	name?: string | null;
	field_type?: string | null;
	capacity?: number | null;
	// site_id is typically not updated for an existing field, but set on creation.
	// If moving a field is a feature, site_id could be added here.
}

// Payload for adding a new site
export interface AddSitePayload {
	name: string;
	address?: string | null; // Optional address
}

// Payload for updating an existing site
export interface UpdateSitePayload {
	name?: string;
	address?: string | null;
	is_active?: boolean; // Sites can also be active/inactive
}

// Payload for adding a new field
export interface AddFieldPayload {
	site_id: number;
	name: string;
	field_type: string;
	capacity?: number | null; // Added capacity here to match potential need
}

// Payload for adding a service availability rule
export interface AddServiceAvailabilityPayload {
	service_id: number;
	field_ids: number[];
	start_time: string; // HH:mm:ss format typically for availability rules
	end_time: string;   // HH:mm:ss format
	use_staff_vehicle_capacity?: boolean;
	is_active?: boolean;
	days_of_week?: number[] | null; // ISO days (1-7, e.g., Mon=1, Sun=7)
	specific_date?: string | null;  // YYYY-MM-DD
	override_price?: number | null;
}

// Payload for updating a service availability rule
export interface UpdateServiceAvailabilityPayload {
	service_id?: number;
	field_ids?: number[];
	start_time?: string;
	end_time?: string;
	use_staff_vehicle_capacity?: boolean;
	is_active?: boolean;
	days_of_week?: number[] | null;
	specific_date?: string | null;
	override_price?: number | null;
}

// Payload for updating client details (Admin)
export interface UpdateClientPayload {
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
	default_staff_id?: number | null;
	address_line_1?: string | null;
	address_line_2?: string | null;
	town_or_city?: string | null;
	county?: string | null;
	postcode?: string | null;
	country?: string | null;
	latitude?: number | null;
	longitude?: number | null;
}

// Payload for adding a pet (used by client and admin)
export interface AddPetPayload {
	name: string;
	breed?: string;
	size?: string;
}

// Payload for updating a pet
export interface UpdatePetPayload {
	name: string;
	breed?: string;
	size?: string;
}