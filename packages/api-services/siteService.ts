import { Site, Field, UpdateFieldPayload, AddSitePayload, AddFieldPayload, UpdateSitePayload } from '@booking-and-accounts-monorepo/shared-types';

/**
 * Fetches all sites.
 */
export async function fetchSites(): Promise<Site[]> {
    const response = await fetch('/api/sites');
    if (!response.ok) {
        // Consider more specific error handling based on API response
        throw new Error('Failed to fetch sites');
    }
    const data: Site[] = await response.json();
    return data;
}

/**
 * Fetches all fields.
 */
export async function fetchFields(): Promise<Field[]> {
    const response = await fetch('/api/fields');
    if (!response.ok) {
        // Consider more specific error handling based on API response
        throw new Error('Failed to fetch fields');
    }
    const data: Field[] = await response.json();
    return data;
}

/**
 * Adds a new site.
 */
export async function addSite(payload: AddSitePayload): Promise<Site> {
    const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add site' }));
        throw new Error(errorData.error || 'Failed to add site');
    }
    const newSite: Site = await response.json();
    return newSite;
}

/**
 * Adds a new field.
 */
export async function addField(payload: AddFieldPayload): Promise<Field> {
    const response = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to add field' }));
        throw new Error(errorData.error || 'Failed to add field');
    }
    const newField: Field = await response.json();
    return newField;
}

// Add functions for updating/deleting sites/fields if needed
export async function updateSite(siteId: number, payload: UpdateSitePayload): Promise<Site> {
    const response = await fetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update site' }));
        throw new Error(errorBody.error || `Failed to update site (HTTP ${response.status})`);
    }
    return response.json();
}

export async function deleteSite(siteId: number): Promise<void> {
    const response = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to delete site' }));
        throw new Error(errorBody.error || `Failed to delete site (HTTP ${response.status})`);
    }
}

// Re-adding updateField
export async function updateField(fieldId: number, payload: UpdateFieldPayload): Promise<Field> {
    const response = await fetch(`/api/fields/${fieldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to update field' }));
        throw new Error(errorBody.error || `Failed to update field (HTTP ${response.status})`);
    }
    return response.json();
}

// Re-adding deleteField
export async function deleteField(fieldId: number): Promise<void> {
    const response = await fetch(`/api/fields/${fieldId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to delete field' }));
        throw new Error(errorBody.error || `Failed to delete field (HTTP ${response.status})`);
    }
}