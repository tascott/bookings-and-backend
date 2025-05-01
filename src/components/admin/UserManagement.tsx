'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed
// import type { User } from '@supabase/supabase-js'; // Removed unused import
// Import Staff and Vehicle types
import type { Staff, Vehicle } from '@/types';
import { useState, useEffect, useRef } from 'react';
import TabNavigation from '@/components/TabNavigation'; // Import the TabNavigation component

// Define type for user data passed as props (align with what fetchAllUsers provides)
type UserWithRole = {
    id: string;
    user_id?: string; // This might be the Supabase auth user ID
    email?: string;
    role: string;
    created_at?: string;
    last_sign_in_at?: string;
    // Profile data might be nested or joined depending on API
    first_name?: string;
    last_name?: string;
    phone?: string; // Use phone consistently if possible
    // staff table specific fields
    staff_id?: number; // Corresponds to staff.id
    default_vehicle_id?: number | null;
    notes?: string;
}

// Define props for the component
interface UserManagementProps {
    users: UserWithRole[]; // These are likely combined Auth User + Profile/Staff data
    staff: Staff[]; // Separate array of staff records including default_vehicle_id
    vehicles: Vehicle[]; // List of all vehicles for dropdown
    isLoadingUsers: boolean;
    error: string | null;
    updatingUserId: string | null;
    handleAssignRole: (userId: string, targetRole: 'client' | 'staff' | 'admin') => Promise<void>;
    handleAssignDefaultVehicle: (staffId: number, vehicleId: number | null) => Promise<void>; // Handler for vehicle assignment
    onUserUpdated?: () => void;
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
    const [editingUser, setEditingUser] = useState<UserWithRole & { first_name?: string; last_name?: string; phone_number?: string; notes?: string } | null>(null);
    const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '', notes: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // --- Promote Client Autocomplete State ---
    const [clientSearch, setClientSearch] = useState('');
    const [filteredClients, setFilteredClients] = useState<UserWithRole[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserWithRole | null>(null);
    const [promoteError, setPromoteError] = useState<string | null>(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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
            if (onUserUpdated) onUserUpdated();
        } catch (e) {
            setPromoteError(e instanceof Error ? e.message : 'Failed to promote user');
        } finally {
            setIsPromoting(false);
        }
    };

    // Combine user details (Keep this logic, used by both Staff and Admin tabs)
    const staffUserDetails = users
        .filter(u => u.role === 'staff' || u.role === 'admin')
        .map(user => {
            const staffRecord = staff.find(s => s.user_id === user.id);
            return {
                ...user,
                staff_id: staffRecord?.id,
                default_vehicle_id: staffRecord?.default_vehicle_id,
                notes: staffRecord?.notes ?? undefined,
                first_name: staffRecord?.profile?.first_name || user.first_name,
                last_name: staffRecord?.profile?.last_name || user.last_name,
            } as UserWithRole;
        });

    // Filter for Tabs
    const staffOnly = staffUserDetails.filter(u => u.role === 'staff');
    const adminsOnly = staffUserDetails.filter(u => u.role === 'admin');

    const openEdit = (user: UserWithRole) => {
        setEditingUser(user);
        setEditFields({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            phone: user.phone || '', // Use phone consistently
            notes: user.notes || ''
        });
        setEditError(null);
    };
    const closeEdit = () => {
        setEditingUser(null);
        setEditError(null);
    };
    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditFields(f => ({ ...f, [e.target.name]: e.target.value }));
    };
    const handleEditSave = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        setEditError(null);
        try {
            const response = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFields)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update user');
            }
            closeEdit();
            if (typeof onUserUpdated === 'function') onUserUpdated();
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
                                        <button onClick={() => openEdit(u)} disabled={updatingUserId === u.id}>Edit</button>
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
                                        <button onClick={() => openEdit(u)} disabled={updatingUserId === u.id}>Edit</button>
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
                                <input type="text" name="first_name" value={editFields.first_name} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Last Name:<br />
                                <input type="text" name="last_name" value={editFields.last_name} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Phone:<br />
                                <input type="text" name="phone" value={editFields.phone} onChange={handleEditChange} className="input" />
                            </label>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Notes (Staff Only):<br />
                                <textarea name="notes" value={editFields.notes} onChange={handleEditChange} className="input" rows={3} disabled={editingUser.role !== 'staff'}></textarea>
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
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