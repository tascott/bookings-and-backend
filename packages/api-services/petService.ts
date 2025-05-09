import { Pet, UpdatePetPayload, AddPetPayload } from '../types/types';

// Define payload types based on PetManagement usage
// export interface AddPetPayload {
//     name: string;
//     breed?: string;
//     size?: string;
// }

// export interface UpdatePetPayload {
// Let's move UpdatePetPayload too for consistency
// ... UpdatePetPayload definition ...
// }

/**
 * Fetches pets for the currently authenticated user.
 */
export async function fetchUserPets(): Promise<Pet[]> {
    const response = await fetch('/api/pets');
    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to fetch pets: ${response.status}`;
        if (errorBody) {
            try {
                const parsedError = JSON.parse(errorBody);
                errorMessage += ` - ${parsedError.message || parsedError.error || errorBody}`;
            } catch {
                errorMessage += ` - ${errorBody}`;
            }
        }
        throw new Error(errorMessage);
    }
    const data: Pet[] = await response.json();
    return data;
}

/**
 * Adds a new pet for the authenticated user.
 */
export async function addPet(payload: AddPetPayload): Promise<Pet> {
    const response = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add pet' }));
        throw new Error(errorData.error || `Failed to add pet (HTTP ${response.status})`);
    }
    return response.json();
}

/**
 * Updates an existing pet.
 */
export async function updatePet(petId: number, payload: UpdatePetPayload): Promise<Pet> {
    const response = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update pet' }));
        throw new Error(errorData.error || `Failed to update pet (HTTP ${response.status})`);
    }
    return response.json();
}

/**
 * Deletes a pet.
 */
export async function deletePet(petId: number): Promise<void> {
    const response = await fetch(`/api/pets/${petId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete pet' }));
        throw new Error(errorData.error || `Failed to delete pet (HTTP ${response.status})`);
    }
    // No content expected on success
}

/**
 * Fetches pets for a specific client by their client ID.
 * Used by admins when managing bookings for clients.
 */
export async function fetchPetsByClientId(clientId: number): Promise<Pet[]> {
    const response = await fetch(`/api/clients/${clientId}/pets`); // Changed URL
    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to fetch pets for client ${clientId}: ${response.status}`;
        if (errorBody) {
            try {
                const parsedError = JSON.parse(errorBody);
                errorMessage += ` - ${parsedError.message || parsedError.error || errorBody}`;
            } catch {
                errorMessage += ` - ${errorBody}`;
            }
        }
        throw new Error(errorMessage);
    }
    const data: Pet[] = await response.json();
    return data;
}

/**
 * Toggles the confirmation status of a pet.
 */
export async function togglePetConfirmation(petId: number, is_confirmed: boolean): Promise<Pet> {
    const response = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_confirmed: is_confirmed }),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update pet confirmation status' }));
        throw new Error(errorBody.error || `Failed to update pet confirmation (HTTP ${response.status})`);
    }
    return response.json(); // Assuming the API returns the updated pet
}

// Add other pet-related API service functions here later, e.g.:
// export async function addPet(payload: AddPetPayload): Promise<Pet> { ... }
// export async function updatePet(petId: number, payload: UpdatePetPayload): Promise<Pet> { ... }
// export async function deletePet(petId: number): Promise<void> { ... }