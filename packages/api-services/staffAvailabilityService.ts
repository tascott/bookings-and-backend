import { StaffAvailabilityRule, AddStaffAvailabilityRulePayload, UpdateStaffAvailabilityRulePayload } from '../types/types';

/**
 * Fetches availability rules for a given staff member.
 */
export async function fetchStaffAvailabilityRules(staffId: number): Promise<StaffAvailabilityRule[]> {
    if (!staffId) {
        return []; // Or throw an error if staffId is mandatory
    }
    const response = await fetch(`/api/staff-availability?staff_id=${staffId}`);
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch availability rules: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    const data: StaffAvailabilityRule[] = await response.json();
    return data;
}

/**
 * Adds a new staff availability rule.
 */
export async function addStaffAvailabilityRule(payload: AddStaffAvailabilityRulePayload): Promise<StaffAvailabilityRule> {
    const response = await fetch('/api/staff-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add rule' }));
        throw new Error(errorData.error || `Failed to add availability rule (HTTP ${response.status})`);
    }
    return response.json();
}

/**
 * Updates an existing staff availability rule.
 */
export async function updateStaffAvailabilityRule(ruleId: number, payload: UpdateStaffAvailabilityRulePayload): Promise<StaffAvailabilityRule> {
    const response = await fetch(`/api/staff-availability/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update rule' }));
        throw new Error(errorData.error || `Failed to update availability rule (HTTP ${response.status})`);
    }
    return response.json();
}

/**
 * Deletes a staff availability rule.
 */
export async function deleteStaffAvailabilityRule(ruleId: number): Promise<void> {
    const response = await fetch(`/api/staff-availability/${ruleId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        // Try to get a specific error message from the API response body
        let errorMsg = `Failed to delete rule (HTTP ${response.status})`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch (jsonError: unknown) {
            // Ignore if the response body isn't valid JSON, but log the parsing error
            console.warn('Could not parse error response as JSON during delete:', jsonError);
        }
        throw new Error(errorMsg);
    }
    // DELETE typically returns 204 No Content
}