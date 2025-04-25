'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed
import type { User } from '@supabase/supabase-js';
import { useState, useEffect, useRef } from 'react';

// Define type for user data passed as props
type UserWithRole = {
    id: string;
    user_id?: string;
    email?: string;
    role: string;
    created_at?: string;
    last_sign_in_at?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    phone_number?: string;
    notes?: string;
}

// Define props for the component
interface UserManagementProps {
    users: UserWithRole[];
    isLoadingUsers: boolean;
    error: string | null;
    currentUser: User | null; // The currently logged-in admin user
    updatingUserId: string | null;
    handleAssignRole: (userId: string, targetRole: 'client' | 'staff' | 'admin') => Promise<void>;
    onUserUpdated?: () => void;
}

export default function UserManagement({
    users,
    isLoadingUsers,
    error,
    currentUser,
    updatingUserId,
    handleAssignRole,
    onUserUpdated
}: UserManagementProps) {
    // Edit modal state
    const [editingUser, setEditingUser] = useState<UserWithRole & { first_name?: string; last_name?: string; phone_number?: string; notes?: string } | null>(null);
    const [editFields, setEditFields] = useState({ first_name: '', last_name: '', phone: '', notes: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // --- Promote Client Autocomplete State ---
    const [showPromote, setShowPromote] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [filteredClients, setFilteredClients] = useState<UserWithRole[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserWithRole | null>(null);
    const [promoteError, setPromoteError] = useState<string | null>(null);
    const [isPromoting, setIsPromoting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch filtered clients as user types
    useEffect(() => {
        if (!showPromote || !clientSearch) {
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
    }, [clientSearch, showPromote]);

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

    // Only show staff/admin
    const filteredUsers = users.filter(u => u.role === 'staff' || u.role === 'admin');

    const openEdit = (user: UserWithRole) => {
        setEditingUser(user);
        setEditFields({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            phone: user.phone_number || '',
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

    return (
        <section>
            <h2>User Management (Admin)</h2>
            {/* --- Promote Client Section --- */}
            <div style={{ marginBottom: 24 }}>
                <button onClick={() => setShowPromote(v => !v)} style={{ marginBottom: 8 }}>
                    {showPromote ? 'Hide Promote Client' : 'Promote Client to Staff/Admin'}
                </button>
                {showPromote && (
                    <div style={{ background: '#181818', padding: 16, borderRadius: 8, maxWidth: 480 }}>
                        <label>Search for client by email:<br />
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
                )}
            </div>
            {/* --- End Promote Client Section --- */}
            {isLoadingUsers && <p>Loading users...</p>}
            {/* Display component-specific error or rely on global error passed via props */}
            {/* {error && <p style={{ color: 'red' }}>Error: {error}</p>} */}
            {!isLoadingUsers && filteredUsers.length > 0 && (
                <div className={styles.userList}>
                    <div className={styles.userCardHeader}>
                        <div>Email</div>
                        <div>First Name</div>
                        <div>Last Name</div>
                        <div>Phone</div>
                        <div>Current Role</div>
                        <div>Created At</div>
                        <div className={styles.userAction}>Actions</div>
                    </div>
                    {filteredUsers.map((u) => (
                        <div key={u.id} className={`${styles.userCard} ${updatingUserId === u.id ? styles.updating : ''}`}>
                            <div>{u.email ?? 'N/A'}</div>
                            <div>{u.first_name ?? 'N/A'}</div>
                            <div>{u.last_name ?? 'N/A'}</div>
                            <div>{u.phone ?? u.phone_number ?? 'N/A'}</div>
                            <div>{u.role}</div>
                            <div>{u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}</div>
                            <div className={styles.userAction}>
                                {updatingUserId === u.id ? (
                                    <span>Updating...</span>
                                ) : (
                                    <>
                                        <button onClick={() => openEdit(u)} style={{ color: '#fff', background: '#007bff', border: 'none', padding: '4px 10px', borderRadius: 4, marginRight: 4 }}>Edit</button>
                                        {currentUser && u.id !== currentUser.id && u.role !== 'client' && (
                                            <button onClick={() => handleAssignRole(u.id, 'client')}>Make Client</button>
                                        )}
                                        {currentUser && u.id !== currentUser.id && u.role !== 'staff' && (
                                            <button onClick={() => handleAssignRole(u.id, 'staff')}>Make Staff</button>
                                        )}
                                        {currentUser && u.id !== currentUser.id && u.role !== 'admin' && (
                                            <button onClick={() => handleAssignRole(u.id, 'admin')}>Make Admin</button>
                                        )}
                                        {currentUser && u.id === currentUser.id && (
                                            <span>(Your Role)</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!isLoadingUsers && filteredUsers.length === 0 && (
                <p>No staff or admin users found.</p>
            )}
            {/* Display global error if needed, passed via props */}
            {error && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
            {/* Edit Modal */}
            {editingUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#222', color: '#fff', padding: 24, borderRadius: 8, minWidth: 320, boxShadow: '0 2px 16px #0008' }}>
                        <h3 style={{ color: '#fff' }}>Edit Staff/Admin User</h3>
                        <div style={{ marginBottom: 8 }}>
                            <label>First Name:<br />
                                <input name="first_name" value={editFields.first_name} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
                            </label>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label>Last Name:<br />
                                <input name="last_name" value={editFields.last_name} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
                            </label>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label>Phone:<br />
                                <input name="phone" value={editFields.phone} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
                            </label>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label>Notes:<br />
                                <textarea name="notes" value={editFields.notes} onChange={handleEditChange} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: 4, width: '100%' }} />
                            </label>
                        </div>
                        {editError && <p style={{ color: '#ff6b6b' }}>{editError}</p>}
                        <button onClick={handleEditSave} disabled={isSaving} style={{ color: '#fff', background: '#28a745', border: 'none', padding: '6px 16px', borderRadius: 4, marginRight: 8 }}>Save</button>
                        <button onClick={closeEdit} disabled={isSaving} style={{ color: '#fff', background: '#6c757d', border: 'none', padding: '6px 16px', borderRadius: 4 }}>Cancel</button>
                    </div>
                </div>
            )}
        </section>
    );
}