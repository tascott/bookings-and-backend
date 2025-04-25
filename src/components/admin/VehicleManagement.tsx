import React, { useRef } from 'react';
import type { Vehicle } from '@/types';

interface VehicleManagementProps {
  vehicles: Vehicle[];
  isLoading: boolean;
  error: string | null;
  onAdd: (vehicle: Partial<Vehicle>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function VehicleManagement({ vehicles, isLoading, error, onAdd, onDelete }: VehicleManagementProps) {
  const addFormRef = useRef<HTMLFormElement>(null);

  // Minimal local state for editing (not full implementation, just a stub for now)
  // For brevity, only add form is implemented; edit/delete buttons call handlers

  return (
    <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
      <h2>Vehicle Management (Admin)</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form ref={addFormRef} onSubmit={async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        await onAdd({
          make: String(formData.get('make')),
          model: String(formData.get('model')),
          year: formData.get('year') ? Number(formData.get('year')) : undefined,
          color: String(formData.get('color')),
          license_plate: String(formData.get('license_plate')),
          notes: String(formData.get('notes')),
          pet_capacity: formData.get('pet_capacity') ? Number(formData.get('pet_capacity')) : undefined,
        });
        form.reset();
      }} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Add New Vehicle</h3>
        <div><label>Make: <input name="make" required /></label></div>
        <div><label>Model: <input name="model" required /></label></div>
        <div><label>Year: <input name="year" type="number" min="1900" max="2100" /></label></div>
        <div><label>Color: <input name="color" /></label></div>
        <div><label>License Plate: <input name="license_plate" /></label></div>
        <div><label>Pet Capacity: <input name="pet_capacity" type="number" min="0" /></label></div>
        <div><label>Notes: <input name="notes" /></label></div>
        <button type="submit" style={{ marginTop: '1rem' }}>Add Vehicle</button>
      </form>
      <h3>Existing Vehicles</h3>
      {isLoading ? <p>Loading vehicles...</p> : vehicles.length === 0 ? <p>No vehicles found.</p> : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {vehicles.map(vehicle => {
            return (
              <li key={vehicle.id} style={{ border: '1px solid #eee', padding: '0.8rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                <strong>{vehicle.make} {vehicle.model}</strong> ({vehicle.year || 'Year N/A'})<br />
                Color: {vehicle.color || 'N/A'}<br />
                License Plate: {vehicle.license_plate || 'N/A'}<br />
                Pet Capacity: {vehicle.pet_capacity ?? 'N/A'}<br />
                Notes: {vehicle.notes || 'N/A'}<br />
                <button onClick={() => onDelete(vehicle.id)} style={{ marginTop: '0.5rem', color: 'red' }}>Delete</button>
                {/* Edit functionality can be added here if needed */}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}