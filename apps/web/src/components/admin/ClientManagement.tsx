'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GeocoderAutocomplete } from '@geoapify/geocoder-autocomplete';
import '@geoapify/geocoder-autocomplete/styles/round-borders-dark.css'; // Use round-borders-dark theme
import { fetchClients, updateClient, addClientPet, fetchStaffMembers } from '@booking-and-accounts-monorepo/api-services';
import { updatePet as updatePetApi, deletePet as deletePetApi, togglePetConfirmation as togglePetConfirmationApi } from '@booking-and-accounts-monorepo/api-services';
import type { Client, Pet, StaffMemberListItem, UpdateClientPayload, AddPetPayload, UpdatePetPayload } from '@booking-and-accounts-monorepo/shared-types';

// Modal component for editing client
function ClientEditModal({
  client,
  onClose,
  onSave,
  isUpdating,
  onAddPet,
  onUpdatePet,
  onDeletePet,
  updatingPetId,
  staffList
}: {
  client: Client;
  onClose: () => void;
  onSave: (clientId: number, updatedData: UpdateClientPayload) => Promise<void>;
  isUpdating: boolean;
  onAddPet: (clientId: number, petData: AddPetPayload) => Promise<void>;
  onUpdatePet: (petId: number, petData: UpdatePetPayload, isConfirmToggle?: boolean) => Promise<void>;
  onDeletePet: (petId: number) => Promise<void>;
  updatingPetId: number | null;
  staffList: StaffMemberListItem[];
}) {
  // Use first_name as the primary source, falling back to name for backward compatibility
  const [firstName, setFirstName] = useState(client.first_name || '');
  const [lastName, setLastName] = useState(client.last_name || '');
  const [email, setEmail] = useState(client.email || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [error, setError] = useState<string | null>(null);

  // Add address state variables
  const [addressLine1, setAddressLine1] = useState(client.address_line_1 || '');
  const [addressLine2, setAddressLine2] = useState(client.address_line_2 || '');
  const [townOrCity, setTownOrCity] = useState(client.town_or_city || '');
  const [county, setCounty] = useState(client.county || '');
  const [postcode, setPostcode] = useState(client.postcode || '');
  const [country, setCountry] = useState(client.country || '');
  const [latitude, setLatitude] = useState<number | null>(client.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(client.longitude || null);

  // Ref for the autocomplete container
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'info' | 'pets'>('info');

  // Pet form states
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetSize, setNewPetSize] = useState('');
  const [isAddingPet, setIsAddingPet] = useState(false);

  // Pet editing states
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [editPetName, setEditPetName] = useState('');
  const [editPetBreed, setEditPetBreed] = useState('');
  const [editPetSize, setEditPetSize] = useState('');

  const [selectedStaffId, setSelectedStaffId] = useState<number | string>(client.default_staff_id ?? '');

  // Initialize Geoapify Autocomplete
  useEffect(() => {
    // Ensure API key is available
    const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
    if (!apiKey) {
      console.error("[Admin Modal] Geoapify API key not found. Please set NEXT_PUBLIC_GEOAPIFY_KEY environment variable.");
      setError("Address lookup configuration error.");
      return;
    }

    let autocompleteInstance: GeocoderAutocomplete | null = null;

    if (autocompleteContainerRef.current) {
      // Clear previous instance content manually if cleanup method is unknown
      autocompleteContainerRef.current.innerHTML = '';

      autocompleteInstance = new GeocoderAutocomplete(
        autocompleteContainerRef.current,
        apiKey,
        {
          lang: 'en',
          filter: { countrycode: ['gb'] },
          placeholder: 'Start typing address...',
          skipIcons: true,
        }
      );

      autocompleteInstance.on('select', (location) => {
        // Handle selected address
        console.log('[Admin Modal] Selected address:', location);
        if (location && location.properties) {
          const props = location.properties;
          setAddressLine1(props.address_line1 || '');
          setAddressLine2(''); // DO NOT auto-populate line 2
          setTownOrCity(props.city || '');
          setCounty(props.county || ''); // May not always be present
          setPostcode(props.postcode || '');
          setCountry(props.country || '');
          setLatitude(props.lat || null);
          setLongitude(props.lon || null);
        }
      });

      console.log("[Admin Modal] Geoapify Initialized for client:", client.id);
    }

    // Cleanup function
    return () => {
      if (autocompleteContainerRef.current) {
         // Attempt manual cleanup again if instance might persist
         autocompleteContainerRef.current.innerHTML = '';
         console.log("[Admin Modal] Geoapify Cleaned up for client:", client.id);
      }
      // In a real scenario, if autocompleteInstance had a .remove() or .destroy(),
      // you'd call it here: autocompleteInstance?.remove();
    };
  }, [client.id]); // Re-run effect when the client ID changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Convert selectedStaffId back to number or null before saving
    const staffIdToSave = selectedStaffId === '' ? null : Number(selectedStaffId);

    try {
      await onSave(client.id, {
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone: phone || null,
        default_staff_id: staffIdToSave,
        // Include address fields
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        town_or_city: townOrCity || null,
        county: county || null,
        postcode: postcode || null,
        country: country || null,
        latitude: latitude,
        longitude: longitude
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newPetName.trim()) { setError('Pet name is required'); return; }

    // Construct AddPetPayload
    const payload: AddPetPayload = {
        name: newPetName.trim(),
        breed: newPetBreed.trim() || undefined,
        size: newPetSize.trim() || undefined,
    };
    setIsAddingPet(true);
    try {
        await onAddPet(client.id, payload); // Pass correct payload type
        // Clear form on success
        setNewPetName('');
        setNewPetBreed('');
        setNewPetSize('');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add pet');
    } finally {
        setIsAddingPet(false);
    }
  };

  const handleUpdatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPet) return;
    setError(null);
    if (!editPetName.trim()) { setError('Pet name is required'); return; }

    // Construct UpdatePetPayload
    const payload: UpdatePetPayload = {
        name: editPetName.trim(),
        breed: editPetBreed.trim() || undefined,
        size: editPetSize.trim() || undefined,
    };

    // No need for setIsUpdatingPet state inside modal if parent handles it via updatingPetId
    try {
        await onUpdatePet(editingPet.id, payload); // Pass correct payload type
        cancelEditPet(); // Close edit form on success
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update pet');
    }
  };

  const startEditPet = (pet: Pet) => {
    setEditingPet(pet);
    setEditPetName(pet.name);
    setEditPetBreed(pet.breed || '');
    setEditPetSize(pet.size || '');
  };

  const cancelEditPet = () => {
    setEditingPet(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflow: 'auto',
        color: 'black'
      }}>
        {/* Global style override for suggestions dropdown z-index */}
        <style>
          {`
            .geoapify-autocomplete-items {
              z-index: 1050 !important; /* Try a high value, higher than typical modal z-indexes */
            }
          `}
        </style>
        <h3 style={{ color: '#333' }}>Manage Client</h3>
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          marginBottom: '20px',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'info' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'info' ? 'white' : '#212529',
              border: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Client Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pets')}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === 'pets' ? '#007bff' : '#f8f9fa',
              color: activeTab === 'pets' ? 'white' : '#212529',
              border: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Pets
          </button>
        </div>

        {/* Client Info Tab */}
        {activeTab === 'info' && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientFirstName" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>First Name:</label>
              <input
                id="clientFirstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientLastName" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Last Name:</label>
              <input
                id="clientLastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientEmail" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Email:</label>
              <input
                id="clientEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientPhone" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Phone:</label>
              <input
                id="clientPhone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Address Autocomplete Section */}
            <div style={{ marginBottom: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
              <label htmlFor="addressAutocomplete" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Find Address:</label>
              {/* Add position: relative to help dropdown positioning */}
              <div id="addressAutocomplete" ref={autocompleteContainerRef} style={{ marginBottom: '10px', width: '100%', position: 'relative' }}>
                {/* The library will inject the input here */}
              </div>
              <p style={{fontSize: '0.8em', color: '#666', margin: '0 0 10px 0'}}>Start typing the address above to find and populate the fields below.</p>
            </div>

            {/* Manual Address Fields */}
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="addressLine1" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Address Line 1:</label>
              <input
                id="addressLine1"
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="addressLine2" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Address Line 2:</label>
              <input
                id="addressLine2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label htmlFor="townOrCity" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Town/City:</label>
                    <input
                        id="townOrCity"
                        type="text"
                        value={townOrCity}
                        onChange={(e) => setTownOrCity(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label htmlFor="county" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>County:</label>
                    <input
                        id="county"
                        type="text"
                        value={county}
                        onChange={(e) => setCounty(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                    <label htmlFor="postcode" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Postcode:</label>
                    <input
                        id="postcode"
                        type="text"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label htmlFor="country" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Country:</label>
                    <input
                        id="country"
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#f0f0f0' }}
                        readOnly // Country is typically set by autocomplete
                    />
                </div>
            </div>
             {/* Display Lat/Lon for verification (optional) */}
             {latitude && longitude && (
                 <p style={{ fontSize: '0.8em', color: '#666', marginTop: '-5px', marginBottom: '15px' }}>
                     Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                 </p>
             )}

            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="defaultStaff" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Default Staff Member:</label>
              <select
                id="defaultStaff"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: 'white', color: 'black' }}
              >
                <option value="">-- Unassigned --</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {`${staff.profile?.first_name || ''} ${staff.profile?.last_name || ''}`.trim() || `Staff ID: ${staff.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isUpdating ? 'not-allowed' : 'pointer'
                }}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Pets Tab */}
        {activeTab === 'pets' && (
          <div>
            {/* Add New Pet Form */}
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h4 style={{ marginTop: 0, color: '#333' }}>Add New Pet</h4>
              <form onSubmit={handleAddPet}>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="newPetName" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Name:</label>
                  <input
                    id="newPetName"
                    type="text"
                    value={newPetName}
                    onChange={(e) => setNewPetName(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="newPetBreed" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Breed (Optional):</label>
                  <input
                    id="newPetBreed"
                    type="text"
                    value={newPetBreed}
                    onChange={(e) => setNewPetBreed(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="newPetSize" style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Size (Optional):</label>
                  <input
                    id="newPetSize"
                    type="text"
                    value={newPetSize}
                    onChange={(e) => setNewPetSize(e.target.value)}
                    placeholder="e.g., Small, Medium, Large"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingPet}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isAddingPet ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isAddingPet ? 'Adding...' : 'Add Pet'}
                </button>
              </form>
            </div>

            {/* Pet List */}
            <h4 style={{ color: '#333' }}>Client&apos;s Pets</h4>
            {client.pets.length === 0 ? (
              <p>This client has no pets.</p>
            ) : (
              <div>
                {client.pets.map(pet => (
                  <div key={pet.id} style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    {editingPet && editingPet.id === pet.id ? (
                      // Edit Pet Form
                      <form onSubmit={handleUpdatePet}>
                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor={`editPetName-${pet.id}`} style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Name:</label>
                          <input
                            id={`editPetName-${pet.id}`}
                            type="text"
                            value={editPetName}
                            onChange={(e) => setEditPetName(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                            required
                          />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor={`editPetBreed-${pet.id}`} style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Breed:</label>
                          <input
                            id={`editPetBreed-${pet.id}`}
                            type="text"
                            value={editPetBreed}
                            onChange={(e) => setEditPetBreed(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor={`editPetSize-${pet.id}`} style={{ display: 'block', marginBottom: '5px', color: '#333' }}>Size:</label>
                          <input
                            id={`editPetSize-${pet.id}`}
                            type="text"
                            value={editPetSize}
                            onChange={(e) => setEditPetSize(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="submit"
                            disabled={updatingPetId === pet.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: updatingPetId === pet.id ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {updatingPetId === pet.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditPet}
                            disabled={updatingPetId === pet.id}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: updatingPetId === pet.id ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      // Display Pet Info
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h5 style={{ margin: '0 0 5px 0', color: '#333' }}>{pet.name}</h5>
                            <div>
                              {pet.breed && <span style={{ marginRight: '10px' }}><strong>Breed:</strong> {pet.breed}</span>}
                              {pet.size && <span><strong>Size:</strong> {pet.size}</span>}
                            </div>
                            <div style={{ marginTop: '5px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                backgroundColor: pet.is_confirmed ? '#d4edda' : '#f8d7da',
                                color: pet.is_confirmed ? '#155724' : '#721c24'
                              }}>
                                {pet.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => onUpdatePet(pet.id, { is_confirmed: !pet.is_confirmed }, true)}
                              disabled={updatingPetId === pet.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: pet.is_confirmed ? '#dc3545' : '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: updatingPetId === pet.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {updatingPetId === pet.id ? '...' : pet.is_confirmed ? 'Unconfirm' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => startEditPet(pet)}
                              disabled={updatingPetId === pet.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: updatingPetId === pet.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDeletePet(pet.id)}
                              disabled={updatingPetId === pet.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: updatingPetId === pet.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [staffList, setStaffList] = useState<StaffMemberListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClientIds, setExpandedClientIds] = useState<Set<number>>(new Set());
  const [updatingPetId, setUpdatingPetId] = useState<number | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Fetch staff list on mount
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch('/api/staff');
        if (!response.ok) {
          throw new Error(`Failed to fetch staff list: ${response.statusText}`);
        }
        const data: StaffMemberListItem[] = await response.json();
        setStaffList(data);
      } catch (err) {
        console.error("Error fetching staff:", err);
        // Handle error appropriately, maybe set an error state
      }
    };
    fetchStaff();
  }, []);

  // Fetch paginated clients and their pets
  const fetchClientsAndStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', PAGE_SIZE.toString());
      params.append('offset', (page * PAGE_SIZE).toString());
      const response = await fetch(`/api/clients?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch clients (HTTP ${response.status})`);
      }
      const data = await response.json();
      setClients(data.clients || []);
      setTotal(data.total || 0);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Fetch Clients Error:", e);
      setError(errorMessage);
      setClients([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [search, page]);

  // Fetch data on mount and when search/page changes
  useEffect(() => {
    fetchClientsAndStaff();
  }, [fetchClientsAndStaff]);

  // Toggle expanded client view
  const toggleClientExpand = (clientId: number) => {
    setExpandedClientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Toggle pet confirmation status
  const togglePetConfirmation = async (petId: number, currentStatus: boolean) => {
    setUpdatingPetId(petId);
    setError(null);

    try {
      const updatedPet = await togglePetConfirmationApi(petId, !currentStatus);

      // Update local state
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.map(pet => pet.id === petId ? updatedPet : pet)
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update pet confirmation";
      console.error("Pet Confirm Error:", err);
      setError(message);
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Update client information
  const updateClientHandler = async (clientId: number, updatedData: UpdateClientPayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const updatedClient = await updateClient(clientId, updatedData);

      setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updatedClient } : c));
      setEditingClient(null); // Close modal on success
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update client";
      console.error("Update Client Error:", err);
      setError(message);
      // Re-throw or pass error to modal? For now, just set error state.
      throw err; // Re-throw so modal knows update failed
    } finally {
      setIsUpdating(false);
    }
  };

  // Add a new pet for a client
  const addPetHandler = async (clientId: number, petData: AddPetPayload) => {
    setUpdatingPetId(-1); // Indicate loading for adding a pet
    setError(null);
    try {
      const newPet = await addClientPet(clientId, petData);

      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientId
            ? { ...client, pets: [...client.pets, newPet] }
            : client
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add pet";
      console.error("Add Pet Error:", err);
      setError(message);
      throw err; // Re-throw so modal knows add failed
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Update a pet
  const updatePetHandler = async (petId: number, petData: UpdatePetPayload, isConfirmToggle = false) => {
    if (isConfirmToggle) {
       // Handled by togglePetConfirmation
       return;
    }
    setUpdatingPetId(petId);
    setError(null);
    try {
      const updatedPet = await updatePetApi(petId, petData);

      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.map(pet => pet.id === petId ? { ...pet, ...updatedPet } : pet)
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update pet";
      console.error("Update Pet Error:", err);
      setError(message);
      throw err; // Re-throw so modal knows update failed
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Delete a pet
  const deletePetHandler = async (petId: number) => {
    setUpdatingPetId(petId);
    setError(null);
    try {
      await deletePetApi(petId);

      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.filter(pet => pet.id !== petId)
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete pet";
      console.error("Delete Pet Error:", err);
      setError(message);
      // Potentially re-throw error if needed
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(client => {
    const searchTerm = search.toLowerCase();
    if (!searchTerm) return true;
    const name = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    const email = client.email?.toLowerCase() || '';
    const phone = client.phone || '';
    const postcode = client.postcode?.toLowerCase() || '';
    const pets = client.pets.map(p => p.name.toLowerCase()).join(' ');
    return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm) || postcode.includes(searchTerm) || pets.includes(searchTerm);
  });

  return (
    <section style={{ color: 'white' }}>
      <h2>Client Management</h2>
      {/* Search and Pagination Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', minWidth: 200 }}
        />
        <span style={{ color: '#666' }}>Total: {total}</span>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>&lt; Prev</button>
        <span>Page {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
        <button onClick={() => setPage(p => (p + 1 < Math.ceil(total / PAGE_SIZE) ? p + 1 : p))} disabled={page + 1 >= Math.ceil(total / PAGE_SIZE)}>Next &gt;</button>
        <button onClick={fetchClientsAndStaff} disabled={isLoading} style={{ marginLeft: 16 }}>
          {isLoading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      {/* Error display */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Loading state */}
      {isLoading ? (
        <p>Loading clients and pets...</p>
      ) : clients.length === 0 ? (
        <p>No clients found.</p>
      ) : (
        <div>
          {clients.map(client => (
            <div key={client.id} style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div
                  onClick={() => toggleClientExpand(client.id)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                    {
                      client.first_name || client.last_name ?
                        `${client.first_name || ''} ${client.last_name || ''}`.trim() :
                        client.email || `Client #${client.id}`
                    }
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9em', color: '#ccc' }}>
                    {client.email && <span>Email: {client.email}</span>}
                    {client.phone && <span> | Phone: {client.phone}</span>}
                    <span> | Pets: {client.pets.length}</span>
                    <span style={{ marginLeft: '10px' }}>
                       | Default Staff: {
                        client.default_staff_name
                          ? <span style={{ color: '#eee' }}>{client.default_staff_name}</span>
                          : <span style={{ fontStyle: 'italic', color: '#aaa' }}>Unassigned</span>
                       }
                     </span>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => setEditingClient(client)}
                    style={{
                       padding: '6px 12px',
                       backgroundColor: '#17a2b8',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       cursor: 'pointer'
                     }}
                  >
                    Manage
                  </button>
                  <span
                    onClick={() => toggleClientExpand(client.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {expandedClientIds.has(client.id) ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expandedClientIds.has(client.id) && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #eee' }}>
                  <h4>Pets</h4>
                  {client.pets.length === 0 ? (
                    <p>This client has no pets.</p>
                  ) : (
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                      {client.pets.map(pet => (
                        <li key={pet.id} style={{
                          padding: '0.5rem',
                          margin: '0.5rem 0',
                          background: '#f9f9f9',
                          borderRadius: '4px',
                          color: 'black'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{pet.name}</strong>
                              {pet.breed && <span> | Breed: {pet.breed}</span>}
                              {pet.size && <span> | Size: {pet.size}</span>}
                              <span style={{
                                marginLeft: '1rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                backgroundColor: pet.is_confirmed ? '#d4edda' : '#f8d7da',
                                color: pet.is_confirmed ? '#155724' : '#721c24'
                              }}>
                                {pet.is_confirmed ? 'Confirmed' : 'Unconfirmed'}
                              </span>
                            </div>
                            <button
                              onClick={() => togglePetConfirmation(pet.id, !!pet.is_confirmed)}
                              disabled={updatingPetId === pet.id}
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: pet.is_confirmed ? '#dc3545' : '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: updatingPetId === pet.id ? 'wait' : 'pointer'
                              }}
                            >
                              {updatingPetId === pet.id
                                ? 'Updating...'
                                : pet.is_confirmed
                                  ? 'Unconfirm Pet'
                                  : 'Confirm Pet'
                              }
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Client Edit Modal */}
      {editingClient && (
         <ClientEditModal
           client={editingClient}
           onClose={() => setEditingClient(null)}
           onSave={updateClientHandler}
           isUpdating={isUpdating}
           onAddPet={addPetHandler}
           onUpdatePet={updatePetHandler}
           onDeletePet={deletePetHandler}
           updatingPetId={updatingPetId}
           staffList={staffList}
         />
       )}
    </section>
  );
}