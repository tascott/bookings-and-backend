'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import styles from "@/app/page.module.css";
// Use shared Pet type
import { Pet, AddPetPayload, UpdatePetPayload } from '@booking-and-accounts-monorepo/shared-types';
// Import service functions
import { fetchUserPets, addPet, updatePet, deletePet } from '@booking-and-accounts-monorepo/api-services';

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

    // Fetch pets using service
    const fetchPets = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchUserPets(); // Use service
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

        const payload: AddPetPayload = {
            name: newPetName.trim(),
            breed: newPetBreed.trim() || undefined,
            size: newPetSize.trim() || undefined,
        };

        try {
            await addPet(payload); // Use service
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
            const payload: UpdatePetPayload = {
                name: editPetName.trim(),
                breed: editPetBreed.trim() || undefined,
                size: editPetSize.trim() || undefined,
            };
            await updatePet(editingPet.id, payload); // Use service
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
    const handleDeleteClick = async (petId: number) => {
        if (!window.confirm('Are you sure you want to delete this pet?')) {
            return;
        }
        // Optionally set a deleting state for the specific pet
        setError(null);
        try {
            await deletePet(petId); // Use service
            await fetchPets(); // Refresh the list
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
            console.error("Delete Pet Error:", e);
        }
    };

    return (
        <div className={styles.container}>
            <h3>My Pets</h3>

            {/* Display Error Message */}
            {error && <p className={styles.errorText}>Error: {error}</p>}

            {/* Add Pet Button */}
            <div style={{ marginBottom: '1rem' }}>
                 <button onClick={() => setIsAddModalOpen(true)} className={styles.button}>Add New Pet</button>
            </div>

            {/* Pet List */}
            {isLoading ? (
                <p>Loading pets...</p>
            ) : pets.length === 0 ? (
                <p>You haven't added any pets yet.</p>
            ) : (
                <ul className={styles.list}>
                    {pets.map((pet) => (
                        <li key={pet.id} className={styles.listItem}>
                             {/* Simplified Display - removed edit form inline */}
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <span>
                                     <strong>{pet.name}</strong> ({pet.breed || 'Unknown Breed'}, {pet.size || 'Unknown Size'})
                                </span>
                                <div>
                                     <button onClick={() => handleEditClick(pet)} className={`${styles.button} ${styles.buttonSmall} ${styles.buttonSecondary}`} style={{ marginRight: '0.5rem' }}>Edit</button>
                                     <button onClick={() => handleDeleteClick(pet.id)} className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}>Delete</button>
                                 </div>
                             </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Add Pet Modal */}
            {isAddModalOpen && (
                 <div className={styles.modalOverlay}>
                     <div className={styles.modalContent}>
                         <h4 style={{ marginTop: 0 }}>Add New Pet</h4>
                         {/* Display error specific to add modal if needed */}
                         <form onSubmit={handleAddPetSubmit}>
                             <div className={styles.formField}>
                                 <label htmlFor="newPetName">Name:</label>
                                 <input
                                     type="text"
                                     id="newPetName"
                                     value={newPetName}
                                     onChange={(e) => setNewPetName(e.target.value)}
                                     required
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formField}>
                                 <label htmlFor="newPetBreed">Breed:</label>
                                 <input
                                     type="text"
                                     id="newPetBreed"
                                     value={newPetBreed}
                                     onChange={(e) => setNewPetBreed(e.target.value)}
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formField}>
                                 <label htmlFor="newPetSize">Size:</label>
                                 <input
                                     type="text"
                                     id="newPetSize"
                                     value={newPetSize}
                                     onChange={(e) => setNewPetSize(e.target.value)}
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formActions}>
                                 <button type="button" onClick={() => setIsAddModalOpen(false)} className={`${styles.button} ${styles.buttonSecondary}`} disabled={isAdding}>Cancel</button>
                                 <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={isAdding}>{isAdding ? 'Adding...' : 'Add Pet'}</button>
                             </div>
                         </form>
                     </div>
                 </div>
            )}

            {/* Edit Pet Modal */}
            {editingPet && (
                 <div className={styles.modalOverlay}>
                     <div className={styles.modalContent}>
                         <h4 style={{ marginTop: 0 }}>Edit Pet: {editingPet.name}</h4>
                         {/* Display error specific to edit modal if needed */}
                         <form onSubmit={handleUpdatePetSubmit}>
                             <div className={styles.formField}>
                                 <label htmlFor="editPetName">Name:</label>
                                 <input
                                     type="text"
                                     id="editPetName"
                                     value={editPetName}
                                     onChange={(e) => setEditPetName(e.target.value)}
                                     required
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formField}>
                                 <label htmlFor="editPetBreed">Breed:</label>
                                 <input
                                     type="text"
                                     id="editPetBreed"
                                     value={editPetBreed}
                                     onChange={(e) => setEditPetBreed(e.target.value)}
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formField}>
                                 <label htmlFor="editPetSize">Size:</label>
                                 <input
                                     type="text"
                                     id="editPetSize"
                                     value={editPetSize}
                                     onChange={(e) => setEditPetSize(e.target.value)}
                                     className={styles.input}
                                 />
                             </div>
                             <div className={styles.formActions}>
                                 <button type="button" onClick={handleCancelEdit} className={`${styles.button} ${styles.buttonSecondary}`} disabled={isUpdating}>Cancel</button>
                                 <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={isUpdating}>{isUpdating ? 'Updating...' : 'Save Changes'}</button>
                             </div>
                         </form>
                     </div>
                 </div>
             )}
        </div>
    );
}