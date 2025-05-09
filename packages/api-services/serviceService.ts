import { Service, ServiceAvailability, AddServicePayload, UpdateServicePayload, AddServiceAvailabilityPayload, UpdateServiceAvailabilityPayload } from '../types/types';

interface FetchServicesOptions {
  active?: boolean;
}

export async function fetchServices(options?: FetchServicesOptions): Promise<Service[]> {
  let url = '/api/services';
  const queryParams = new URLSearchParams();

  if (options?.active !== undefined) {
    queryParams.append('active', String(options.active));
  }

  if (queryParams.toString()) {
    url += `?${queryParams.toString()}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch services: ${response.status} ${errorBody}`);
  }

  return response.json();
}

/**
 * Fetches all service availability rules.
 */
export async function fetchServiceAvailabilities(): Promise<ServiceAvailability[]> {
    const response = await fetch('/api/service-availability');
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch service availabilities: ${response.status} ${errorBody}`);
    }
    return response.json();
}

// Add functions for POST, PUT, DELETE /api/services later as needed
export async function addService(payload: AddServicePayload): Promise<Service> {
    const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to add service' }));
        throw new Error(errorBody.error || `Failed to add service (HTTP ${response.status})`);
    }
    return response.json();
}

export async function updateService(serviceId: number, payload: UpdateServicePayload): Promise<Service> {
    const response = await fetch(`/api/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update service' }));
        throw new Error(errorBody.error || `Failed to update service (HTTP ${response.status})`);
    }
    return response.json();
}

export async function deleteService(serviceId: number): Promise<void> {
    const response = await fetch(`/api/services/${serviceId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to delete service' }));
        throw new Error(errorBody.error || `Failed to delete service (HTTP ${response.status})`);
    }
    // DELETE usually returns 204 No Content
}

// --- Service Availability ---

export async function addServiceAvailability(payload: AddServiceAvailabilityPayload): Promise<ServiceAvailability> {
    const response = await fetch('/api/service-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to add service availability' }));
        throw new Error(errorBody.error || `Failed to add service availability (HTTP ${response.status})`);
    }
    return response.json();
}

export async function updateServiceAvailability(ruleId: number, payload: UpdateServiceAvailabilityPayload): Promise<ServiceAvailability> {
    const response = await fetch(`/api/service-availability/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update service availability' }));
        throw new Error(errorBody.error || `Failed to update service availability (HTTP ${response.status})`);
    }
    return response.json();
}

export async function deleteServiceAvailability(ruleId: number): Promise<void> {
    const response = await fetch(`/api/service-availability/${ruleId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to delete service availability' }));
        throw new Error(errorBody.error || `Failed to delete service availability (HTTP ${response.status})`);
    }
}