'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Define types locally for now, can move to /types later if needed
type StaffMemberListItem = {
    id: number;
    first_name: string | null;
    last_name: string | null;
}

type StaffAvailabilityRule = {
    id: number;
    staff_id: number;
    start_time: string; // HH:mm:ss format
    end_time: string;   // HH:mm:ss format
    days_of_week: number[] | null;
    specific_date: string | null; // YYYY-MM-DD format
    is_available: boolean;
    created_at: string;
    updated_at: string;
    staff?: { // Optional nested staff info from GET request
        profiles: { first_name: string | null, last_name: string | null } | null
    } | null
}

export default function StaffAvailabilityManagement() {
    const [staffList, setStaffList] = useState<StaffMemberListItem[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string>(''); // Store ID as string for select value
    const [availabilityRules, setAvailabilityRules] = useState<StaffAvailabilityRule[]>([]);
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);
    const [isLoadingRules, setIsLoadingRules] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const addRuleFormRef = useRef<HTMLFormElement>(null); // Ref for resetting the form

    // --- Fetch Staff List ---
    const fetchStaff = useCallback(async () => {
        setIsLoadingStaff(true);
        setError(null);
        try {
            const response = await fetch('/api/staff'); // Fetches only role='staff' members
            if (!response.ok) {
                throw new Error(`Failed to fetch staff list: ${response.statusText}`);
            }
            const data: StaffMemberListItem[] = await response.json();
            setStaffList(data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error fetching staff';
            console.error("Error fetching staff:", err);
            setError(msg);
            setStaffList([]);
        } finally {
            setIsLoadingStaff(false);
        }
    }, []);

    // --- Fetch Availability Rules ---
    const fetchRules = useCallback(async (staffId: number) => {
        if (!staffId) return;
        setIsLoadingRules(true);
        setError(null);
        setAvailabilityRules([]); // Clear previous rules
        try {
            const response = await fetch(`/api/staff-availability?staff_id=${staffId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch availability rules: ${response.statusText}`);
            }
            const data: StaffAvailabilityRule[] = await response.json();
            setAvailabilityRules(data);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error fetching rules';
            console.error("Error fetching rules:", err);
            setError(msg);
            setAvailabilityRules([]);
        } finally {
            setIsLoadingRules(false);
        }
    }, []);

    // --- Initial Staff Fetch ---
    useEffect(() => {
        fetchStaff();
    }, [fetchStaff]);

    // --- Fetch Rules on Staff Selection Change ---
    useEffect(() => {
        if (selectedStaffId) {
            fetchRules(Number(selectedStaffId));
        } else {
            setAvailabilityRules([]); // Clear rules if no staff selected
        }
    }, [selectedStaffId, fetchRules]);

    // --- Add Rule Handler ---
    const handleAddRule = async (event: React.FormEvent<HTMLFormElement>) => {
         event.preventDefault();
         if (!selectedStaffId) {
             setError('Please select a staff member first.');
             return;
         }
         setError(null);
         setIsSubmitting(true);

         const formData = new FormData(event.currentTarget);
         const ruleType = formData.get('ruleType') as string;
         const daysOfWeek: number[] = [];
         if (ruleType === 'recurring') {
             for (let i = 0; i <= 6; i++) { // Assuming 0=Sun, 6=Sat based on previous helper
                 if (formData.get(`day_${i}`) === 'on') {
                     daysOfWeek.push(i);
                 }
             }
             if (daysOfWeek.length === 0) {
                 setError('Please select at least one day for recurring rules.');
                 setIsSubmitting(false);
                 return;
             }
         }

         const specificDate = ruleType === 'specific' ? formData.get('specific_date') as string : undefined;
         if (ruleType === 'specific' && !specificDate) {
             setError('Please select a date for specific date rules.');
             setIsSubmitting(false);
             return;
         }

         // Define the type for the payload sent to the API
         type AddRulePayload = {
             staff_id: number;
             start_time: string;
             end_time: string;
             is_available: boolean;
             days_of_week?: number[];
             specific_date?: string;
         }

         const payload: AddRulePayload = {
             staff_id: Number(selectedStaffId),
             start_time: formData.get('start_time') as string,
             end_time: formData.get('end_time') as string,
             is_available: formData.get('is_available') === 'on',
             days_of_week: ruleType === 'recurring' ? daysOfWeek : undefined,
             specific_date: specificDate,
         };

        // Basic time validation before sending
        if (!payload.start_time || !payload.end_time) {
            setError('Start and End times are required.');
            setIsSubmitting(false);
            return;
        }
        if (payload.start_time >= payload.end_time) {
            setError('End time must be after start time.');
            setIsSubmitting(false);
            return;
        }

         try {
            const response = await fetch('/api/staff-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add rule (HTTP ${response.status})`);
            }

            const newRule: StaffAvailabilityRule = await response.json();
            setAvailabilityRules(prev => [...prev, newRule].sort((a, b) => {
                // Sort primarily by date (specific first), then time
                const dateA = a.specific_date || '0'; // Treat recurring as earliest
                const dateB = b.specific_date || '0';
                if (dateA !== dateB) return dateA.localeCompare(dateB);
                return a.start_time.localeCompare(b.start_time);
            }));
            addRuleFormRef.current?.reset(); // Reset the form on success

         } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error adding rule';
            console.error("Add Rule Error:", err);
            setError(msg);
         } finally {
            setIsSubmitting(false);
         }
    };

    // --- Edit Rule Handler (Placeholder) ---
    const handleEditRule = (rule: StaffAvailabilityRule) => {
        console.log('Editing rule:', rule);
        setError('Edit functionality not yet implemented.');
        // TODO: Implement PUT /api/staff-availability/[ruleId]
    };

    // --- Delete Rule Handler (Placeholder) ---
    const handleDeleteRule = async (ruleId: number) => {
         if (!window.confirm('Are you sure you want to delete this availability rule?')) return;
         console.log('Deleting rule ID:', ruleId);
         setError('Delete functionality not yet implemented.');
        // TODO: Implement DELETE /api/staff-availability/[ruleId]
    };

    // --- Helper to format days of week ---
    const formatDays = (days: number[] | null): string => {
        if (!days) return 'N/A';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.sort().map(d => dayNames[d]).join(', ');
    }

    return (
        <div style={{ color: 'white', padding: '20px' }}>
            <h2>Staff Availability Management</h2>
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}

            {/* Staff Selection Dropdown */}
            <div>
                <label htmlFor="staffSelect" style={{ marginRight: '10px' }}>Select Staff Member:</label>
                <select
                    id="staffSelect"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={isLoadingStaff}
                    style={{ padding: '8px', minWidth: '200px' }}
                >
                    <option value="">-- Select Staff --</option>
                    {staffList.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                            {`${staff.first_name || ''} ${staff.last_name || ''}`.trim() || `Staff ID: ${staff.id}`}
                        </option>
                    ))}
                </select>
                {isLoadingStaff && <span> Loading staff...</span>}
            </div>

            {/* Add/Display Rules Section */}
            {selectedStaffId && (
                <div style={{ marginTop: '20px' }}>
                    {/* Use staff name from list */}
                    <h3>Availability for {staffList.find(s => s.id === Number(selectedStaffId))?.first_name} {staffList.find(s => s.id === Number(selectedStaffId))?.last_name}</h3>

                    {/* --- Add New Rule Form --- */}
                    <form onSubmit={handleAddRule} ref={addRuleFormRef} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #555', borderRadius: '8px' }}>
                        <h4>Add New Rule</h4>
                        {/* Rule Type Selection */}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ marginRight: '15px' }}>Rule Type:</label>
                            <input type="radio" id="recurring" name="ruleType" value="recurring" defaultChecked style={{ marginRight: '5px' }}/>
                            <label htmlFor="recurring" style={{ marginRight: '15px' }}>Recurring</label>
                            <input type="radio" id="specific" name="ruleType" value="specific" style={{ marginRight: '5px' }}/>
                            <label htmlFor="specific">Specific Date</label>
                        </div>

                        {/* Conditional Fields based on Rule Type */}
                        {/* We might need state to control visibility, but using CSS/logic within might work too */}
                        {/* For simplicity, render both and rely on handler logic for now, but UI could hide/show */}

                        {/* Recurring Days (Shown when type='recurring') */}
                        <div /* Logic needed to hide/show based on radio */ style={{ marginBottom: '10px' }}>
                            <label>Days:</label><br/>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                                <label key={index} style={{ marginRight: '10px' }}>
                                    <input type="checkbox" name={`day_${index}`} /> {day}
                                </label>
                            ))}
                        </div>

                        {/* Specific Date (Shown when type='specific') */}
                        <div /* Logic needed to hide/show based on radio */ style={{ marginBottom: '10px' }}>
                            <label htmlFor="specific_date">Date:</label>
                            <input type="date" id="specific_date" name="specific_date" style={{ marginLeft: '5px' }}/>
                        </div>

                        {/* Time Inputs */}
                        <div style={{ marginBottom: '10px' }}>
                            <label htmlFor="start_time">Start Time:</label>
                            <input type="time" id="start_time" name="start_time" required style={{ marginLeft: '5px' }}/>
                            <label htmlFor="end_time" style={{ marginLeft: '15px' }}>End Time:</label>
                            <input type="time" id="end_time" name="end_time" required style={{ marginLeft: '5px' }}/>
                        </div>

                        {/* Availability Status */}
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor="is_available">Available:</label>
                            <input type="checkbox" id="is_available" name="is_available" defaultChecked style={{ marginLeft: '5px' }}/>
                            <span style={{ marginLeft: '5px', fontSize: '0.8em' }}>(Uncheck to mark as unavailable/time off)</span>
                        </div>

                        <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px' }}>
                            {isSubmitting ? 'Adding Rule...' : 'Add Availability Rule'}
                        </button>
                    </form>

                    {/* --- Existing Rules Table --- */}
                    {isLoadingRules ? (
                        <p>Loading rules...</p>
                    ) : (
                        <>
                            <h4>Existing Rules:</h4>
                            {availabilityRules.length === 0 ? (
                                <p>No availability rules found for this staff member.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th>Days/Date</th>
                                            <th>Time</th>
                                            <th>Available</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {availabilityRules.map(rule => (
                                            <tr key={rule.id}>
                                                <td>{rule.days_of_week ? 'Recurring' : 'Specific Date'}</td>
                                                <td>{rule.days_of_week ? formatDays(rule.days_of_week) : rule.specific_date}</td>
                                                <td>{rule.start_time} - {rule.end_time}</td>
                                                <td>{rule.is_available ? 'Yes' : 'No'}</td>
                                                <td>
                                                    <button onClick={() => handleEditRule(rule)}>Edit</button>
                                                    <button onClick={() => handleDeleteRule(rule.id)} style={{ marginLeft: '5px'}}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
