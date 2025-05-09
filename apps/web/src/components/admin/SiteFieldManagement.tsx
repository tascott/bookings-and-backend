'use client';

// Remove unused import
// import { useRef } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
import React, { useState, useCallback, useRef } from 'react'; // Added useRef
// Import shared types
import type { Site, Field, UpdateFieldPayload, AddSitePayload, AddFieldPayload } from '@booking-and-accounts-monorepo/shared-types';

// Local types removed, using imported shared types
// type Site = { ... }; // REMOVED
// type Field = { ... }; // REMOVED

// Define props for the component
interface SiteFieldManagementProps {
    sites: Site[];
    fields: Field[]; // Pass all fields
    isLoadingSites: boolean;
    isLoadingFields: boolean;
    error: string | null;
    handleAddSite: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    handleAddField: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    getFieldsForSite: (siteId: number) => Field[]; // Pass helper function
    addSiteFormRef: React.RefObject<HTMLFormElement | null>;
    // Add handlers for update/delete
    onUpdateField: (fieldId: number, payload: UpdateFieldPayload) => Promise<void>;
    onDeleteField: (fieldId: number) => Promise<void>;
}

export default function SiteFieldManagement({
    sites,
    fields,
    isLoadingSites,
    isLoadingFields,
    error,
    handleAddSite,
    handleAddField,
    getFieldsForSite,
    addSiteFormRef,
    onUpdateField,
    onDeleteField
}: SiteFieldManagementProps) {

    const [editingField, setEditingField] = useState<Field | null>(null);
    // Placeholder state for edit form values
    const [editFieldName, setEditFieldName] = useState('');
    const [editFieldType, setEditFieldType] = useState('');
    const [editFieldCapacity, setEditFieldCapacity] = useState<string>(''); // Use string for input

    const handleEditClick = (field: Field) => {
        setEditingField(field);
        setEditFieldName(field.name || '');
        setEditFieldType(field.field_type || '');
        setEditFieldCapacity(field.capacity?.toString() || '');
    };

    const handleCancelEdit = () => {
        setEditingField(null);
    };

    const handleSaveEdit = async () => {
        if (!editingField) return;

        const capacityValue = editFieldCapacity.trim() === '' ? null : parseInt(editFieldCapacity, 10);
        if (editFieldCapacity.trim() !== '' && (isNaN(capacityValue) || capacityValue === null)) {
            alert('Invalid capacity value. Please enter a number or leave blank.'); // Basic validation
            return;
        }

        const payload: UpdateFieldPayload = {
            name: editFieldName.trim() || null,
            field_type: editFieldType.trim() || null,
            capacity: capacityValue,
        };

        try {
            await onUpdateField(editingField.id, payload); // Use the prop
            setEditingField(null); // Close edit form on success
            // Optionally show a success message
        } catch (err) {
            console.error("Update Field Error:", err);
            alert('Failed to update field: ' + (err instanceof Error ? err.message : 'Unknown error')); // Show error
        }
    };

    // Define Tabs
    const siteMgmtTabs = [
        {
            id: 'view',
            label: 'View Sites & Fields',
            content: (
                <>
                    <h3>Existing Sites & Fields</h3>
                    {isLoadingSites || isLoadingFields ? (
                        <p>Loading sites and fields...</p>
                    ) : error && (sites.length === 0 && fields.length === 0) ? (
                        <p style={{ color: 'red' }}>Error loading sites/fields: {error}</p>
                    ) : sites.length === 0 ? (
                        <p>No sites created yet.</p>
                    ) : (
                        <div className={styles.siteList}>
                            {sites.map(site => (
                                <div key={site.id} className={styles.siteCard} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
                                    <h4>{site.name} {site.is_active ? '(Active)' : '(Inactive)'}</h4>
                                    <p>{site.address || 'No address provided'}</p>

                                    <h5>Fields at this site:</h5>
                                    {getFieldsForSite(site.id).length === 0 ? (
                                        <p>No fields added to this site yet.</p>
                                    ) : (
                                        <ul style={{ listStyle: 'disc', marginLeft: '2rem' }}>
                                            {getFieldsForSite(site.id).map(field => (
                                                <li key={field.id} style={{ marginBottom: '0.5rem' }}>
                                                    {field.name || 'Unnamed Field'} (ID: {field.id}) -
                                                    Type: {field.field_type || 'N/A'} -
                                                    Capacity: {field.capacity ?? 'N/A'}
                                                    <button
                                                        onClick={() => handleEditClick(field)} // Updated onClick
                                                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`}
                                                        style={{ marginLeft: '1rem' }}>
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteField(field.id)}
                                                        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
                                                        style={{ marginLeft: '0.5rem' }}>
                                                        Delete
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {/* Edit Form Placeholder - replaced with actual mini-form */}
                                    {editingField && (
                                        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed blue' }}>
                                            <h4>Editing Field: {editingField.name} (ID: {editingField.id})</h4>
                                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                                <div>
                                                    <label>Name: </label>
                                                    <input type="text" value={editFieldName} onChange={e => setEditFieldName(e.target.value)} className={styles.inputSmall} />
                                                </div>
                                                <div>
                                                    <label>Type: </label>
                                                    <input type="text" value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className={styles.inputSmall} />
                                                </div>
                                                <div>
                                                    <label>Capacity: </label>
                                                    <input type="number" value={editFieldCapacity} onChange={e => setEditFieldCapacity(e.target.value)} className={styles.inputSmall} />
                                                </div>
                                            </div>
                                            <button onClick={handleCancelEdit} className={`${styles.button} ${styles.buttonSecondary}`} style={{ marginRight: '0.5rem' }}>Cancel</button>
                                            <button onClick={handleSaveEdit} className={`${styles.button} ${styles.buttonPrimary}`}>Save Changes</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )
        },
        {
            id: 'add',
            label: 'Add New Site/Field',
            content: (
                <>
                    {/* Add New Site Form */}
                    <form ref={addSiteFormRef} onSubmit={handleAddSite} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <h3>Add New Site</h3>
                        <div>
                            <label htmlFor="siteName">Site Name:</label>
                            <input type="text" id="siteName" name="siteName" required className="input"/>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="siteAddress">Address:</label>
                            <input type="text" id="siteAddress" name="siteAddress" className="input"/>
                        </div>
                        <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Site</button>
                    </form>

                    <hr style={{ margin: '2rem 0' }}/>

                    {/* Add New Field Form (General) */}
                    <form onSubmit={handleAddField} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                         <h3>Add New Field</h3>
                         {sites.length === 0 ? (
                             <p>You must add a site before you can add a field.</p>
                         ) : (
                             <>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="fieldSiteId">Assign to Site:</label>
                                    <select id="fieldSiteId" name="fieldSiteId" required className="input">
                                        <option value="">-- Select Site --</option>
                                        {sites.map(site => (
                                            <option key={site.id} value={site.id}>{site.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="fieldName">Field Name:</label>
                                    <input type="text" id="fieldName" name="fieldName" className="input"/>
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="fieldType">Field Type:</label>
                                    <input type="text" id="fieldType" name="fieldType" placeholder="e.g., dog daycare, fitness" className="input"/>
                                </div>
                                <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Field</button>
                            </>
                         )}
                    </form>
                </>
            )
        },
    ];

    return (
        <section>
            <h2>Site & Field Management (Admin)</h2>
            {/* Render Tabs */}
            <TabNavigation tabs={siteMgmtTabs} />
        </section>
    );
}