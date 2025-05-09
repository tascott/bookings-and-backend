import { Vehicle } from '../types/types';

/**
 * Fetches all vehicles.
 */
export async function fetchVehicles(): Promise<Vehicle[]> {
    const response = await fetch('/api/vehicles');
    if (!response.ok) {
        // Consider more specific error handling based on API response
        throw new Error('Failed to fetch vehicles');
    }
    const data: Vehicle[] = await response.json();
    return data;
}

/**
 * Adds a new vehicle.
 * Payload type based on AdminDashboard usage.
 */
export async function addVehicle(payload: Partial<Vehicle>): Promise<Vehicle> {
    const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add vehicle' }));
        throw new Error(errorData.error || 'Failed to add vehicle');
    }
    const newVehicle: Vehicle = await response.json();
    return newVehicle;
}

/**
 * Deletes a vehicle by ID.
 */
export async function deleteVehicle(id: number): Promise<void> {
    const response = await fetch(`/api/vehicles?id=${id}`, { method: 'DELETE' });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete vehicle' }));
        throw new Error(errorData.error || 'Failed to delete vehicle');
    }
    // No return content expected on successful delete
}

/**
 * Updates an existing vehicle.
 * API expects ID in the payload.
 */
export async function updateVehicle(id: number, updates: Partial<Vehicle>): Promise<Vehicle> {
    const payload = { ...updates, id }; // Ensure ID is in the payload for PUT /api/vehicles
    const response = await fetch(`/api/vehicles`, { // Assuming PUT targets the base endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update vehicle' }));
        throw new Error(errorData.error || 'Failed to update vehicle');
    }
    const updatedVehicle: Vehicle = await response.json();
    return updatedVehicle;
}