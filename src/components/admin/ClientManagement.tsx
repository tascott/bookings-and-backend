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
  name?: string | null;
  phone?: string | null;
  created_at?: string;
  pets: Pet[];
}

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);
  const [updatingPetId, setUpdatingPetId] = useState<number | null>(null);

  // Fetch all clients and their pets
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/clients');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch clients (HTTP ${response.status})`);
      }
      const data: Client[] = await response.json();
      setClients(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error("Fetch Clients Error:", e);
      setError(errorMessage);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data on component mount
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

  return (
    <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '2rem' }}>
      <h2>Client Management</h2>

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
              <div
                onClick={() => toggleClientExpand(client.id)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>
                    {client.name || client.email || `Client #${client.id}`}
                  </h3>
                  <p style={{ margin: 0 }}>
                    {client.email && <span>Email: {client.email}</span>}
                    {client.phone && <span> | Phone: {client.phone}</span>}
                    <span> | Pets: {client.pets.length}</span>
                  </p>
                </div>
                <span>{expandedClientId === client.id ? '▲' : '▼'}</span>
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

      <button onClick={fetchClients} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh List'}
      </button>
    </section>
  );
}