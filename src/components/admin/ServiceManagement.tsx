'use client';

import React, { useState } from 'react';

// Remove unused import
// import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  default_price?: number | null;
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
    const [editFields, setEditFields] = useState({ name: '', description: '', default_price: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const openEditModal = (service: Service) => {
        setEditingService(service);
        setEditFields({
            name: service.name,
            description: service.description || '',
            default_price: service.default_price?.toString() || '' // Convert number to string for input
        });
        setEditError(null);
    };

    const closeEditModal = () => {
        setEditingService(null);
        setIsSaving(false);
        setEditError(null);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditFields((prev: typeof editFields) => ({ ...prev, [e.target.name]: e.target.value }));
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

    return (
        <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h2>Service Management (Admin)</h2>
            {/* Display error related to services? Or rely on global */}
            {/* {error && error.includes('service') && <p style={{ color: 'red' }}>Error: {error}</p>} */}

            {/* Add New Service Form */}
            <form ref={addServiceFormRef} onSubmit={handleAddService} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Add New Service</h3>
                <div>
                    <label htmlFor="serviceName">Service Name:</label>
                    <input type="text" id="serviceName" name="serviceName" required placeholder="e.g., Doggy Daycare AM, Full Day Field Hire" />
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="serviceDescription">Description:</label>
                    <textarea id="serviceDescription" name="serviceDescription" rows={3}></textarea>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                    <label htmlFor="serviceDefaultPrice">Default Price (£):</label>
                    <input type="number" id="serviceDefaultPrice" name="serviceDefaultPrice" min="0" step="0.01" placeholder="e.g., 25.50" />
                </div>
                <button type="submit" style={{ marginTop: '1rem' }}>Add Service</button>
            </form>

            {/* Display Existing Services */}
            <h3>Existing Services</h3>
            {isLoadingServices ? (
                <p>Loading services...</p>
            ) : error && services.length === 0 ? (
                 <p style={{ color: 'red' }}>Error loading services: {error}</p>
            ) : services.length === 0 ? (
                <p>No services defined yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {services.map(service => (
                        <li key={service.id} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                            <strong>{service.name}</strong> (ID: {service.id})
                            <span style={{ marginLeft: '1rem', color: '#38761d' }}>
                                Price: {service.default_price !== null && service.default_price !== undefined ? `£${service.default_price.toFixed(2)}` : 'Not set'}
                            </span>
                            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9em', color: '#555' }}>
                                {service.description || 'No description'}
                            </p>
                            {/* Add Edit/Delete buttons */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <button onClick={() => openEditModal(service)} style={{ marginRight: '0.5rem', padding: '2px 8px' }}>Edit</button>
                                <button onClick={() => handleDeleteService(service.id)} style={{ padding: '2px 8px', color: 'red' }}>Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {/* Display global error if needed and not displayed above */}
            {error && services.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}

            {/* Edit Modal */}
            {editingService && (
                 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#222', color: '#fff', padding: 24, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 16px #0008' }}>
                        <h3 style={{ color: '#fff' }}>Edit Service: {editingService.name}</h3>
                        <div style={{ marginBottom: 8 }}>
                            <label>Name:<br />
                                <input type="text" name="name" value={editFields.name} onChange={handleEditChange} required style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                            </label>
                        </div>
                         <div style={{ marginBottom: 8 }}>
                            <label>Description:<br />
                                <textarea name="description" value={editFields.description} onChange={handleEditChange} rows={3} style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                            </label>
                        </div>
                         <div style={{ marginBottom: 8 }}>
                            <label>Default Price (£):<br />
                                <input type="number" name="default_price" value={editFields.default_price} onChange={handleEditChange} min="0" step="0.01" placeholder="Leave blank if no price" style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: 4 }} />
                            </label>
                        </div>
                        {editError && <p style={{ color: '#ff6b6b' }}>{editError}</p>}
                        <div style={{ marginTop: '1rem' }}>
                            <button onClick={handleSaveEdit} disabled={isSaving} style={{ color: '#fff', background: '#28a745', border: 'none', padding: '6px 16px', borderRadius: 4, marginRight: 8 }}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            <button onClick={closeEditModal} disabled={isSaving} style={{ color: '#fff', background: '#6c757d', border: 'none', padding: '6px 16px', borderRadius: 4 }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}