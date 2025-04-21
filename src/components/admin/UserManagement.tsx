'use client';

import styles from "@/app/page.module.css"; // Adjust path as needed
import type { User } from '@supabase/supabase-js';

// Define type for user data passed as props
type UserWithRole = {
    id: string;
    email?: string;
    role: string;
    created_at?: string;
    last_sign_in_at?: string;
}

// Define props for the component
interface UserManagementProps {
    users: UserWithRole[];
    isLoadingUsers: boolean;
    error: string | null;
    currentUser: User | null; // The currently logged-in admin user
    updatingUserId: string | null;
    handleAssignRole: (userId: string, targetRole: 'client' | 'staff' | 'admin') => Promise<void>;
}

export default function UserManagement({
    users,
    isLoadingUsers,
    error,
    currentUser,
    updatingUserId,
    handleAssignRole
}: UserManagementProps) {

    // No local state needed for this component initially

    return (
        <section>
            <h2>User Management (Admin)</h2>
            {isLoadingUsers && <p>Loading users...</p>}
            {/* Display component-specific error or rely on global error passed via props */}
            {/* {error && <p style={{ color: 'red' }}>Error: {error}</p>} */}
            {!isLoadingUsers && users.length > 0 && (
                <div className={styles.userList}>
                    <div className={styles.userCardHeader}>
                        <div>Email</div>
                        <div>Current Role</div>
                        <div>Created At</div>
                        <div>Last Sign In</div>
                        <div className={styles.userAction}>Actions</div>
                    </div>
                    {users.map((u) => (
                        <div key={u.id} className={`${styles.userCard} ${updatingUserId === u.id ? styles.updating : ''}`}>
                            <div>{u.email ?? 'N/A'}</div>
                            <div>{u.role}</div>
                            <div>{u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'}</div>
                            <div>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'N/A'}</div>
                            <div className={styles.userAction}>
                                {updatingUserId === u.id ? (
                                    <span>Updating...</span>
                                ) : (
                                    <>
                                        {/* Prevent changing own role or if role is already target */}
                                        {currentUser && u.id !== currentUser.id && u.role !== 'client' && (
                                            <button onClick={() => handleAssignRole(u.id, 'client')}>Make Client</button>
                                        )}
                                        {currentUser && u.id !== currentUser.id && u.role !== 'staff' && (
                                            <button onClick={() => handleAssignRole(u.id, 'staff')}>Make Staff</button>
                                        )}
                                        {currentUser && u.id !== currentUser.id && u.role !== 'admin' && (
                                            <button onClick={() => handleAssignRole(u.id, 'admin')}>Make Admin</button>
                                        )}
                                        {/* Show current role if it's the admin's own row */}
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
            {!isLoadingUsers && users.length === 0 && (
                <p>No users found.</p>
            )}
            {/* Display global error if needed, passed via props */}
            {error && <p style={{ color: 'red', marginTop: '1rem' }}>Error: {error}</p>}
        </section>
    );
}