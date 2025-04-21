'use client';

// Remove unused import
// import styles from "@/app/page.module.css"; // Adjust path as needed

// Define types (or import from shared location)
type Service = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

// Define props for the component
interface ServiceManagementProps {
    services: Service[];
    isLoadingServices: boolean;
    error: string | null;
    handleAddService: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    addServiceFormRef: React.RefObject<HTMLFormElement | null>;
}

export default function ServiceManagement({
    services,
    isLoadingServices,
    error,
    handleAddService,
    addServiceFormRef
}: ServiceManagementProps) {

    // No local state needed currently

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
                            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9em', color: '#555' }}>
                                {service.description || 'No description'}
                            </p>
                            {/* Add Edit/Delete later */}
                        </li>
                    ))}
                </ul>
            )}
            {/* Display global error if needed and not displayed above */}
            {error && services.length > 0 && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
        </section>
    );
}