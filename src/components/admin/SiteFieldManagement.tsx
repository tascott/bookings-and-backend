'use client';

// Remove unused import
// import { useRef } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type Site = {
    id: number;
    name: string;
    address: string | null;
    is_active: boolean;
    // fields?: Field[]; // Not strictly needed if passing fields separately
}

type Field = {
    id: number;
    site_id: number;
    name: string | null;
    capacity: number | null;
    field_type: string | null;
}

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
}

export default function SiteFieldManagement({
    sites,
    fields, // Destructure fields
    isLoadingSites,
    isLoadingFields,
    error,
    handleAddSite,
    handleAddField,
    getFieldsForSite,
    addSiteFormRef
}: SiteFieldManagementProps) {

    // No local state needed currently

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Site & Field Management (Admin)</h2>

            {/* Add New Site Form - Attach the ref passed via props */}
            <form ref={addSiteFormRef} onSubmit={handleAddSite} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Add New Site</h3>
                <div>
                    <label htmlFor="siteName">Site Name:</label>
                    <input type="text" id="siteName" name="siteName" required />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="siteAddress">Address:</label>
                    <input type="text" id="siteAddress" name="siteAddress" />
                </div>
                <button type="submit" style={{ marginTop: '1rem' }}>Add Site</button>
                {/* Display error related to adding site? Or rely on global error display below? */}
                {/* {error && error.includes('site') && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>} */}
            </form>

            {/* Display Existing Sites and Fields */}
            <h3>Existing Sites & Fields</h3>
            {isLoadingSites || isLoadingFields ? (
                <p>Loading sites and fields...</p>
            ) : error && (sites.length === 0 && fields.length === 0) ? ( // Show fetch error if loading failed and no data
                <p style={{ color: 'red' }}>Error loading sites/fields: {error}</p>
            ) : sites.length === 0 ? (
                <p>No sites created yet.</p>
            ) : (
                <div className={styles.siteList}> {/* Use a class for potential styling */}
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
                                        <li key={field.id}>
                                            {field.name || 'Unnamed Field'} (ID: {field.id}) -
                                            Capacity: {field.capacity ?? 'N/A'},
                                            Type: {field.field_type || 'N/A'}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Add New Field Form (for this site) */}
                            <form onSubmit={handleAddField} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #eee' }}>
                                <h5>Add Field to {site.name}</h5>
                                {/* Hidden input to associate with the current site */}
                                <input type="hidden" name="fieldSiteId" value={site.id} />
                                <div>
                                    <label htmlFor={`fieldName-${site.id}`}>Field Name:</label>
                                    <input type="text" id={`fieldName-${site.id}`} name="fieldName" />
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label htmlFor={`fieldCapacity-${site.id}`}>Capacity:</label>
                                    <input type="number" id={`fieldCapacity-${site.id}`} name="fieldCapacity" min="0" />
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <label htmlFor={`fieldType-${site.id}`}>Field Type:</label>
                                    <input type="text" id={`fieldType-${site.id}`} name="fieldType" placeholder="e.g., dog daycare, fitness" />
                                </div>
                                <button type="submit" style={{ marginTop: '1rem' }}>Add Field</button>
                                {/* {error && error.includes('field') && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>} */}
                            </form>
                        </div>
                    ))}
                </div>
            )}
             {/* Display global error if needed and not displayed above */}
             {error && !(sites.length === 0 && fields.length === 0) && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
        </section>
    );
}