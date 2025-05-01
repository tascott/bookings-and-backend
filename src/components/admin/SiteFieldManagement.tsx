'use client';

// Remove unused import
// import { useRef } from 'react';
import styles from "@/app/page.module.css"; // Adjust path as needed
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation

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
    fields,
    isLoadingSites,
    isLoadingFields,
    error,
    handleAddSite,
    handleAddField,
    getFieldsForSite,
    addSiteFormRef
}: SiteFieldManagementProps) {

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
                                                <li key={field.id}>
                                                    {field.name || 'Unnamed Field'} (ID: {field.id}) -
                                                    Type: {field.field_type || 'N/A'}
                                                </li>
                                            ))}
                                        </ul>
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