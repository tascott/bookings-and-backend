'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed
import React, { useState } from 'react'; // Remove unused useEffect

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
    override_price?: number | null;
}

type Service = {
    id: number;
    name: string;
    default_price?: number | null;
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
    handleUpdateServiceAvailability: (ruleId: number, data: Partial<Omit<ServiceAvailability, 'id' | 'created_at'>>) => Promise<void>;
    handleDeleteServiceAvailability: (ruleId: number) => Promise<void>;
}

// Helper type for edit form state
type ServiceAvailabilityEditFields = {
    service_id: string;
    field_ids: string[];
    start_time: string;
    end_time: string;
    base_capacity: string;
    is_active: boolean;
    days_of_week: string[]; // Use string array for checkbox group values
    specific_date: string;
    override_price: string;
};

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
    getFieldsForSite,
    handleUpdateServiceAvailability,
    handleDeleteServiceAvailability
}: ServiceAvailabilityManagementProps) {

    // Edit Modal State
    const [editingRule, setEditingRule] = useState<ServiceAvailability | null>(null);
    const [editFields, setEditFields] = useState<ServiceAvailabilityEditFields>({
        service_id: '', field_ids: [], start_time: '', end_time: '', base_capacity: '',
        is_active: true, days_of_week: [], specific_date: '', override_price: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Helper to get service name from the services prop
    const getServiceName = (serviceId: number): string => {
        return services.find(s => s.id === serviceId)?.name || `ID ${serviceId}`;
    }
    // Helper to get service default price
    const getServiceDefaultPrice = (serviceId: number): number | null | undefined => {
        return services.find(s => s.id === serviceId)?.default_price;
    }

    // --- Edit Modal Functions ---
    const openEditModal = (rule: ServiceAvailability) => {
        setEditingRule(rule);
        setEditFields({
            service_id: rule.service_id.toString(),
            field_ids: rule.field_ids.map(id => id.toString()),
            start_time: rule.start_time,
            end_time: rule.end_time,
            base_capacity: rule.base_capacity?.toString() || '',
            is_active: rule.is_active,
            days_of_week: rule.days_of_week?.map(d => d.toString()) || [],
            specific_date: rule.specific_date || '',
            override_price: rule.override_price?.toString() || ''
        });
        setEditError(null);
    };

    const closeEditModal = () => {
        setEditingRule(null);
        setIsSaving(false);
        setEditError(null);
    };

    const handleEditFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            if (name === 'is_active') {
                 setEditFields(prev => ({ ...prev, is_active: checked }));
            } else if (name === 'availabilityFieldIds') {
                const currentFieldIds = editFields.field_ids;
                if (checked) {
                    setEditFields(prev => ({ ...prev, field_ids: [...currentFieldIds, value] }));
                } else {
                    setEditFields(prev => ({ ...prev, field_ids: currentFieldIds.filter(id => id !== value) }));
                }
            } else if (name.startsWith('availabilityDayOfWeek-')) {
                 const dayValue = name.split('-')[1]; // e.g., '1' for Monday
                 const currentDays = editFields.days_of_week;
                 if(checked){
                      setEditFields(prev => ({ ...prev, days_of_week: [...currentDays, dayValue] }));
                 } else {
                      setEditFields(prev => ({ ...prev, days_of_week: currentDays.filter(day => day !== dayValue) }));
                 }
            }
        } else {
            setEditFields(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSaveEdit = async () => {
        if (!editingRule) return;

        // --- Validation and Data Preparation (Similar to API POST/PUT) ---
        setEditError(null);
        try {
            let overridePrice: number | null = null;
            if (editFields.override_price) {
                const parsed = parseFloat(editFields.override_price);
                if (isNaN(parsed)) throw new Error('Invalid Override Price format');
                overridePrice = parsed;
            }

             let baseCapacity: number | null = null;
            if (editFields.base_capacity) {
                const parsed = parseInt(editFields.base_capacity, 10);
                if (isNaN(parsed)) throw new Error('Invalid Base Capacity format');
                baseCapacity = parsed;
            }

            const serviceIdNum = parseInt(editFields.service_id, 10);
            if(isNaN(serviceIdNum)) throw new Error('Invalid Service ID');

            const fieldIdsNum = editFields.field_ids.map(id => parseInt(id, 10));
            if(fieldIdsNum.some(isNaN)) throw new Error('Invalid Field ID selected');
            if(fieldIdsNum.length === 0) throw new Error('At least one Field must be selected');

            const daysOfWeekNum = editFields.days_of_week.map(d => parseInt(d, 10));
            if(daysOfWeekNum.some(isNaN)) throw new Error('Invalid Day of Week');

            const updateData: Partial<Omit<ServiceAvailability, 'id' | 'created_at'>> = {
                service_id: serviceIdNum,
                field_ids: fieldIdsNum,
                start_time: editFields.start_time,
                end_time: editFields.end_time,
                base_capacity: baseCapacity,
                is_active: editFields.is_active,
                days_of_week: daysOfWeekNum.length > 0 ? daysOfWeekNum : null,
                specific_date: editFields.specific_date || null,
                override_price: overridePrice,
            };

            // Further validation matching API (time order, date format, day/date conflict)
            if (updateData.end_time! <= updateData.start_time!) throw new Error("End time must be after start time.");
            if (updateData.days_of_week && updateData.specific_date) throw new Error("Cannot set both recurring days and specific date.");
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
             if (updateData.specific_date && !dateRegex.test(updateData.specific_date)) throw new Error('Invalid specific_date format');

             setIsSaving(true);
             await handleUpdateServiceAvailability(editingRule.id, updateData);
             closeEditModal();

        } catch (e) {
            setEditError(e instanceof Error ? e.message : 'Validation failed');
        } finally {
             setIsSaving(false);
        }
        // --- End Validation & Save ---
    };

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
                        {/* Add Override Price Input */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="availabilityOverridePrice">Override Price (£) (Optional):</label>
                            <input type="number" id="availabilityOverridePrice" name="availabilityOverridePrice" min="0" step="0.01" placeholder="e.g., 30.00 (leave blank to use default)" />
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
                    {serviceAvailability.map(rule => {
                        const defaultPrice = getServiceDefaultPrice(rule.service_id);
                        return (
                            <div key={rule.id} className={styles.availabilityCard} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.8rem', borderRadius: '4px' }}>
                                <p>
                                    {/* Display Service Name (ID: X) */}
                                    <strong>Service:</strong> {getServiceName(rule.service_id)} (ID: {rule.service_id}) |
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
                                {/* Display Prices */}
                                <p style={{ fontSize: '0.9em', color: '#38761d' }}>
                                    <strong>Pricing:</strong>
                                    {rule.override_price !== null && rule.override_price !== undefined ? (
                                        <span> Override: £{rule.override_price.toFixed(2)} </span>
                                    ) : (
                                        <span> Default: {defaultPrice !== null && defaultPrice !== undefined ? `£${defaultPrice.toFixed(2)}` : 'Not set'} </span>
                                    )}
                                    {/* Optionally always show default for comparison */}
                                    {(rule.override_price !== null && rule.override_price !== undefined) &&
                                     (defaultPrice !== null && defaultPrice !== undefined) &&
                                      <span style={{ fontStyle: 'italic', marginLeft: '0.5rem' }}>(Default: £{defaultPrice.toFixed(2)})</span>}
                                </p>
                                {/* Add Edit/Delete buttons */}
                                <div style={{ marginTop: '0.5rem' }}>
                                     <button onClick={() => openEditModal(rule)} style={{ marginRight: '0.5rem', padding: '2px 8px' }}>Edit</button>
                                     <button onClick={() => handleDeleteServiceAvailability(rule.id)} style={{ padding: '2px 8px', color: 'red' }}>Delete</button>
                                 </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Display global error if needed and not displayed above */}
            {error && serviceAvailability.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}

             {/* Edit Modal */}
             {editingRule && (
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
                    <div style={{ background: '#222', color: '#fff', padding: 24, borderRadius: 8, margin: '2rem', width: '90%', maxWidth: '600px', boxShadow: '0 2px 16px #0008' }}>
                        <h3 style={{ color: '#fff', marginTop: 0 }}>Edit Availability Rule (ID: {editingRule.id})</h3>
                        {/* Service Select */}
                        <div style={{ marginBottom: 8 }}>
                            <label>Service:<br />
                                <select name="service_id" value={editFields.service_id} onChange={handleEditFieldChange} required style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }}>
                                     {services.map(service => (
                                        <option key={service.id} value={service.id}>{service.name}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {/* Field Multi-Select */}
                        <div style={{ marginBottom: 8 }}>
                            <label>Applies to Field(s):<br />
                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #555', padding: '4px', background: '#333' }}>
                                {sites.map(site => (
                                    <div key={`edit-avail-site-group-${site.id}`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                        <strong>{site.name}</strong>
                                        {getFieldsForSite(site.id).map(field => (
                                            <div key={`edit-avail-field-chk-${field.id}`} style={{ marginLeft: '1rem' }}>
                                                <input type="checkbox" id={`editAvailField-${field.id}`} name="availabilityFieldIds" value={field.id.toString()}
                                                       checked={editFields.field_ids.includes(field.id.toString())}
                                                       onChange={handleEditFieldChange} />
                                                <label htmlFor={`editAvailField-${field.id}`}>{field.name || `Field ID ${field.id}`}</label>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                </div>
                            </label>
                        </div>
                        {/* Times */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: 8 }}>
                            <div style={{ flex: 1 }}>
                                <label>Start Time:<br />
                                    <input type="time" name="start_time" value={editFields.start_time} onChange={handleEditFieldChange} required style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                                </label>
                            </div>
                             <div style={{ flex: 1 }}>
                                <label>End Time:<br />
                                    <input type="time" name="end_time" value={editFields.end_time} onChange={handleEditFieldChange} required style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                                </label>
                            </div>
                        </div>
                         {/* Capacity & Price */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: 8 }}>
                             <div style={{ flex: 1 }}>
                                <label>Base Capacity (Optional):<br />
                                    <input type="number" name="base_capacity" value={editFields.base_capacity} onChange={handleEditFieldChange} min="0" placeholder="Field Default" style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                                </label>
                            </div>
                             <div style={{ flex: 1 }}>
                                <label>Override Price (£) (Opt.):<br />
                                    <input type="number" name="override_price" value={editFields.override_price} onChange={handleEditFieldChange} min="0" step="0.01" placeholder="Service Default" style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                                </label>
                            </div>
                        </div>
                        {/* Recurrence or Specific Date */}
                         <div style={{ marginBottom: 8 }}>
                            <label>Recurring Days (Mon-Sun):</label>
                             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginLeft: '1rem', background: '#333', padding: '4px 8px', border: '1px solid #555' }}>
                                {[
                                    { label: 'Mon', value: '1' }, { label: 'Tue', value: '2' }, { label: 'Wed', value: '3' },
                                    { label: 'Thu', value: '4' }, { label: 'Fri', value: '5' }, { label: 'Sat', value: '6' },
                                    { label: 'Sun', value: '7' },
                                ].map(day => (
                                    <div key={`edit-avail-day-${day.value}`}>
                                        <input type="checkbox" id={`editAvailabilityDayOfWeek-${day.value}`} name={`availabilityDayOfWeek-${day.value}`} value={day.value}
                                               checked={editFields.days_of_week.includes(day.value)}
                                               onChange={handleEditFieldChange} />
                                        <label htmlFor={`editAvailabilityDayOfWeek-${day.value}`}>{day.label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label>Specific Date (Optional):<br />
                                <input type="date" name="specific_date" value={editFields.specific_date} onChange={handleEditFieldChange} style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                            </label>
                        </div>
                        {/* Active Toggle */}
                        <div style={{ marginBottom: 16 }}>
                            <label>
                                <input type="checkbox" name="is_active" checked={editFields.is_active} onChange={handleEditFieldChange} />
                                Active Rule
                            </label>
                        </div>

                        {editError && <p style={{ color: '#ff6b6b' }}>{editError}</p>}
                        <div style={{ marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={handleSaveEdit} disabled={isSaving} style={{ color: '#fff', background: '#28a745', border: 'none', padding: '6px 16px', borderRadius: 4, marginRight: 8 }}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button onClick={closeEditModal} disabled={isSaving} style={{ color: '#fff', background: '#6c757d', border: 'none', padding: '6px 16px', borderRadius: 4 }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}