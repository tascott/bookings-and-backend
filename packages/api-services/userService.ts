import { UserWithRole, Profile, StaffMemberListItem } from '../types/types'; // Assuming Profile might be part of UserWithRole or needed for updates, Added StaffMemberListItem

/**
 * Fetches all users with their roles.
 */
export async function fetchAllUsers(): Promise<UserWithRole[]> {
    const response = await fetch('/api/users');
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error JSON.' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    const data: UserWithRole[] = await response.json();
    return data;
}

/**
 * Assigns a role to a user.
 */
export async function assignUserRole(userId: string, targetRole: string): Promise<void> { // Typically returns success/failure or updated user
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetRole }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error JSON.' }));
        throw new Error(errorData.error || `Failed to assign role (HTTP ${response.status})`);
    }
    // Depending on API, it might return the updated user or just a success status
    // If it returns data, adjust the Promise type and return response.json()
}

/**
 * Updates user details.
 * The payload should match the expected structure for the PUT /api/users/[userId] endpoint.
 * This might be a Partial<Profile> or a specific update DTO.
 */
export async function updateUserDetails(userId: string, payload: Partial<Profile>): Promise<UserWithRole> { // Assuming it returns the updated user
    const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error JSON.' }));
        throw new Error(errorData.error || 'Failed to update user');
    }
    return response.json();
}

// We can add a function for fetching staff if /api/staff is a generic staff endpoint
// Or if it's very specific (e.g., only for StaffAvailabilityManagement), it might go elsewhere.

/**
 * Fetches staff members (typically role='staff').
 * The /api/staff endpoint is expected to return data matching StaffMemberListItem.
 */
export async function fetchStaffMembers(): Promise<StaffMemberListItem[]> {
    const response = await fetch('/api/staff');
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch staff list: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const data: StaffMemberListItem[] = await response.json();
    return data;
}

/**
 * Assigns a default vehicle to a staff member.
 */
export async function assignStaffDefaultVehicle(staffId: number, vehicleId: number | null): Promise<void> {
    const response = await fetch('/api/staff/assignment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, defaultVehicleId: vehicleId }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error JSON.' }));
        throw new Error(errorData.error || `Failed to assign vehicle (HTTP ${response.status})`);
    }
    // No return content expected on success
}