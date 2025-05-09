'use client';

import React, { useState, useMemo } from 'react';
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation

// Remove unused import
// import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  default_price?: number | null;
  service_type?: 'Field Hire' | 'Daycare' | null;
}

// Define props for the component
interface ServiceManagementProps {
    services: Service[];
    isLoadingServices: boolean;
    error: string | null;
    handleAddService: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    addServiceFormRef: React.RefObject<HTMLFormElement | null>;
    handleUpdateService: (serviceId: number, data: Partial<Omit<Service, 'id' | 'created_at'>>) => Promise<void>;
    handleDeleteService: (serviceId: number) => Promise<void>;
}

export default function ServiceManagement({
    services,
    isLoadingServices,
    error,
    handleAddService,
    addServiceFormRef,
    handleUpdateService,
    handleDeleteService
}: ServiceManagementProps) {

    // State for edit modal
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [editFields, setEditFields] = useState({ name: '', description: '', default_price: '', service_type: 'Daycare' as 'Field Hire' | 'Daycare' });
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // State for filtering
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]); // State to track selected types

    const openEditModal = (service: Service) => {
        setEditingService(service);
        setEditFields({
            name: service.name,
            description: service.description || '',
            default_price: service.default_price?.toString() || '',
            service_type: service.service_type || 'Daycare'
        });
        setEditError(null);
    };

    const closeEditModal = () => {
        setEditingService(null);
        setIsSaving(false);
        setEditError(null);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setEditFields((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSaveEdit = async () => {
        if (!editingService) return;

        let price: number | null = null;
        if (editFields.default_price) {
            const parsed = parseFloat(editFields.default_price);
            if (isNaN(parsed)) {
                setEditError('Invalid price format.');
                return;
            }
            price = parsed;
        }

        const updateData: Partial<Omit<Service, 'id' | 'created_at'>> = {
            name: editFields.name,
            description: editFields.description || null,
            default_price: price,
            service_type: editFields.service_type,
        };

        setIsSaving(true);
        setEditError(null);
        try {
            await handleUpdateService(editingService.id, updateData);
            closeEditModal();
        } catch (e) { // handleUpdateService should throw on API error
            setEditError(e instanceof Error ? e.message : 'Failed to save service');
        } finally {
            setIsSaving(false);
        }
    };

    // Handler for filter checkbox changes
    const handleTypeFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.target;
        setSelectedTypes(prev =>
            checked ? [...prev, value] : prev.filter(type => type !== value)
        );
    };

    // Filtered services based on selected types
    const filteredServices = useMemo(() => {
        if (selectedTypes.length === 0) {
            return services; // Show all if no filter selected
        }
        return services.filter(service =>
            selectedTypes.includes(service.service_type || '')
        );
    }, [services, selectedTypes]);

    // Define Tabs
    const serviceMgmtTabs = [
        {
            id: 'view',
            label: 'Existing Services',
            content: (
                <>
                    <h3>Existing Services</h3>
                    {/* Filter Checkboxes */}
                    <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #eee' }}>
                        <strong>Filter by Type:</strong>
                        <label style={{ marginLeft: '1rem' }}>
                            <input
                                type="checkbox"
                                value="Daycare"
                                checked={selectedTypes.includes('Daycare')}
                                onChange={handleTypeFilterChange}
                            /> Daycare
                        </label>
                        <label style={{ marginLeft: '1rem' }}>
                            <input
                                type="checkbox"
                                value="Field Hire"
                                checked={selectedTypes.includes('Field Hire')}
                                onChange={handleTypeFilterChange}
                            /> Field Hire
                        </label>
                    </div>

                    {isLoadingServices ? (
                        <p>Loading services...</p>
                    ) : error && filteredServices.length === 0 && selectedTypes.length > 0 ? (
                         <p style={{ color: 'red' }}>Error loading services: {error}</p>
                    ) : error && services.length === 0 ? (
                        // Show error only if original list is empty due to error
                        <p style={{ color: 'red' }}>Error loading services: {error}</p>
                    ) : filteredServices.length === 0 ? (
                        // Adjust message based on whether filters are active
                        selectedTypes.length > 0 ? <p>No services match the selected filter(s).</p> : <p>No services defined yet.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {/* Map over filteredServices instead of services */}
                            {filteredServices.map(service => (
                                <li key={service.id} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                                    <strong>{service.name}</strong> (ID: {service.id}) - Type: {service.service_type || 'N/A'}
                                    <span style={{ marginLeft: '1rem', color: '#38761d' }}>
                                        Price: {service.default_price !== null && service.default_price !== undefined ? `£${service.default_price.toFixed(2)}` : 'Not set'}
                                    </span>
                                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9em', color: '#555' }}>
                                        {service.description || 'No description'}
                                    </p>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <button onClick={() => openEditModal(service)} style={{ marginRight: '0.5rem', padding: '2px 8px' }} className="button secondary small">Edit</button>
                                        <button onClick={() => handleDeleteService(service.id)} style={{ padding: '2px 8px' }} className="button danger small">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )
        },
        {
            id: 'add',
            label: 'Add New Service',
            content: (
                <>
                    {/* Add New Service Form */}
                    <form ref={addServiceFormRef} onSubmit={handleAddService} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                        <h3>Add New Service</h3>
                        <div>
                            <label htmlFor="serviceName">Service Name:</label>
                            <input type="text" id="serviceName" name="serviceName" required placeholder="e.g., Doggy Daycare AM, Full Day Field Hire" className="input" />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="serviceDescription">Description:</label>
                            <textarea id="serviceDescription" name="serviceDescription" rows={3} className="input"></textarea>
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="serviceDefaultPrice">Default Price (£):</label>
                            <input type="number" id="serviceDefaultPrice" name="serviceDefaultPrice" min="0" step="0.01" placeholder="e.g., 25.50" className="input" />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <label htmlFor="serviceType">Service Type:</label>
                            <select id="serviceType" name="service_type" required className="input" defaultValue="Daycare">
                                <option value="Daycare">Daycare</option>
                                <option value="Field Hire">Field Hire</option>
                            </select>
                        </div>
                        <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Service</button>
                    </form>
                </>
            )
        },
    ];

    return (
        <section>
            <h2>Service Management (Admin)</h2>
            {/* Removed Add New Service Form from here */}
            {/* Removed Display Existing Services from here */}

            {/* Render Tabs */}
            <TabNavigation tabs={serviceMgmtTabs} />

            {/* Keep Edit Modal outside tabs */}
            {editingService && (
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                        <h3 style={{ color: '#fff' }}>Edit Service: {editingService.name}</h3>
                        {editError && <p style={{ color: '#f87171' }}>{editError}</p>}
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Name:<br />
                                <input type="text" name="name" value={editFields.name} onChange={handleEditChange} required className="input" />
                            </label>
                        </div>
                         <div style={{ marginBottom: '1rem' }}>
                            <label>Description:<br />
                                <textarea name="description" value={editFields.description} onChange={handleEditChange} rows={3} className="input" />
                            </label>
                        </div>
                         <div style={{ marginBottom: '1rem' }}>
                            <label>Default Price (£):<br />
                                <input type="number" name="default_price" value={editFields.default_price} onChange={handleEditChange} min="0" step="0.01" placeholder="Leave blank if no price" className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Service Type:<br />
                                <select name="service_type" value={editFields.service_type} onChange={handleEditChange} required className="input">
                                    <option value="Daycare">Daycare</option>
                                    <option value="Field Hire">Field Hire</option>
                                </select>
                            </label>
                        </div>
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={closeEditModal} disabled={isSaving} className="button secondary">Cancel</button>
                            <button onClick={handleSaveEdit} disabled={isSaving} className="button primary">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Removed global error display from here */}
        </section>
    );
}