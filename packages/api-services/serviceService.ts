import { SupabaseClient } from '@supabase/supabase-js';
import { Service, ServiceAvailability, AddServicePayload, UpdateServicePayload, AddServiceAvailabilityPayload, UpdateServiceAvailabilityPayload } from '@booking-and-accounts-monorepo/shared-types';

interface FetchServicesOptions {
  active?: boolean;
}

export async function fetchServices(supabase: SupabaseClient, options?: FetchServicesOptions): Promise<Service[]> {
  let query = supabase.from('services').select('*');

  if (options?.active !== undefined) {
    query = query.eq('is_active', options.active);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching services from Supabase:', error);
    throw new Error(`Failed to fetch services: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetches all service availability rules.
 */
export async function fetchServiceAvailabilities(supabase: SupabaseClient): Promise<ServiceAvailability[]> {
    const { data, error } = await supabase.from('service_availability').select('*');
    if (error) {
        console.error('Error fetching service availabilities from Supabase:', error);
        throw new Error(`Failed to fetch service availabilities: ${error.message}`);
    }
    return data || [];
}

// Add functions for POST, PUT, DELETE /api/services later as needed
export async function addService(supabase: SupabaseClient, payload: AddServicePayload): Promise<Service> {
    const { data, error } = await supabase.from('services').insert(payload).select().single();
    if (error) {
        throw new Error(error.message || `Failed to add service (Supabase error)`);
    }
    return data;
}

export async function updateService(supabase: SupabaseClient, serviceId: number, payload: UpdateServicePayload): Promise<Service> {
    const { data, error } = await supabase.from('services').update(payload).eq('id', serviceId).select().single();
    if (error) {
        throw new Error(error.message || `Failed to update service (Supabase error)`);
    }
    return data;
}

export async function deleteService(supabase: SupabaseClient, serviceId: number): Promise<void> {
    const { error } = await supabase.from('services').delete().eq('id', serviceId);
    if (error) {
        throw new Error(error.message || `Failed to delete service (Supabase error)`);
    }
}

// --- Service Availability ---

export async function addServiceAvailability(supabase: SupabaseClient, payload: AddServiceAvailabilityPayload): Promise<ServiceAvailability> {
    const { data, error } = await supabase.from('service_availability').insert(payload).select().single();
    if (error) {
        throw new Error(error.message || `Failed to add service availability (Supabase error)`);
    }
    return data;
}

export async function updateServiceAvailability(supabase: SupabaseClient, ruleId: number, payload: UpdateServiceAvailabilityPayload): Promise<ServiceAvailability> {
    const { data, error } = await supabase.from('service_availability').update(payload).eq('id', ruleId).select().single();
     if (error) {
        throw new Error(error.message || `Failed to update service availability (Supabase error)`);
    }
    return data;
}

export async function deleteServiceAvailability(supabase: SupabaseClient, ruleId: number): Promise<void> {
    const { error } = await supabase.from('service_availability').delete().eq('id', ruleId);
    if (error) {
        throw new Error(error.message || `Failed to delete service availability (Supabase error)`);
    }
}