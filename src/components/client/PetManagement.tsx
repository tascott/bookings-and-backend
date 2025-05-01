'use client';

import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import styles from "@/app/page.module.css"; // Use existing styles or create new ones

// Define Pet type based on DB schema
type Pet = {
    id: number;
    client_id: number; // Should match the type of clients.id
    name: string;
    breed?: string | null;
    size?: string | null;
    created_at?: string;
    is_confirmed?: boolean;
    // Add other pet fields as needed
}

export default function PetManagement() {
    const [pets, setPets] = useState<Pet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for adding a new pet
    const [newPetName, setNewPetName] = useState('');
    const [newPetBreed, setNewPetBreed] = useState('');
    const [newPetSize, setNewPetSize] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // State for editing a pet
    const [editingPet, setEditingPet] = useState<Pet | null>(null);
    const [editPetName, setEditPetName] = useState('');
    const [editPetBreed, setEditPetBreed] = useState('');
    const [editPetSize, setEditPetSize] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Fetch pets
    const fetchPets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/pets');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch pets (HTTP ${response.status})`);
            }
            const data: Pet[] = await response.json();
            setPets(data);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            console.error("Fetch Pets Error:", e);
            setError(errorMessage);
            setPets([]); // Clear pets on error
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch pets on component mount
    useEffect(() => {
        fetchPets();
    }, [fetchPets]);

    // --- Add Pet Handlers ---
    const handleAddPetSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!newPetName.trim()) {
            setError('Pet name is required.');
            return;
        }
        setIsAdding(true);
        setError(null);
        try {
            const response = await fetch('/api/pets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPetName.trim(),
                    breed: newPetBreed.trim() || undefined,
                    size: newPetSize.trim() || undefined,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add pet (HTTP ${response.status})`);
            }
            // Success
            setNewPetName('');
            setNewPetBreed('');
            setNewPetSize('');
            await fetchPets(); // Refresh the list
            setIsAddModalOpen(false); // <-- Close modal on success
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
             // Keep modal open on error for correction
        } finally {
            setIsAdding(false);
        }
    };

    // --- Edit Pet Handlers ---
    const handleEditClick = (pet: Pet) => {
        setEditingPet(pet);
        setEditPetName(pet.name);
        setEditPetBreed(pet.breed || '');
        setEditPetSize(pet.size || '');
        setError(null); // Clear previous errors
    };

    const handleCancelEdit = () => {
        setEditingPet(null);
    };

    const handleUpdatePetSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingPet || !editPetName.trim()) {
            setError('Pet name cannot be empty for update.');
            return;
        }
        setIsUpdating(true);
        setError(null);
        try {
            const payload = {
                name: editPetName.trim(),
                breed: editPetBreed.trim() || undefined,
                size: editPetSize.trim() || undefined,
            };
            const response = await fetch(`/api/pets/${editingPet.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to update pet (HTTP ${response.status})`);
            }
            // Success - clear editing state and refetch list
            setEditingPet(null);
            await fetchPets(); // Refresh the list
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
        } finally {
            setIsUpdating(false);
        }
    };

    // --- Delete Pet Handler ---
    const handleDeletePet = async (petId: number) => {
        // Optional: Add confirmation dialog
        if (!window.confirm("Are you sure you want to delete this pet?")) {
            return;
        }
        // Set loading/disabled state for the specific pet being deleted?
        setError(null);
        try {
            const response = await fetch(`/api/pets/${petId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete pet (HTTP ${response.status})`);
            }
            // Success - refetch list
            await fetchPets(); // Refresh the list
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
        }
    };

    // --- Render Logic ---
    return (
        <section>
            <h2>My Pets</h2>

            {/* Display Global Error for this section */}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}

            {/* Button to open Add Pet modal */}
            <div style={{ marginBottom: '1rem' }}>
                <button onClick={() => setIsAddModalOpen(true)} className="button primary">
                    Add New Pet
                </button>
            </div>

            {/* --- List Existing Pets --- */}
            <h3>Existing Pets</h3>
            {isLoading ? (
                <p>Loading pets...</p>
            ) : pets.length === 0 && !error ? (
                <p>You haven&apos;t added any pets yet.</p>
            ) : (
                <div className={styles.petList}> {/* Use a class for styling */}
                    {pets.map(pet => (
                        <div key={pet.id} className={styles.petCard} style={{ border: '1px solid #eee', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
                            {editingPet && editingPet.id === pet.id ? (
                                // --- Edit Form ---
                                <form onSubmit={handleUpdatePetSubmit}>
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <label htmlFor={`editPetName-${pet.id}`}>Name:</label>
                                        <input
                                            type="text"
                                            id={`editPetName-${pet.id}`}
                                            value={editPetName}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPetName(e.target.value)}
                                            required
                                            style={{ marginLeft: '0.5rem' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <label htmlFor={`editPetBreed-${pet.id}`}>Breed:</label>
                                        <input
                                            type="text"
                                            id={`editPetBreed-${pet.id}`}
                                            value={editPetBreed}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPetBreed(e.target.value)}
                                            style={{ marginLeft: '0.5rem' }}
                                        />
                                    </div>
                                     <div style={{ marginBottom: '0.5rem' }}>
                                        <label htmlFor={`editPetSize-${pet.id}`}>Size:</label>
                                        <input
                                            type="text"
                                            id={`editPetSize-${pet.id}`}
                                            value={editPetSize}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => setEditPetSize(e.target.value)}
                                            style={{ marginLeft: '0.5rem' }}
                                        />
                                    </div>
                                    <button type="submit" disabled={isUpdating} style={{ marginRight: '0.5rem' }}>
                                        {isUpdating ? 'Saving...' : 'Save'}
                                    </button>
                                    <button type="button" onClick={handleCancelEdit} disabled={isUpdating}>
                                        Cancel
                                    </button>
                                </form>
                            ) : (
                                // --- Display Pet Info ---
                                <div>
                                    <p><strong>Name:</strong> {pet.name}</p>
                                    {pet.breed && <p><strong>Breed:</strong> {pet.breed}</p>}
                                    {pet.size && <p><strong>Size:</strong> {pet.size}</p>}
                                    <p>
                                        <strong>Status:</strong>
                                        <span style={{
                                            marginLeft: '0.5rem',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            backgroundColor: pet.is_confirmed ? '#d4edda' : '#f8d7da',
                                            color: pet.is_confirmed ? '#155724' : '#721c24',
                                            fontSize: '0.9rem'
                                        }}>
                                            {pet.is_confirmed ? 'Confirmed' : 'Awaiting Confirmation'}
                                        </span>
                                        {!pet.is_confirmed && (
                                            <span style={{
                                                display: 'block',
                                                marginTop: '0.3rem',
                                                fontSize: '0.85rem',
                                                fontStyle: 'italic'
                                            }}>
                                                *You cannot book services for unconfirmed pets. An admin needs to confirm your pet first.
                                            </span>
                                        )}
                                    </p>
                                    {/* Display other fields */}
                                    <div style={{ marginTop: '1rem' }}>
                                        <button onClick={() => handleEditClick(pet)} style={{ marginRight: '0.5rem' }}>Edit</button>
                                        <button onClick={() => handleDeletePet(pet.id)} style={{ color: 'red' }}>Delete</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add Pet Modal */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                         {/* --- Add Pet Form (Inside Modal) --- */}
                         <form onSubmit={handleAddPetSubmit}>
                            <h3>Add New Pet</h3>
                            {/* Display any add-specific error inside modal */}
                             {error && isAdding && <p style={{ color: '#f87171' }}>Error: {error}</p>}
                             <div style={{ marginBottom: '1rem' }}>
                                <label htmlFor="newPetName">Name:</label>
                                <input
                                    type="text"
                                    id="newPetName"
                                    value={newPetName}
                                    onChange={(e) => setNewPetName(e.target.value)}
                                    required
                                    className="input"
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label htmlFor="newPetBreed">Breed (Optional):</label>
                                <input
                                    type="text"
                                    id="newPetBreed"
                                    value={newPetBreed}
                                    onChange={(e) => setNewPetBreed(e.target.value)}
                                    className="input"
                            />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label htmlFor="newPetSize">Size (Optional):</label>
                                <input
                                    type="text"
                                    id="newPetSize"
                                    value={newPetSize}
                                    onChange={(e) => setNewPetSize(e.target.value)}
                                    placeholder="e.g., Small, Medium, Large"
                                    className="input"
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="button secondary" disabled={isAdding}>Cancel</button>
                                <button type="submit" disabled={isAdding} className="button primary">
                                    {isAdding ? 'Adding...' : 'Add Pet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}