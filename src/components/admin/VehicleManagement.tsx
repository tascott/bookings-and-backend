'use client'; // Ensure this is at the top

import React, { useRef } from 'react';
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
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

  // Define Tabs
  const vehicleMgmtTabs = [
    {
      id: 'view',
      label: 'Existing Vehicles',
      content: (
        <>
          <h3>Existing Vehicles</h3>
          {isLoading ? <p>Loading vehicles...</p> : error ? <p style={{color: 'red'}}>Error: {error}</p> : vehicles.length === 0 ? <p>No vehicles found.</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {vehicles.map(vehicle => {
                return (
                  <li key={vehicle.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '0.8rem', borderRadius: '4px', background: '#fff', color: '#212529' }}>
                    <strong>{vehicle.make} {vehicle.model}</strong> ({vehicle.year || 'Year N/A'})<br />
                    Color: {vehicle.color || 'N/A'}<br />
                    License Plate: {vehicle.license_plate || 'N/A'}<br />
                    Pet Capacity: {vehicle.pet_capacity ?? 'N/A'}<br />
                    Notes: {vehicle.notes || 'N/A'}<br />
                    <button onClick={() => onDelete(vehicle.id)} className="button danger small" style={{ marginTop: '0.5rem' }}>Delete</button>
                    {/* Edit functionality can be added here if needed */}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )
    },
    {
      id: 'add',
      label: 'Add New Vehicle',
      content: (
        <>
          {/* Add New Vehicle Form */}
          <form ref={addFormRef} onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);
            try {
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
            } catch (submitError) {
              console.error("Failed to add vehicle:", submitError);
              // Optionally set a local error state to display in this tab
            }
          }} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h3>Add New Vehicle</h3>
            <div style={{marginBottom: '0.5rem'}}><label>Make: <input name="make" required className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>Model: <input name="model" required className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>Year: <input name="year" type="number" min="1900" max="2100" className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>Color: <input name="color" className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>License Plate: <input name="license_plate" className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>Pet Capacity: <input name="pet_capacity" type="number" min="0" className="input"/></label></div>
            <div style={{marginBottom: '0.5rem'}}><label>Notes: <textarea name="notes" className="input" rows={2}></textarea></label></div>
            <button type="submit" style={{ marginTop: '1rem' }} className="button primary">Add Vehicle</button>
          </form>
        </>
      )
    },
  ];

  return (
    <section>
      <h2>Vehicle Management (Admin)</h2>
      {/* Removed Add Form and Existing List from here */}
      {/* Render Tabs */}
      <TabNavigation tabs={vehicleMgmtTabs} />
      {/* Display global error maybe? Or handle errors within tabs */}
      {/* {error && <p style={{ color: 'red' }}>{error}</p>} */}
    </section>
  );
}