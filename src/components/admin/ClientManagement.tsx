'use client';

import { useState, useEffect, useCallback } from 'react';

// Define types
type Pet = {
  id: number;
  client_id: number;
  name: string;
  breed?: string | null;
  size?: string | null;
  created_at?: string;
  is_confirmed?: boolean;
}

type Client = {
  id: number;
  user_id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null; // Computed property for backward compatibility with UI
  phone?: string | null;
  created_at?: string;
  default_staff_id?: number | null;
  default_staff_name?: string | null;
  pets: Pet[];
}

// Type for staff list items fetched from API
type StaffMemberListItem = {
    id: number;
    first_name: string | null;
    last_name: string | null;
}

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
  onSave: (clientId: number, updatedData: Partial<Client>) => Promise<void>;
  isUpdating: boolean;
  onAddPet: (clientId: number, petData: Partial<Pet>) => Promise<void>;
  onUpdatePet: (petId: number, petData: Partial<Pet>, isConfirmToggle?: boolean) => Promise<void>;
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
        default_staff_id: staffIdToSave
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
    }
  };

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPetName.trim()) {
      setError('Pet name is required');
      return;
    }

    setIsAddingPet(true);

    try {
      await onAddPet(client.id, {
        name: newPetName.trim(),
        breed: newPetBreed.trim() || null,
        size: newPetSize.trim() || null
      });

      // Reset form
      setNewPetName('');
      setNewPetBreed('');
      setNewPetSize('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
    } finally {
      setIsAddingPet(false);
    }
  };

  const handleUpdatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!editingPet || !editPetName.trim()) {
      setError('Pet name cannot be empty');
      return;
    }

    try {
      await onUpdatePet(editingPet.id, {
        name: editPetName.trim(),
        breed: editPetBreed.trim() || null,
        size: editPetSize.trim() || null
      });

      // Reset editing state
      setEditingPet(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
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
        maxHeight: '80vh',
        overflow: 'auto',
        color: 'black'
      }}>
        <h3>Manage Client</h3>
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
              <label htmlFor="clientFirstName" style={{ display: 'block', marginBottom: '5px' }}>First Name:</label>
              <input
                id="clientFirstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientLastName" style={{ display: 'block', marginBottom: '5px' }}>Last Name:</label>
              <input
                id="clientLastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientEmail" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input
                id="clientEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="clientPhone" style={{ display: 'block', marginBottom: '5px' }}>Phone:</label>
              <input
                id="clientPhone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="defaultStaff" style={{ display: 'block', marginBottom: '5px' }}>Default Staff Member:</label>
              <select
                id="defaultStaff"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: 'white', color: 'black' }}
              >
                <option value="">-- Unassigned --</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {`${staff.first_name || ''} ${staff.last_name || ''}`.trim() || `Staff ID: ${staff.id}`}
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
              <h4 style={{ marginTop: 0 }}>Add New Pet</h4>
              <form onSubmit={handleAddPet}>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="newPetName" style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
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
                  <label htmlFor="newPetBreed" style={{ display: 'block', marginBottom: '5px' }}>Breed (Optional):</label>
                  <input
                    id="newPetBreed"
                    type="text"
                    value={newPetBreed}
                    onChange={(e) => setNewPetBreed(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="newPetSize" style={{ display: 'block', marginBottom: '5px' }}>Size (Optional):</label>
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
            <h4>Client's Pets</h4>
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
                          <label htmlFor={`editPetName-${pet.id}`} style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
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
                          <label htmlFor={`editPetBreed-${pet.id}`} style={{ display: 'block', marginBottom: '5px' }}>Breed:</label>
                          <input
                            id={`editPetBreed-${pet.id}`}
                            type="text"
                            value={editPetBreed}
                            onChange={(e) => setEditPetBreed(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label htmlFor={`editPetSize-${pet.id}`} style={{ display: 'block', marginBottom: '5px' }}>Size:</label>
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
                            <h5 style={{ margin: '0 0 5px 0' }}>{pet.name}</h5>
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
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);
  const [updatingPetId, setUpdatingPetId] = useState<number | null>(null);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
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
  const fetchClients = useCallback(async () => {
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
    fetchClients();
  }, [fetchClients]);

  // Toggle expanded client view
  const toggleClientExpand = (clientId: number) => {
    setExpandedClientId(prevId => prevId === clientId ? null : clientId);
  };

  // Toggle pet confirmation status
  const togglePetConfirmation = async (petId: number, currentStatus: boolean) => {
    setUpdatingPetId(petId);
    setError(null);

    try {
      const response = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_confirmed: !currentStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update pet (HTTP ${response.status})`);
      }

      const updatedPet: Pet = await response.json();

      // Update the local state
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.map(pet =>
            pet.id === petId ? { ...pet, is_confirmed: updatedPet.is_confirmed } : pet
          )
        }))
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Update Pet Error:", e);
      setError(errorMessage);
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Update client information
  const updateClient = async (clientId: number, updatedData: Partial<Client>) => {
    setIsUpdatingClient(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update client (HTTP ${response.status})`);
      }

      const updatedClient = await response.json();

      // Update the local state
      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientId ? { ...client, ...updatedClient } : client
        )
      );

      // Close the modal
      setEditingClientId(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Update Client Error:", e);
      setError(errorMessage);
      throw e; // Re-throw to handle in the modal
    } finally {
      setIsUpdatingClient(false);
    }
  };

  // Add a new pet for a client
  const addPet = async (clientId: number, petData: Partial<Pet>) => {
    setError(null);

    try {
      const response = await fetch(`/api/clients/${clientId}/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(petData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to add pet (HTTP ${response.status})`);
      }

      const newPet: Pet = await response.json();

      // Update the local state
      setClients(prevClients =>
        prevClients.map(client =>
          client.id === clientId
            ? { ...client, pets: [...client.pets, newPet] }
            : client
        )
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Add Pet Error:", e);
      setError(errorMessage);
      throw e; // Re-throw to handle in the modal
    }
  };

  // Update a pet
  const updatePet = async (petId: number, petData: Partial<Pet>, isConfirmToggle = false) => {
    // If it's a confirmation toggle, use the existing togglePetConfirmation function
    if (isConfirmToggle && petData.hasOwnProperty('is_confirmed')) {
      return togglePetConfirmation(petId, !petData.is_confirmed!);
    }

    setUpdatingPetId(petId);
    setError(null);

    try {
      const response = await fetch(`/api/pets/${petId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(petData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update pet (HTTP ${response.status})`);
      }

      const updatedPet: Pet = await response.json();

      // Update the local state
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.map(pet =>
            pet.id === petId ? { ...pet, ...updatedPet } : pet
          )
        }))
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Update Pet Error:", e);
      setError(errorMessage);
      throw e; // Re-throw to handle in the modal
    } finally {
      setUpdatingPetId(null);
    }
  };

  // Delete a pet
  const deletePet = async (petId: number) => {
    setUpdatingPetId(petId);
    setError(null);

    // Confirm before deleting
    if (!window.confirm("Are you sure you want to delete this pet?")) {
      setUpdatingPetId(null);
      return;
    }

    try {
      const response = await fetch(`/api/pets/${petId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete pet (HTTP ${response.status})`);
      }

      // Update the local state
      setClients(prevClients =>
        prevClients.map(client => ({
          ...client,
          pets: client.pets.filter(pet => pet.id !== petId)
        }))
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Delete Pet Error:", e);
      setError(errorMessage);
      throw e; // Re-throw to handle in the modal
    } finally {
      setUpdatingPetId(null);
    }
  };

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
        <button onClick={fetchClients} disabled={isLoading} style={{ marginLeft: 16 }}>
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
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>
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
                    onClick={() => setEditingClientId(client.id)}
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
                    {expandedClientId === client.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expandedClientId === client.id && (
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
      {editingClientId !== null && (
         <ClientEditModal
           client={clients.find(c => c.id === editingClientId)!}
           onClose={() => setEditingClientId(null)}
           onSave={updateClient}
           isUpdating={isUpdatingClient}
           onAddPet={addPet}
           onUpdatePet={updatePet}
           onDeletePet={deletePet}
           updatingPetId={updatingPetId}
           staffList={staffList}
         />
       )}
    </section>
  );
}