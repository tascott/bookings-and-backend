// Define a type for the expected slot data.
// This is based on CalculatedSlot from ClientBooking.tsx but defined here for the service.
// It might be beneficial to move CalculatedSlot to shared types if it's used more broadly.
export type AvailableSlot = {
    start_time: string;
    end_time: string;
    remaining_capacity: number;
    price_per_pet?: number | null;
    zero_capacity_reason?: string | null;
    capacity_display?: string;
    field_ids?: number[];
    uses_staff_capacity?: boolean;
    other_staff_potentially_available?: boolean;
};

interface FetchAvailableSlotsParams {
    serviceId: string;
    startDate: string; // ISO date string YYYY-MM-DD
    endDate: string;   // ISO date string YYYY-MM-DD
    targetClientId?: number; // Added for admin context
}

/**
 * Fetches available slots for a given service and date range.
 */
export async function fetchAvailableSlots(
    { serviceId, startDate, endDate, targetClientId }: FetchAvailableSlotsParams
): Promise<AvailableSlot[]> {
    const queryParams = new URLSearchParams({
        service_id: serviceId,
        start_date: startDate,
        end_date: endDate,
    });

    if (targetClientId !== undefined) {
        queryParams.append('target_client_id', targetClientId.toString());
    }

    const response = await fetch(`/api/available-slots?${queryParams.toString()}`);

    if (!response.ok) {
        let errorMsg = 'Failed to fetch calendar availability';
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (_e) {
            // If JSON parsing fails, use the status text or initial message
            errorMsg = `${errorMsg} (${response.status} ${response.statusText})`;
        }
        throw new Error(errorMsg);
    }

    const slotsData: AvailableSlot[] = await response.json();
    return slotsData;
}