'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type ServiceAvailability = {
    id: number;
    service_id: number;
    field_ids: number[];
    start_time: string;
    end_time: string;
    days_of_week: number[] | null;
    specific_date: string | null;
    base_capacity: number | null;
    is_active: boolean;
    created_at: string;
}

type Service = {
    id: number;
    name: string;
}

type Site = {
    id: number;
    name: string;
}

type Field = {
    id: number;
    site_id: number;
    name: string | null;
}

// Define props for the component
interface ServiceAvailabilityManagementProps {
    serviceAvailability: ServiceAvailability[];
    isLoadingServiceAvailability: boolean;
    services: Service[];
    sites: Site[];
    fields: Field[];
    error: string | null;
    handleAddServiceAvailability: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    handleToggleServiceAvailabilityActive: (ruleId: number, currentStatus: boolean) => Promise<void>;
    addServiceAvailabilityFormRef: React.RefObject<HTMLFormElement | null>;
    getFieldsForSite: (siteId: number) => Field[];
}

export default function ServiceAvailabilityManagement({
    serviceAvailability,
    isLoadingServiceAvailability,
    services,
    sites,
    fields,
    error,
    handleAddServiceAvailability,
    handleToggleServiceAvailabilityActive,
    addServiceAvailabilityFormRef,
    getFieldsForSite
}: ServiceAvailabilityManagementProps) {

    // No local state needed currently

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Service Availability Rules (Admin)</h2>
            {/* Display error related to availability? Or rely on global */}
            {/* {error && error.includes('availability') && <p style={{ color: 'red' }}>Error: {error}</p>} */}

            {/* Add New Availability Rule Form */}
            <form ref={addServiceAvailabilityFormRef} onSubmit={handleAddServiceAvailability} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Add New Availability Rule</h3>
                {(services.length === 0 || fields.length === 0) ? (
                    <p>Please add Services and Fields before defining availability.</p>
                ) : (
                    <>
                        <div>
                            <label htmlFor="availabilityServiceId">Service:</label>
                            <select id="availabilityServiceId" name="availabilityServiceId" required>
                                <option value="">-- Select Service --</option>
                                {services.map(service => (
                                    <option key={service.id} value={service.id}>{service.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Multi-Field Selection */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <label>Applies to Field(s):</label>
                            {sites.map(site => (
                                <div key={`avail-site-group-${site.id}`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                    <strong>{site.name}</strong>
                                    {getFieldsForSite(site.id).map(field => (
                                        <div key={`avail-field-chk-${field.id}`} style={{ marginLeft: '1rem' }}>
                                            <input type="checkbox" id={`availField-${field.id}`} name="availabilityFieldIds" value={field.id} />
                                            <label htmlFor={`availField-${field.id}`}>{field.name || `Field ID ${field.id}`}</label>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        {/* Time, Recurrence, Capacity, Active Inputs */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilityStartTime">Start Time:</label>
                            <input type="time" id="availabilityStartTime" name="availabilityStartTime" required />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilityEndTime">End Time:</label>
                            <input type="time" id="availabilityEndTime" name="availabilityEndTime" required />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilityBaseCapacity">Base Capacity (Optional):</label>
                            <input type="number" id="availabilityBaseCapacity" name="availabilityBaseCapacity" min="0" placeholder="Defaults to field capacity" />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label>Recurring Days (Mon-Sun):</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginLeft: '1rem' }}>
                                {[
                                    { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
                                    { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
                                    { label: 'Sun', value: 7 },
                                ].map(day => (
                                    <div key={`avail-day-${day.value}`}>
                                        <input type="checkbox" id={`availabilityDayOfWeek-${day.value}`} name={`availabilityDayOfWeek-${day.value}`} />
                                        <label htmlFor={`availabilityDayOfWeek-${day.value}`}>{day.label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilitySpecificDate">Specific Date (Optional):</label>
                            <input type="date" id="availabilitySpecificDate" name="availabilitySpecificDate" placeholder="Leave blank if recurring" />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilityIsActive">Is Active:</label>
                            <input type="checkbox" id="availabilityIsActive" name="availabilityIsActive" defaultChecked />
                        </div>
                        <button type="submit" style={{ marginTop: '1rem' }}>Add Availability Rule</button>
                    </>
                )}
            </form>

            {/* Display Existing Availability Rules */}
            <h3>Existing Availability Rules</h3>
            {isLoadingServiceAvailability ? (
                <p>Loading availability rules...</p>
            ) : error && serviceAvailability.length === 0 ? (
                 <p style={{ color: 'red' }}>Error loading availability rules: {error}</p>
            ): serviceAvailability.length === 0 ? (
                <p>No availability rules defined yet.</p>
            ) : (
                <div className={styles.availabilityList}>
                    {serviceAvailability.map(rule => (
                        <div key={rule.id} className={styles.availabilityCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                            <p>
                                {/* Find service name - ideally join in API later */}
                                <strong>Service ID:</strong> {rule.service_id} |
                                <strong>Fields:</strong> {rule.field_ids.join(', ')} |
                                <label htmlFor={`active-toggle-${rule.id}`} style={{ marginLeft: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        id={`active-toggle-${rule.id}`}
                                        checked={rule.is_active}
                                        onChange={() => handleToggleServiceAvailabilityActive(rule.id, rule.is_active)}
                                        style={{ marginRight: '0.3rem' }}
                                    />
                                    {rule.is_active ? 'Yes' : 'No'}
                                </label>
                            </p>
                            <p>
                                <strong>Time:</strong> {rule.start_time} - {rule.end_time} |
                                <strong>Recurrence:</strong>
                                {rule.days_of_week && rule.days_of_week.length > 0 ? `Days: ${rule.days_of_week.join(', ')} (Mon=1)` : rule.specific_date ? `${rule.specific_date}` : 'None specified'}
                            </p>
                            <p><strong>Base Capacity:</strong> {rule.base_capacity ?? 'Field Default'}</p>
                            {/* Add Edit/Delete later */}
                        </div>
                    ))}
                </div>
            )}
            {/* Display global error if needed and not displayed above */}
            {error && serviceAvailability.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
        </section>
    );
}