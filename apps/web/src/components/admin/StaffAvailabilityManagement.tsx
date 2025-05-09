'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StaffAvailabilityRule, AddStaffAvailabilityRulePayload, UpdateStaffAvailabilityRulePayload, StaffMemberListItem } from '@booking-and-accounts-monorepo/shared-types';
import {
	fetchStaffMembers,
	fetchStaffAvailabilityRules,
	addStaffAvailabilityRule,
	updateStaffAvailabilityRule,
	deleteStaffAvailabilityRule
} from '@booking-and-accounts-monorepo/api-services';

// Define the days of the week for mapping

export default function StaffAvailabilityManagement() {
	const [staffList, setStaffList] = useState<StaffMemberListItem[]>([]);
	const [selectedStaffId, setSelectedStaffId] = useState<string>(''); // Store ID as string for select value
	const [availabilityRules, setAvailabilityRules] = useState<StaffAvailabilityRule[]>([]);
	const [isLoadingStaff, setIsLoadingStaff] = useState(false);
	const [isLoadingRules, setIsLoadingRules] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingRule, setEditingRule] = useState<StaffAvailabilityRule | null>(null); // State for the rule being edited
	const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State for modal visibility
	const [addFormRuleType, setAddFormRuleType] = useState<'recurring' | 'specific'>('recurring'); // State for Add form rule type
	const addRuleFormRef = useRef<HTMLFormElement>(null); // Ref for resetting the form

	// --- Fetch Staff List ---
	const fetchStaff = useCallback(async () => {
		setIsLoadingStaff(true);
		setError(null);
		try {
			const data = await fetchStaffMembers(); // Use service function
			setStaffList(data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error fetching staff';
			console.error('Error fetching staff:', err);
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
			const data = await fetchStaffAvailabilityRules(staffId); // Use service function
			setAvailabilityRules(data);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error fetching rules';
			console.error('Error fetching rules:', err);
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
		const daysOfWeekISO: number[] = []; // Store ISO days (1-7)
		if (ruleType === 'recurring') {
			// Process checkboxes named day_1 (Mon) through day_7 (Sun)
			for (let isoDay = 1; isoDay <= 7; isoDay++) {
				if (formData.get(`day_${isoDay}`) === 'on') {
					daysOfWeekISO.push(isoDay);
				}
			}
			if (daysOfWeekISO.length === 0) {
				setError('Please select at least one day for recurring rules.');
				setIsSubmitting(false);
				return;
			}
		}

		const specificDate = ruleType === 'specific' ? (formData.get('specific_date') as string) : undefined;
		if (ruleType === 'specific' && !specificDate) {
			setError('Please select a date for specific date rules.');
			setIsSubmitting(false);
			return;
		}

		// Define the type for the payload sent to the API
		// type AddRulePayload = {
		// 	staff_id: number;
		// 	start_time: string;
		// 	end_time: string;
		// 	is_available: boolean;
		// 	days_of_week?: number[];
		// 	specific_date?: string;
		// };

		const payload: AddStaffAvailabilityRulePayload = {
			staff_id: Number(selectedStaffId),
			start_time: formData.get('start_time') as string,
			end_time: formData.get('end_time') as string,
			is_available: formData.get('is_available') === 'on',
			days_of_week: ruleType === 'recurring' ? daysOfWeekISO : undefined,
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
			// const response = await fetch('/api/staff-availability', {
			// 	method: 'POST',
			// 	headers: { 'Content-Type': 'application/json' },
			// 	body: JSON.stringify(payload),
			// });

			// if (!response.ok) {
			// 	const errorData = await response.json();
			// 	throw new Error(errorData.error || `Failed to add rule (HTTP ${response.status})`);
			// }

			// const newRule: StaffAvailabilityRule = await response.json();
			const newRule = await addStaffAvailabilityRule(payload); // Use service

			setAvailabilityRules((prev) =>
				[...prev, newRule].sort((a, b) => {
					// Sort primarily by date (specific first), then time
					const dateA = a.specific_date || '0'; // Treat recurring as earliest
					const dateB = b.specific_date || '0';
					if (dateA !== dateB) return dateA.localeCompare(dateB);
					return a.start_time.localeCompare(b.start_time);
				})
			);
			addRuleFormRef.current?.reset(); // Reset the form on success
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Unknown error adding rule';
			console.error('Add Rule Error:', err);
			setError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	// --- Edit Rule Handler ---
	const handleEditRule = (rule: StaffAvailabilityRule) => {
		setError(null); // Clear any previous errors
		setEditingRule(rule);
		setIsEditModalOpen(true);
		// The actual API call and state update will happen in the modal's save handler
	};

	// --- Delete Rule Handler ---
	const handleDeleteRule = async (ruleId: number) => {
		if (!window.confirm('Are you sure you want to delete this availability rule?')) return;

		setError(null);
		try {
			// const response = await fetch(`/api/staff-availability/${ruleId}`, {
			// 	method: 'DELETE',
			// });

			// if (!response.ok) {
			// 	let errorMsg = `Failed to delete rule (HTTP ${response.status})`;
			// 	try {
			// 		const errorData = await response.json();
			// 		errorMsg = errorData.error || errorMsg;
			// 	} catch (jsonError) {
			// 		console.warn('Could not parse error response as JSON:', jsonError);
			// 	}
			// 	throw new Error(errorMsg);
			// }
			await deleteStaffAvailabilityRule(ruleId); // Use service

			setAvailabilityRules((prevRules) => prevRules.filter((rule) => rule.id !== ruleId));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error deleting rule';
			console.error('Delete Rule Error:', err);
			setError(msg);
		}
	};

	// --- Helper to format days of week ---
	const formatDays = (days: number[] | null): string => {
		if (!days || days.length === 0) return 'N/A';
		const dayNamesByIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Index 0-6
		const displayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Desired display order

		// 1. Convert ISO days (1-7) to names
		const names = days
			.map((d) => {
				// Convert ISO day d (1-7) back to index (0-6)
				const dayIndex = d === 7 ? 0 : d;
				return dayNamesByIndex[dayIndex];
			})
			.filter((name) => name !== undefined); // Filter out potential undefined if conversion fails

		// 2. Sort the names based on the desired displayOrder
		names.sort((a, b) => displayOrder.indexOf(a) - displayOrder.indexOf(b));

		// 3. Join the sorted names
		return names.join(', ');
	};

	// --- Handler for the actual update API call ---
	const handleUpdateRule = async (ruleId: number, updatedData: UpdateStaffAvailabilityRulePayload) => {
		setIsSubmitting(true); // Or a specific isUpdatingRule state
		setError(null);
		try {
			// The actual fetch call to PUT /api/staff-availability/:ruleId was inside EditAvailabilityRuleModal
			// Now we use the service here.
			const updatedRule = await updateStaffAvailabilityRule(ruleId, updatedData);

			setAvailabilityRules((prevRules) =>
				prevRules.map((r) => (r.id === updatedRule.id ? updatedRule : r))
				.sort((a, b) => {
					const dateA = a.specific_date || '0';
					const dateB = b.specific_date || '0';
					if (dateA !== dateB) return dateA.localeCompare(dateB);
					return a.start_time.localeCompare(b.start_time);
				})
			);
			setIsEditModalOpen(false); // Close modal on successful update
			setEditingRule(null);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error updating rule';
			console.error('Update Rule Error:', err);
			setError(msg); // Display error, potentially in the modal or main page
			// Consider not closing modal on error, or passing error to modal to display
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div style={{ color: 'white', padding: '20px' }}>
			<h2>Staff Availability Management</h2>
			{error && <p style={{ color: 'red' }}>Error: {error}</p>}

			{/* Staff Selection Dropdown */}
			<div>
				<label htmlFor="staffSelect" style={{ marginRight: '10px' }}>
					Select Staff Member:
				</label>
				<select
					id="staffSelect"
					value={selectedStaffId}
					onChange={(e) => setSelectedStaffId(e.target.value)}
					disabled={isLoadingStaff}
					style={{ padding: '8px', minWidth: '200px' }}
				>
					<option value="">-- Select Staff --</option>
					{staffList.map((staffMember) => (
						<option key={staffMember.id} value={staffMember.id.toString()}>
							{staffMember.profile?.first_name || ''} {staffMember.profile?.last_name || ''} (ID: {staffMember.id})
						</option>
					))}
				</select>
				{isLoadingStaff && <span> Loading staff...</span>}
			</div>

			{/* Add/Display Rules Section */}
			{selectedStaffId && (
				<div style={{ marginTop: '20px' }}>
					{/* Use staff name from list */}
					<h3>
						Availability for {staffList.find((s) => s.id === Number(selectedStaffId))?.profile?.first_name}{' '}
						{staffList.find((s) => s.id === Number(selectedStaffId))?.profile?.last_name}
					</h3>

					{/* --- Add New Rule Form --- */}
					<form
						onSubmit={handleAddRule}
						ref={addRuleFormRef}
						style={{ marginBottom: '30px', padding: '15px', border: '1px solid #555', borderRadius: '8px' }}
					>
						<h4>Add New Rule</h4>
						{/* Rule Type Selection */}
						<div style={{ marginBottom: '10px' }}>
							<label style={{ marginRight: '15px' }}>Rule Type:</label>
							<input
								type="radio"
								id="recurring"
								name="ruleType"
								value="recurring"
								checked={addFormRuleType === 'recurring'} // Control checked state
								onChange={() => setAddFormRuleType('recurring')} // Update state on change
								style={{ marginRight: '5px' }}
							/>
							<label htmlFor="recurring" style={{ marginRight: '15px' }}>
								Recurring
							</label>
							<input
								type="radio"
								id="specific"
								name="ruleType"
								value="specific"
								checked={addFormRuleType === 'specific'} // Control checked state
								onChange={() => setAddFormRuleType('specific')} // Update state on change
								style={{ marginRight: '5px' }}
							/>
							<label htmlFor="specific">Specific Date</label>
						</div>

						{/* Conditional Fields based on Rule Type */}
						{/* Recurring Days (Shown when type='recurring') */}
						{addFormRuleType === 'recurring' && (
							<div style={{ marginBottom: '10px' }}>
								<label>Days:</label>
								<br />
								{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
									// Map index (0-6) to ISO day (1-7) for the input name/value
									const isoDayForValue = index + 1;
									return (
										<label key={isoDayForValue} style={{ marginRight: '10px' }}>
											{/* Use ISO day number (1-7) in the name */}
											<input type="checkbox" name={`day_${isoDayForValue}`} /> {day}
										</label>
									);
								})}
							</div>
						)}

						{/* Specific Date (Shown when type='specific') */}
						{addFormRuleType === 'specific' && (
							<div style={{ marginBottom: '10px' }}>
								<label htmlFor="specific_date">Date:</label>
								<input type="date" id="specific_date" name="specific_date" style={{ marginLeft: '5px' }} />
							</div>
						)}

						{/* Time Inputs */}
						<div style={{ marginBottom: '10px' }}>
							<label htmlFor="start_time">Start Time:</label>
							<input type="time" id="start_time" name="start_time" required style={{ marginLeft: '5px' }} />
							<label htmlFor="end_time" style={{ marginLeft: '15px' }}>
								End Time:
							</label>
							<input type="time" id="end_time" name="end_time" required style={{ marginLeft: '5px' }} />
						</div>

						{/* Availability Status */}
						<div style={{ marginBottom: '15px' }}>
							<label htmlFor="is_available">Available:</label>
							<input type="checkbox" id="is_available" name="is_available" defaultChecked style={{ marginLeft: '5px' }} />
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
								<table
									style={{
										width: '100%',
										borderCollapse: 'collapse',
										marginTop: '15px',
										border: '1px solid #555', // Add border around the table
									}}
								>
									<thead>
										<tr style={{ backgroundColor: '#333' }}>
											<th style={{ border: '1px solid #555', padding: '8px', textAlign: 'left' }}>Type</th>
											<th style={{ border: '1px solid #555', padding: '8px', textAlign: 'left' }}>Days/Date</th>
											<th style={{ border: '1px solid #555', padding: '8px', textAlign: 'left' }}>Time</th>
											<th style={{ border: '1px solid #555', padding: '8px', textAlign: 'left' }}>Available</th>
											<th style={{ border: '1px solid #555', padding: '8px', textAlign: 'left' }}>Actions</th>
										</tr>
									</thead>
									<tbody>
										{availabilityRules.map((rule, index) => (
											<tr key={rule.id} style={{ backgroundColor: index % 2 === 0 ? '#282828' : '#202020' }}>
												<td style={{ border: '1px solid #555', padding: '8px' }}>
													{rule.days_of_week ? 'Recurring' : 'Specific Date'}
												</td>
												<td style={{ border: '1px solid #555', padding: '8px' }}>
													{rule.days_of_week ? formatDays(rule.days_of_week) : rule.specific_date}
												</td>
												<td style={{ border: '1px solid #555', padding: '8px' }}>
													{rule.start_time} - {rule.end_time}
												</td>
												<td style={{ border: '1px solid #555', padding: '8px' }}>{rule.is_available ? 'Yes' : 'No'}</td>
												<td style={{ border: '1px solid #555', padding: '8px' }}>
													<button onClick={() => handleEditRule(rule)} style={{ padding: '4px 8px' }}>
														Edit
													</button>
													<button
														onClick={() => handleDeleteRule(rule.id)}
														style={{ marginLeft: '5px', padding: '4px 8px' }}
													>
														Delete
													</button>
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

			{/* --- Edit Modal --- */}
			{isEditModalOpen && editingRule && (
				<EditAvailabilityRuleModal
					rule={editingRule}
					onClose={() => {
						setIsEditModalOpen(false);
						setEditingRule(null);
					}}
					onSave={handleUpdateRule} // Pass the update handler
				/>
			)}
		</div>
	);
}

// --- Edit Modal Component (Internal to StaffAvailabilityManagement) ---
interface EditModalProps {
	rule: StaffAvailabilityRule;
	onClose: () => void;
	onSave: (ruleId: number, updatedData: UpdateStaffAvailabilityRulePayload) => Promise<void>; // Changed signature
}

function EditAvailabilityRuleModal({ rule, onClose, onSave }: EditModalProps) {
	// State for form inputs, initialized with the rule being edited
	const [startTime, setStartTime] = useState(rule.start_time || '');
	const [endTime, setEndTime] = useState(rule.end_time || '');
	const [isAvailable, setIsAvailable] = useState(rule.is_available);

	// Initialize selected days directly with ISO values (1-7) from the rule
	const [selectedDaysISO, setSelectedDaysISO] = useState<number[]>(rule.days_of_week || []);

	const [specificDate, setSpecificDate] = useState(rule.specific_date || '');
	const [modalError, setModalError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// Determine rule type (cannot be changed in edit)
	const isRecurring = !!rule.days_of_week;

	// handleDayChange now works directly with ISO day numbers (1-7)
	const handleDayChange = (isoDay: number, checked: boolean) => {
		setSelectedDaysISO((prev) => (checked ? [...prev, isoDay] : prev.filter((d) => d !== isoDay)));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSaving(true);
		setModalError(null);

		const daysOfWeekISO: number[] = [];
		if (isRecurring) {
			selectedDaysISO.forEach(day => daysOfWeekISO.push(day));
			if (daysOfWeekISO.length === 0 && isRecurring) {
				setModalError('Please select at least one day for recurring rules.');
				setIsSaving(false);
				return;
			}
		}

		const payload: UpdateStaffAvailabilityRulePayload = {
			start_time: startTime,
			end_time: endTime,
			is_available: isAvailable,
			days_of_week: isRecurring ? (daysOfWeekISO.length > 0 ? daysOfWeekISO : null) : null, // Send null to clear if recurring and no days selected
			specific_date: isRecurring ? null : specificDate, // Send null to clear if not specific
		};

		if (!payload.start_time || !payload.end_time) {
			setModalError('Start and End times are required.');
			setIsSaving(false);
			return;
		}
		if (payload.start_time >= payload.end_time) {
			setModalError('End time must be after start time.');
			setIsSaving(false);
			return;
		}

		await onSave(rule.id, payload); // Call parent's save function
		// setIsSaving is handled by parent, modal will be closed by parent on success
	};

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0,0,0,0.7)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				color: 'black',
				zIndex: 1000,
			}}
		>
			<div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '450px', maxWidth: '90vw' }}>
				<h2>Edit Availability Rule (ID: {rule.id})</h2>
				{modalError && <p style={{ color: 'red' }}>Error: {modalError}</p>}

				<form onSubmit={handleSubmit}>
					{/* Rule Type Display (Not Editable) */}
					<p>
						<strong>Rule Type:</strong> {isRecurring ? 'Recurring' : 'Specific Date'}
					</p>

					{/* Conditional Fields */}
					{isRecurring ? (
						<div style={{ marginBottom: '10px' }}>
							<label>Days:</label>
							<br />
							{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
								// Map display index (0-6) to ISO day (1-7)
								const isoDay = index + 1;
								return (
									<label key={isoDay} style={{ marginRight: '10px' }}>
										<input
											type="checkbox"
											// Check against the ISO day state (1-7)
											checked={selectedDaysISO.includes(isoDay)}
											// Pass the ISO day (1-7) to the handler
											onChange={(e) => handleDayChange(isoDay, e.target.checked)}
											disabled={isSaving}
										/>{' '}
										{day}
									</label>
								);
							})}
						</div>
					) : (
						<div style={{ marginBottom: '10px' }}>
							<label htmlFor="edit_specific_date">Date:</label>
							<input
								type="date"
								id="edit_specific_date"
								value={specificDate}
								onChange={(e) => setSpecificDate(e.target.value)}
								required
								disabled={isSaving}
								style={{ marginLeft: '5px' }}
							/>
						</div>
					)}

					{/* Time Inputs */}
					<div style={{ marginBottom: '10px' }}>
						<label htmlFor="edit_start_time">Start Time:</label>
						<input
							type="time"
							id="edit_start_time"
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
							required
							disabled={isSaving}
							style={{ marginLeft: '5px' }}
						/>
						<label htmlFor="edit_end_time" style={{ marginLeft: '15px' }}>
							End Time:
						</label>
						<input
							type="time"
							id="edit_end_time"
							value={endTime}
							onChange={(e) => setEndTime(e.target.value)}
							required
							disabled={isSaving}
							style={{ marginLeft: '5px' }}
						/>
					</div>

					{/* Availability Status */}
					<div style={{ marginBottom: '15px' }}>
						<label htmlFor="edit_is_available">Available:</label>
						<input
							type="checkbox"
							id="edit_is_available"
							checked={isAvailable}
							onChange={(e) => setIsAvailable(e.target.checked)}
							disabled={isSaving}
							style={{ marginLeft: '5px' }}
						/>
						<span style={{ marginLeft: '5px', fontSize: '0.8em' }}>(Uncheck to mark as unavailable/time off)</span>
					</div>

					<div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
						<button type="button" onClick={onClose} disabled={isSaving} style={{ marginRight: '10px' }}>
							Cancel
						</button>
						<button type="submit" disabled={isSaving}>
							{isSaving ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
