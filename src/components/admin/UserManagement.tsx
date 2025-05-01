'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed
// import type { User } from '@supabase/supabase-js'; // Removed unused import
// Import Staff and Vehicle types
import type { UserWithRole, Vehicle } from '@/types';
import type { StaffMemberListItem } from '@/types'; // Import StaffMemberListItem
// import type { User } from '@supabase/supabase-js'; // Removed unused User import
import { useState, useEffect, useRef, useCallback } from 'react';
import TabNavigation from '@/components/TabNavigation'; // Import the TabNavigation component

// Define props for the component
interface UserManagementProps {
    users: UserWithRole[];
    staff: StaffMemberListItem[]; // Add staff list
    vehicles: Vehicle[]; // Add vehicles list
    isLoadingUsers: boolean;
    error: string | null;
    updatingUserId: string | null; // Track which user is being updated
    handleAssignRole: (userId: string, role: string) => Promise<void>;
    handleAssignDefaultVehicle: (staffId: number, vehicleId: number | null) => Promise<void>; // Add handler
    onUserUpdated: () => Promise<void>; // Callback to refetch users after update
}

export default function UserManagement({
    users,
    staff, // Add staff to props
    vehicles, // Add vehicles to props
    isLoadingUsers,
    error,
    updatingUserId,
    handleAssignRole,
    handleAssignDefaultVehicle, // Add handler to props
    onUserUpdated
}: UserManagementProps) {
    // Edit modal state
    const [editError, setEditError] = useState<string | null>(null);

    // Simplify editingUser state type
    const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
    // --- Restore editFields state ---
    const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '', notes: '' });
    const [isSaving, setIsSaving] = useState(false);

    // --- Promote Client Autocomplete State ---
    const [clientSearch, setClientSearch] = useState('');
    const [filteredClients, setFilteredClients] = useState<UserWithRole[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserWithRole | null>(null);
    const [promoteError, setPromoteError] = useState<string | null>(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Correctly placed helper functions ---
    const removeSelectedClient = () => {
        setSelectedClient(null);
        setClientSearch('');
    };

    const promoteToStaff = async () => {
        if (!selectedClient) {
            setPromoteError('No client selected.');
            return;
        }
        // Ensure the user doesn't already exist in the staff list by checking user_id (which is the auth ID)
        const alreadyStaff = staff.find(s => s.user_id === selectedClient.id);
        if (alreadyStaff) {
             setPromoteError('This user is already staff or admin.');
             return;
        }
        setIsPromoting(true);
        setPromoteError(null);
        try {
            // Call the handleAssignRole function passed via props
            await handleAssignRole(selectedClient.id, 'staff');
            setPromoteError(null);
            setSelectedClient(null); // Clear selection on success
            setClientSearch('');
            // Optionally refetch all users if needed, or rely on parent component
             await onUserUpdated();
        } catch (e) {
            setPromoteError(e instanceof Error ? e.message : 'Failed to promote user');
        } finally {
            setIsPromoting(false);
        }
    };
    // -----------------------------------------

    // Fetch filtered clients as user types
    useEffect(() => {
        if (!clientSearch) {
            setFilteredClients([]);
            return;
        }
        const controller = new AbortController();
        const fetchClients = async () => {
            try {
                const res = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=10`, { signal: controller.signal });
                const data = await res.json();
                setFilteredClients(data.clients || []);
            } catch (e: unknown) {
                if (typeof e === 'object' && e && 'name' in e && (e as { name?: string }).name !== 'AbortError') {
                    setFilteredClients([]);
                }
            }
        };
        fetchClients();
        return () => controller.abort();
    }, [clientSearch]);

    // Handle promote
    const handlePromote = async (targetRole: 'staff' | 'admin') => {
        if (!selectedClient) return;
        setIsPromoting(true);
        setPromoteError(null);
        if (!window.confirm(`Are you sure you want to promote ${selectedClient.email} to ${targetRole}?`)) {
            setIsPromoting(false);
            return;
        }
        try {
            await handleAssignRole(selectedClient.user_id || selectedClient.id, targetRole);
            setSelectedClient(null);
            setClientSearch('');
            setFilteredClients([]);
            if (onUserUpdated) await onUserUpdated();
        } catch (e) {
            setPromoteError(e instanceof Error ? e.message : 'Failed to promote user');
        } finally {
            setIsPromoting(false);
        }
    };

    // Prepare staff details including profile and vehicle info
    const staffUserDetails = users
        .filter(u => u.role === 'staff' || u.role === 'admin')
        .map(u => {
            // Find matching staff record using user.id (which is the auth user_id)
            const staffRecord = staff.find(s => s.user_id === u.id);
            return {
                ...u,
                staff_id: staffRecord?.id, // Get the staff table primary key (staff.id)
                default_vehicle_id: staffRecord?.default_vehicle_id,
            };
        });
    // const clients = users.filter(u => u.role === 'client'); // Remove unused variable

    // Filter for Tabs
    const staffOnly = staffUserDetails.filter(u => u.role === 'staff');
    const adminsOnly = staffUserDetails.filter(u => u.role === 'admin');

    const openEditModal = useCallback((user: UserWithRole) => {
        setEditingUser(user);
        // --- Set initial editFields based on user ---
        setEditFields({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            phone: user.phone || '',
            notes: user.notes || '' // Access notes optionally
        });
        setEditError(null);
    }, []);

    const closeEdit = () => {
        setEditingUser(null);
        setEditError(null);
    };
    // Handle editing field changes
    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // --- Restore implementation ---
        setEditFields(f => ({ ...f, [e.target.name]: e.target.value }));
    };
    const handleEditSave = async () => {
        if (!editingUser) return;
        // --- Restore implementation ---
        setIsSaving(true);
        setEditError(null);
        try {
            const response = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFields) // Send editFields state
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update user');
            }
            closeEdit();
            if (typeof onUserUpdated === 'function') await onUserUpdated();
        } catch (e) {
            setEditError(e instanceof Error ? e.message : 'Failed to update user');
        } finally {
            setIsSaving(false);
        }
    };

    // Define Tabs Content (Reordered)
    const userMgmtTabs = [
        {
            id: 'staff',
            label: 'Staff Management',
            content: (
                <> {/* Wrap in fragment */}
                    {isLoadingUsers && <p>Loading staff...</p>}
                    {!isLoadingUsers && staffOnly.length > 0 && (
                        <div className={styles.userList}>
                            {/* Staff table header */}
                             <div className={styles.userCardHeader}>
                                <div>Email</div>
                                <div>First Name</div>
                                <div>Last Name</div>
                                <div>Phone</div>
                                <div>Default Vehicle</div>
                                <div>Created At</div>
                                <div className={styles.userAction}>Actions</div>
                            </div>
                            {/* Staff table body */}
                            {staffOnly.map((u) => (
                                <div key={u.id} className={`${styles.userCard} ${updatingUserId === u.id ? styles.updating : ''}`}>
                                    <div>{u.email ?? 'N/A'}</div>
                                    <div>{u.first_name ?? 'N/A'}</div>
                                    <div>{u.last_name ?? 'N/A'}</div>
                                    <div>{u.phone ?? 'N/A'}</div>
                                    <div> {/* Default Vehicle Dropdown */}
                                        {u.staff_id ? (
                                            <select
                                                value={u.default_vehicle_id ?? ''}
                                                onChange={(e) => {
                                                    const vehicleId = e.target.value ? Number(e.target.value) : null;
                                                    handleAssignDefaultVehicle(u.staff_id!, vehicleId);
                                                }}
                                                disabled={updatingUserId === u.id}
                                            >
                                                <option value="">-- None --</option>
                                                {vehicles.map(v => (
                                                    <option key={v.id} value={v.id}>{v.make} {v.model} ({v.license_plate || 'No Plate'})</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span>N/A</span>
                                        )}
                                    </div>
                                    <div>{u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}</div>
                                    <div className={styles.userAction}>
                                        <button onClick={() => openEditModal(u)} disabled={updatingUserId === u.id}>Edit</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isLoadingUsers && staffOnly.length === 0 && <p>No staff members found.</p>}
                </>
            )
        },
        {
            id: 'admins',
            label: 'Admin Management',
            content: (
                <> {/* Wrap in fragment */}
                    {isLoadingUsers && <p>Loading admins...</p>}
                    {!isLoadingUsers && adminsOnly.length > 0 && (
                        <div className={styles.userList}>
                            {/* Admin table header */}
                             <div className={styles.userCardHeader}>
                                <div>Email</div>
                                <div>First Name</div>
                                <div>Last Name</div>
                                <div>Phone</div>
                                <div>Role</div>
                                <div>Created At</div>
                                <div className={styles.userAction}>Actions</div>
                            </div>
                            {/* Admin table body */}
                            {adminsOnly.map((u) => (
                                <div key={u.id} className={`${styles.userCard} ${updatingUserId === u.id ? styles.updating : ''}`}>
                                    <div>{u.email ?? 'N/A'}</div>
                                    <div>{u.first_name ?? 'N/A'}</div>
                                    <div>{u.last_name ?? 'N/A'}</div>
                                    <div>{u.phone ?? 'N/A'}</div>
                                    <div>{u.role}</div>
                                    <div>{u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}</div>
                                    <div className={styles.userAction}>
                                        <button onClick={() => openEditModal(u)} disabled={updatingUserId === u.id}>Edit</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isLoadingUsers && adminsOnly.length === 0 && <p>No admin members found.</p>}
                </>
            )
        },
        {
            id: 'promote',
            label: 'Promote Client',
            content: (
                <div style={{ background: '#181818', padding: 16, borderRadius: 8, maxWidth: 480 }}>
                    <label>Search for client by email/name:<br />
                        <input
                            ref={inputRef}
                            type="text"
                            value={clientSearch}
                            onChange={e => {
                                setClientSearch(e.target.value);
                                setSelectedClient(null);
                            }}
                            style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #555', background: '#222', color: '#fff', marginBottom: 4 }}
                            placeholder="Type email, first or last name..."
                        />
                    </label>
                    {clientSearch && filteredClients.length > 0 && !selectedClient && (
                        <ul style={{ background: '#222', border: '1px solid #555', borderRadius: 4, maxHeight: 160, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', position: 'absolute', zIndex: 10, width: inputRef.current?.offsetWidth || 320 }}>
                            {filteredClients.slice(0, 10).map(c => (
                                <li key={c.id} style={{ padding: 8, cursor: 'pointer' }}
                                    onClick={() => { setSelectedClient(c); setClientSearch(c.email || ''); setFilteredClients([]); }}>
                                    <span>{c.email}</span> {c.first_name || ''} {c.last_name || ''}
                                </li>
                            ))}
                        </ul>
                    )}
                    {selectedClient && (
                        <div style={{ marginTop: 12, background: '#222', padding: 12, borderRadius: 4 }}>
                            <div><strong>Email:</strong> {selectedClient.email}</div>
                            <div><strong>Name:</strong> {selectedClient.first_name} {selectedClient.last_name}</div>
                            <div><strong>Current Role:</strong> {selectedClient.role}</div>
                            <button onClick={() => handlePromote('staff')} disabled={isPromoting} style={{ marginRight: 8 }}>Promote to Staff</button>
                            <button onClick={() => handlePromote('admin')} disabled={isPromoting}>Promote to Admin</button>
                            <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} style={{ marginLeft: 8 }}>Cancel</button>
                            {promoteError && <p style={{ color: 'red' }}>{promoteError}</p>}
                        </div>
                    )}
                </div>
            )
        },
    ];

    return (
        <section>
            <h2>User Management (Admin)</h2>
            {/* Render Tabs */}
            <TabNavigation tabs={userMgmtTabs} />

            {/* Keep Edit Modal outside tabs - it will overlay */}
            {editingUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#2a2a2e', padding: '2rem', borderRadius: 8, color: '#fff', width: '90%', maxWidth: '500px' }}>
                        <h3>Edit User: {editingUser.email}</h3>
                        {editError && <p style={{ color: '#f87171' }}>{editError}</p>}
                        <div style={{ marginBottom: '1rem' }}>
                            <label>First Name:<br />
                                {/* --- Restore binding to editFields --- */}
                                <input type="text" name="first_name" value={editFields.first_name} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Last Name:<br />
                                {/* --- Restore binding to editFields --- */}
                                <input type="text" name="last_name" value={editFields.last_name} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Phone:<br />
                                {/* --- Restore binding to editFields --- */}
                                <input type="text" name="phone" value={editFields.phone} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Notes (Staff Only):<br />
                                {/* --- Restore binding to editFields --- */}
                                <textarea name="notes" value={editFields.notes} onChange={handleEditChange} className="input" rows={3} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            {/* --- Restore binding disabled state to isSaving --- */}
                            <button onClick={closeEdit} className="button secondary" disabled={isSaving}>Cancel</button>
                            <button onClick={handleEditSave} className="button primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Display global error if needed */}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        </section>
    );
}