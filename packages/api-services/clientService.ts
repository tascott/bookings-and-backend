import { UserWithRole, Client, UpdateClientPayload, Pet, AddPetPayload } from '../types/types'; // Client removed as searchClients now specifically expects UserWithRole, Added Pet, AddPetPayload

/**
 * Searches for clients based on a search term.
 * The API /api/clients?search=... is expected to return a structure like { clients: UserWithRole[], total: number }
 * when used in contexts like UserManagement for promoting users.
 */
export async function searchClients(searchTerm: string, limit: number = 10): Promise<{ clients: UserWithRole[], total: number }> {
    const response = await fetch(`/api/clients?search=${encodeURIComponent(searchTerm)}&limit=${limit}`);
    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to search clients: ${response.status}`;
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
    const data = await response.json();
    return data; // Expects { clients: [], total: X }
}

// Type for what fetchMyAssignedClients returns, based on StaffDashboard.tsx
// Omit was causing issues with UserWithRole, defining explicitly
export type StaffAssignedClient = {
    id: number; // client.id
    user_id: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    default_staff_id: number | null;
    pets: { id: number; name: string; breed?: string | null; size?: string | null; is_active: boolean; client_id: number }[];
    address_line_1: string | null;
    address_line_2: string | null;
    town_or_city: string | null;
    county: string | null;
    postcode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  };

/**
 * Fetches clients assigned to the current staff member.
 * API /api/clients?assigned_staff_id=me is expected to return { clients: StaffAssignedClient[], total: number }
 */
export async function fetchMyAssignedClients(): Promise<{ clients: StaffAssignedClient[], total: number }> {
    const response = await fetch('/api/clients?assigned_staff_id=me');
    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to fetch assigned clients: ${response.status}`;
         try {
            const parsedError = JSON.parse(errorBody);
            errorMessage = parsedError.error || errorMessage; // Prefer API error message
        } catch {
            // Keep original message if parsing fails
        }
        throw new Error(errorMessage);
    }
    const data = await response.json();
    return data; // Expects { clients: [], total: X }
}

/**
 * Searches for clients for admin booking purposes.
 * Uses the general /api/clients endpoint with a 'search' parameter.
 * The API returns { clients: Client[], total: number }.
 */
export async function searchClientsForAdmin(searchTerm: string): Promise<{ id: number; first_name: string | null; last_name: string | null; email: string }[]> {
    // Use the general /api/clients endpoint with the 'search' parameter
    const response = await fetch(`/api/clients?search=${encodeURIComponent(searchTerm)}&limit=10`); // limit for dropdown
    if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Failed to search clients for admin: ${response.status}`;
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
    // The /api/clients endpoint returns { clients: Client[], total: X }
    const data: { clients: Client[] } = await response.json(); // Type the response data
    const clients: Client[] = data.clients || []; // Extract the clients array

    // Map the Client results to the specific format needed by the dropdown
    return clients.map((client: Client) => {
        // The Client type directly contains first_name and last_name from the API join
        return {
            id: client.id,
            first_name: client.first_name ?? null, // Access directly from Client type
            last_name: client.last_name ?? null,   // Access directly from Client type
            email: client.email || 'N/A' // Provide a fallback for email
        };
    });
}

/**
 * Fetches all clients (intended for admin use).
 * API /api/clients is expected to return { clients: Client[], total: number }.
 */
export async function fetchClients(options?: { include_pets?: boolean }): Promise<Client[]> {
    let url = '/api/clients';
    const params = new URLSearchParams();
    if (options?.include_pets) {
        params.set('include_pets', 'true'); // API should handle this query param if needed
    }
    if (params.toString()) {
        url += '?' + params.toString();
    }

    const response = await fetch(url);
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch clients: ${response.status} ${errorBody}`);
    }
    const data: { clients: Client[], total: number } = await response.json(); // Expect an object
    return data.clients; // Return the array of clients from the object
}

/**
 * Updates client details (Admin).
 */
export async function updateClient(clientId: number, payload: UpdateClientPayload): Promise<Client> {
    const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update client' }));
        throw new Error(errorBody.error || `Failed to update client (HTTP ${response.status})`);
    }
    return response.json();
}

/**
 * Adds a pet for a specific client (Admin).
 */
export async function addClientPet(clientId: number, payload: AddPetPayload): Promise<Pet> {
    const response = await fetch(`/api/clients/${clientId}/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to add pet for client' }));
        throw new Error(errorBody.error || `Failed to add pet for client ${clientId} (HTTP ${response.status})`);
    }
    return response.json();
}