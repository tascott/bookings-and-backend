'use client'; // Ensure this is at the top

import React, { useRef, useState } from 'react';
import TabNavigation from '@/components/TabNavigation'; // Import TabNavigation
import type { Vehicle } from '@/types';

// Define the shape of the fields being edited
interface EditVehicleFields {
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    license_plate: string | null;
    notes: string | null;
    pet_capacity: number | null;
}

interface VehicleManagementProps {
  vehicles: Vehicle[];
  isLoading: boolean;
  error: string | null;
  onAdd: (vehicle: Partial<Vehicle>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Vehicle>) => Promise<void>;
}

export default function VehicleManagement({ vehicles, isLoading, error, onAdd, onDelete, onUpdate }: VehicleManagementProps) {
  const addFormRef = useRef<HTMLFormElement>(null);

  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editFields, setEditFields] = useState<EditVehicleFields>({ // State to hold edits
      make: '', model: '', year: null, color: '', license_plate: '', notes: '', pet_capacity: null
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null); // Error specific to editing

  // Open Edit Modal
  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    // Initialize edit fields with current vehicle data
    setEditFields({
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year ?? null,
        color: vehicle.color ?? null,
        license_plate: vehicle.license_plate ?? null,
        notes: vehicle.notes ?? null,
        pet_capacity: vehicle.pet_capacity ?? null,
    });
    setEditError(null); // Clear previous errors
    setIsSaving(false); // Reset saving state
    setIsEditModalOpen(true);
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingVehicle(null);
    // Optionally clear editFields too, though they get reset on open
  };

  // Handle changes in edit form
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const newValue = type === 'number' ? (value === '' ? null : Number(value)) : value;
      setEditFields(prev => ({ ...prev, [name]: newValue }));
  };

  // Handle saving edits
  const handleEditSave = async () => {
      if (!editingVehicle) return;
      setIsSaving(true);
      setEditError(null);
      try {
          // Construct the update payload
          const updates: Partial<Vehicle> = {
              make: editFields.make,
              model: editFields.model,
              year: editFields.year,
              color: editFields.color,
              license_plate: editFields.license_plate,
              notes: editFields.notes,
              pet_capacity: editFields.pet_capacity,
          };
          await onUpdate(editingVehicle.id, updates);
          closeEditModal(); // Close modal on success
      } catch (e) {
          setEditError(e instanceof Error ? e.message : 'Failed to save changes');
      } finally {
          setIsSaving(false);
      }
  };

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
                    {/* Change link to button calling openEditModal */}
                    <button onClick={() => openEditModal(vehicle)} className="button small" style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}>Edit</button>
                    <button onClick={() => onDelete(vehicle.id)} className="button danger small" style={{ marginTop: '0.5rem' }}>Delete</button>
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
      {/* Render Tabs */}
      <TabNavigation tabs={vehicleMgmtTabs} />

      {/* Edit Modal */}
      {isEditModalOpen && editingVehicle && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                <h3>Edit Vehicle: {editingVehicle.make} {editingVehicle.model}</h3>
                {editError && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{editError}</p>}

                {/* Edit Form Fields */}
                <div style={{ marginBottom: '1rem' }}>
                    <label>Make:<br />
                        <input type="text" name="make" value={editFields.make} onChange={handleEditChange} required className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Model:<br />
                        <input type="text" name="model" value={editFields.model} onChange={handleEditChange} required className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Year:<br />
                        <input type="number" name="year" min="1900" max="2100" value={editFields.year ?? ''} onChange={handleEditChange} className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                 <div style={{ marginBottom: '1rem' }}>
                    <label>Color:<br />
                        <input type="text" name="color" value={editFields.color ?? ''} onChange={handleEditChange} className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                 <div style={{ marginBottom: '1rem' }}>
                    <label>License Plate:<br />
                        <input type="text" name="license_plate" value={editFields.license_plate ?? ''} onChange={handleEditChange} className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Pet Capacity:<br />
                        <input type="number" name="pet_capacity" min="0" value={editFields.pet_capacity ?? ''} onChange={handleEditChange} className="input" style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Notes:<br />
                        <textarea name="notes" value={editFields.notes ?? ''} onChange={handleEditChange} className="input" rows={3} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#333', color: '#fff', border: '1px solid #555' }}/>
                    </label>
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button onClick={closeEditModal} className="button secondary" disabled={isSaving}>Cancel</button>
                    <button onClick={handleEditSave} className="button primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
      )}
    </section>
  );
}