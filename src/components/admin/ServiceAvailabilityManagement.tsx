'use client';

// import styles from "@/app/page.module.css"; // Removed unused import
import React, { useState } from 'react'; // Remove unused useEffect
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation

// Define types (or import from shared location)
type ServiceAvailability = {
    id: number;
    service_id: number;
    field_ids: number[]; // No longer nullable, required field
    start_time: string;
    end_time: string;
    days_of_week: number[] | null;
    specific_date: string | null;
    use_staff_vehicle_capacity: boolean; // Added new flag
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
    field_ids: string[]; // Required
    start_time: string;
    end_time: string;
    use_staff_vehicle_capacity: boolean;
    is_active: boolean;
    days_of_week: string[];
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
        service_id: '', field_ids: [], start_time: '', end_time: '',
        use_staff_vehicle_capacity: false,
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
            field_ids: (rule.field_ids || []).map(id => id.toString()),
            start_time: rule.start_time,
            end_time: rule.end_time,
            use_staff_vehicle_capacity: rule.use_staff_vehicle_capacity || false,
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
            } else if (name === 'use_staff_vehicle_capacity') {
                 setEditFields(prev => ({ ...prev, use_staff_vehicle_capacity: checked }));
            } else if (name === 'availabilityFieldIds') {
                 const currentFieldIds = editFields.field_ids;
                 if (checked) {
                     setEditFields(prev => ({ ...prev, field_ids: [...currentFieldIds, value] }));
                 } else {
                     setEditFields(prev => ({ ...prev, field_ids: currentFieldIds.filter(id => id !== value) }));
                 }
            } else if (name.startsWith('availabilityDayOfWeek-')) {
                 const dayValue = name.split('-')[1];
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
        setEditError(null);
        try {
            let overridePrice: number | null = null;
            if (editFields.override_price) {
                const parsed = parseFloat(editFields.override_price);
                if (isNaN(parsed)) throw new Error('Invalid Override Price format');
                overridePrice = parsed;
            }

            const serviceIdNum = parseInt(editFields.service_id, 10);
            if(isNaN(serviceIdNum)) throw new Error('Invalid Service ID');

            const fieldIdsNum = editFields.field_ids.map(id => parseInt(id, 10));
            if (fieldIdsNum.some(isNaN)) throw new Error('Invalid Field ID selected');
            if (fieldIdsNum.length === 0) throw new Error('At least one Field must be selected.');

            const daysOfWeekNum = editFields.days_of_week.map(d => parseInt(d, 10));
            if(daysOfWeekNum.some(isNaN)) throw new Error('Invalid Day of Week');

            const updateData: Partial<Omit<ServiceAvailability, 'id' | 'created_at'>> = {
                service_id: serviceIdNum,
                field_ids: fieldIdsNum,
                start_time: editFields.start_time,
                end_time: editFields.end_time,
                use_staff_vehicle_capacity: editFields.use_staff_vehicle_capacity,
                is_active: editFields.is_active,
                days_of_week: daysOfWeekNum.length > 0 ? daysOfWeekNum : null,
                specific_date: editFields.specific_date || null,
                override_price: overridePrice,
            };

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
    };

    // Define Tabs
    const availabilityMgmtTabs = [
        {
            id: 'view',
            label: 'Existing Rules',
            content: (
                <>
                    <h3>Existing Availability Rules</h3>
                    {isLoadingServiceAvailability ? (
                        <p>Loading rules...</p>
                    ) : error && serviceAvailability.length === 0 ? (
                        <p style={{ color: 'red' }}>Error loading rules: {error}</p>
                    ) : serviceAvailability.length === 0 ? (
                        <p>No availability rules defined yet.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {serviceAvailability.map(rule => {
                                const ruleFields = fields.filter(f => rule.field_ids?.includes(f.id));
                                const defaultServicePrice = getServiceDefaultPrice(rule.service_id);
                                return (
                                    <li key={rule.id} style={{
                                        border: '1px solid #ccc',
                                        padding: '1rem',
                                        marginBottom: '0.8rem',
                                        borderRadius: '4px',
                                        background: rule.is_active ? '#fff' : '#f8f8f8',
                                        color: '#212529'
                                    }}>
                                        <div><strong>Service:</strong> {getServiceName(rule.service_id)} (Rule ID: {rule.id})</div>
                                        <div><strong>Status:</strong> {rule.is_active ? 'Active' : 'Inactive'}</div>
                                        <div><strong>Time:</strong> {rule.start_time} - {rule.end_time}</div>
                                        <div>
                                            <strong>Applies to:</strong>
                                            {rule.specific_date ? (
                                                ` Specific Date: ${rule.specific_date}`
                                            ) : rule.days_of_week && rule.days_of_week.length > 0 ? (
                                                ` Days: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].filter((_, i) => rule.days_of_week!.includes(i)).join(', ')}`
                                            ) : (
                                                ' No specific date or days set'
                                            )}
                                        </div>
                                        <div>
                                            <strong>Fields:</strong>
                                            {ruleFields.length > 0 ? (
                                                ruleFields.map(f => f.name || `Field ${f.id}`).join(', ')
                                            ) : (
                                                <span style={{ color: 'red' }}> (No valid fields assigned!)</span>
                                            )}
                                        </div>
                                        <div>
                                            <strong>Capacity:</strong>
                                             {rule.use_staff_vehicle_capacity ? 'Uses Staff Vehicle Capacity' : 'No Capacity Limit'}
                                        </div>
                                        <div>
                                            <strong>Price:</strong>
                                            {rule.override_price !== null && rule.override_price !== undefined
                                                ? ` Override: £${rule.override_price.toFixed(2)}`
                                                : ` Default: ${defaultServicePrice !== null && defaultServicePrice !== undefined ? `£${defaultServicePrice.toFixed(2)}` : 'Not set'}`
                                            }
                                        </div>
                                        <div style={{ marginTop: '0.8rem' }}>
                                            <button onClick={() => handleToggleServiceAvailabilityActive(rule.id, rule.is_active)} style={{ marginRight: '0.5rem' }} className={`button small ${rule.is_active ? 'secondary' : 'primary'}`}>{rule.is_active ? 'Deactivate' : 'Activate'}</button>
                                            <button onClick={() => openEditModal(rule)} style={{ marginRight: '0.5rem' }} className="button secondary small">Edit</button>
                                            <button onClick={() => handleDeleteServiceAvailability(rule.id)} className="button danger small">Delete</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {error && serviceAvailability.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
                </>
            )
        },
        {
            id: 'add',
            label: 'Add New Rule',
            content: (
                <>
                    <form ref={addServiceAvailabilityFormRef} onSubmit={handleAddServiceAvailability} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <h3>Add New Availability Rule</h3>
                        {(services.length === 0) ? (
                            <p>Please add Services before defining availability.</p>
                        ) : (
                            <>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="availabilityServiceId">Service:</label>
                                    <select id="availabilityServiceId" name="availabilityServiceId" required className="input">
                                        <option value="">-- Select Service --</option>
                                        {services.map(service => (
                                            <option key={service.id} value={service.id}>{service.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {(sites.length === 0 || fields.length === 0) ? (
                                    <p style={{ color: 'orange' }}>Please add Sites and Fields first.</p>
                                ) : (
                                    <div style={{ marginBottom: '0.5rem', border: '1px dashed #ccc', padding: '0.5rem' }}>
                                        <label>Applies to Field(s): (Required - Select at least one)</label>
                                        {sites.map(site => (
                                            <div key={`avail-site-group-${site.id}`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                                <strong>{site.name}:</strong>
                                                {getFieldsForSite(site.id).length > 0 ? (
                                                    getFieldsForSite(site.id).map(field => (
                                                        <label key={`avail-field-${field.id}`} style={{ display: 'block', marginLeft: '1rem' }}>
                                                            <input type="checkbox" name="availabilityFieldIds" value={field.id} /> {field.name || `Field ${field.id}`}
                                                        </label>
                                                    ))
                                                ) : (
                                                    <span style={{ fontStyle: 'italic', color: '#888' }}> (No fields in this site)</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label htmlFor="availabilityStartTime">Start Time:</label>
                                        <input type="time" id="availabilityStartTime" name="availabilityStartTime" required className="input" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label htmlFor="availabilityEndTime">End Time:</label>
                                        <input type="time" id="availabilityEndTime" name="availabilityEndTime" required className="input" />
                                    </div>
                                </div>

                                <div style={{ border: '1px dashed #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}>
                                    <label>Recurrence Type (Select One):</label>
                                    <div style={{ marginLeft: '1rem' }}>
                                        <label>Specific Date:</label>
                                        <input type="date" name="availabilitySpecificDate" className="input" style={{marginLeft: '0.5rem'}}/>
                                    </div>
                                    <div style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                                        <label>Recurring Days:</label><br />
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                            <label key={`day-${index}`} style={{ marginRight: '0.5rem' }}>
                                                <input type="checkbox" name={`availabilityDayOfWeek-${index}`} value={index} /> {day}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ border: '1px dashed #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}>
                                     <label>Capacity Control:</label>
                                     <div style={{ marginLeft: '1rem' }}>
                                         <label>
                                             <input type="checkbox" name="use_staff_vehicle_capacity" /> Use Staff Vehicle Capacity
                                             <span style={{fontSize: '0.8em', color: '#777'}}>(Only check if capacity should be limited by assigned staff&apos;s vehicle)</span>
                                         </label>
                                     </div>
                                </div>

                                <div style={{ marginTop: '0.5rem' }}>
                                    <label htmlFor="availabilityOverridePrice">Override Price (£ - Optional):</label>
                                    <input type="number" id="availabilityOverridePrice" name="availabilityOverridePrice" min="0" step="0.01" placeholder="Leave blank to use service default" className="input" />
                                </div>

                                <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Rule</button>
                            </>
                        )}
                    </form>
                </>
            )
        },
    ];

    return (
        <section>
            <h2>Service Availability Rules (Admin)</h2>

            <TabNavigation tabs={availabilityMgmtTabs} />

            {editingRule && (
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>Edit Availability Rule (ID: {editingRule.id})</h3>
                        {editError && <p style={{ color: '#f87171' }}>{editError}</p>}

                        <div style={{ marginBottom: '0.5rem' }}>
                            <label>Service:</label>
                            <select name="service_id" value={editFields.service_id} onChange={handleEditFieldChange} required className="input">
                                {services.map(service => (
                                    <option key={service.id} value={service.id}>{service.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '0.5rem', border: '1px dashed #ccc', padding: '0.5rem' }}>
                             <label>Applies to Field(s): (Required)</label>
                            {sites.map(site => (
                                <div key={`edit-avail-site-group-${site.id}`} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                    <strong>{site.name}:</strong>
                                    {getFieldsForSite(site.id).length > 0 ? (
                                        getFieldsForSite(site.id).map(field => (
                                            <label key={`edit-avail-field-${field.id}`} style={{ display: 'block', marginLeft: '1rem' }}>
                                                <input
                                                    type="checkbox"
                                                    name="availabilityFieldIds"
                                                    value={field.id}
                                                    checked={editFields.field_ids.includes(field.id.toString())}
                                                    onChange={handleEditFieldChange}
                                                /> {field.name || `Field ${field.id}`}
                                            </label>
                                        ))
                                    ) : (
                                        <span style={{ fontStyle: 'italic', color: '#888' }}> (No fields in this site)</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{flex: 1}}>
                                <label>Start Time:</label>
                                <input type="time" name="start_time" value={editFields.start_time} onChange={handleEditFieldChange} required className="input" />
                            </div>
                             <div style={{flex: 1}}>
                                <label>End Time:</label>
                                <input type="time" name="end_time" value={editFields.end_time} onChange={handleEditFieldChange} required className="input" />
                            </div>
                        </div>
                        <div style={{ border: '1px dashed #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}>
                            <label>Recurrence Type:</label>
                             <div style={{ marginLeft: '1rem' }}>
                                <label>Specific Date:</label>
                                <input type="date" name="specific_date" value={editFields.specific_date} onChange={handleEditFieldChange} className="input" style={{marginLeft: '0.5rem'}}/>
                            </div>
                            <div style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                                <label>Recurring Days:</label><br />
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                    <label key={`edit-day-${index}`} style={{ marginRight: '0.5rem' }}>
                                        <input
                                            type="checkbox"
                                            name={`availabilityDayOfWeek-${index}`}
                                            value={index}
                                            checked={editFields.days_of_week.includes(index.toString())}
                                            onChange={handleEditFieldChange}
                                         /> {day}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div style={{ border: '1px dashed #ccc', padding: '0.5rem', marginBottom: '0.5rem' }}>
                             <label>Capacity Control:</label>
                              <div style={{ marginLeft: '1rem' }}>
                                 <label>
                                     <input
                                         type="checkbox"
                                         name="use_staff_vehicle_capacity"
                                         checked={editFields.use_staff_vehicle_capacity}
                                         onChange={handleEditFieldChange}
                                     /> Use Staff Vehicle Capacity
                                 </label>
                             </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Override Price (£):</label>
                            <input type="number" name="override_price" value={editFields.override_price} onChange={handleEditFieldChange} min="0" step="0.01" placeholder="Blank = use default" className="input" />
                        </div>
                         <div style={{ marginBottom: '1rem' }}>
                            <label>
                                <input type="checkbox" name="is_active" checked={editFields.is_active} onChange={handleEditFieldChange} /> Active Rule
                            </label>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={closeEditModal} disabled={isSaving} className="button secondary">Cancel</button>
                            <button onClick={handleSaveEdit} disabled={isSaving} className="button primary">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}