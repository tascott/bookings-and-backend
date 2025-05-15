'use client';

import React, { useState, useEffect, useCallback } from 'react';
import SidebarNavigation from '@/components/SidebarNavigation';
import BookingManagement from '@/components/admin/BookingManagement';
import PetMediaTabContent from '@/components/staff/media/PetMediaTabContent';
import type { Booking, Service, UserWithRole, Profile as ProfileType, StaffAssignedClient } from '@booking-and-accounts-monorepo/shared-types';
import CalendarView, { CalendarEvent } from '@/components/shared/CalendarView';
import Modal from '@/components/shared/Modal';
import { fetchUserProfile, updateUserProfile } from '@booking-and-accounts-monorepo/api-services';
import { fetchServices } from '@booking-and-accounts-monorepo/api-services';
import { fetchMyAssignedClients } from '@booking-and-accounts-monorepo/api-services';
import { createClient } from '@booking-and-accounts-monorepo/utils';

interface SlotResource {
    bookings: Booking[];
    timeKey: string;
}

export default function StaffDashboard() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserWithRole | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [editFields, setEditFields] = useState<Partial<ProfileType>>({
    user_id: '',
    first_name: '',
    last_name: '',
    phone: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const [myClients, setMyClients] = useState<StaffAssignedClient[]>([]);
  const [isLoadingMyClients, setIsLoadingMyClients] = useState(true);
  const [myClientsError, setMyClientsError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [selectedSlotBookings, setSelectedSlotBookings] = useState<Booking[] | null>(null);
  const [selectedSlotTimeKey, setSelectedSlotTimeKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);
    try {
      const staffUserId = profile?.id;
      const bookingsRes = await fetch(staffUserId ? `/api/bookings?assigned_staff_id=${staffUserId}` : '/api/bookings');
      if (!bookingsRes.ok) throw new Error(`Failed to fetch bookings: ${bookingsRes.statusText}`);
      const bookingsData: Booking[] = await bookingsRes.json();
      setBookings(bookingsData);

      const servicesData = await fetchServices(supabase);
      setServices(servicesData);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load dashboard data';
      console.error(errorMessage, e);
      setError(errorMessage);
      setBookings([]);
      setServices([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [profile?.id, supabase]);

  const fetchMyClients = useCallback(async () => {
    setIsLoadingMyClients(true);
    setMyClientsError(null);
    try {
      const data = await fetchMyAssignedClients();
      setMyClients(data.clients || []);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load assigned clients';
      console.error(errorMessage, e);
      setMyClientsError(errorMessage);
      setMyClients([]);
    } finally {
      setIsLoadingMyClients(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async () => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    try {
      const staffUserId = profile?.id;
      if (!staffUserId) {
        setCalendarEvents([]);
        setIsLoadingCalendar(false);
        return;
      }
      const res = await fetch(`/api/bookings?assigned_staff_id=${staffUserId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch schedule');
      }
      const bookingsData: Booking[] = await res.json();
      const groupedSlots = new Map<string, Booking[]>();
      bookingsData.forEach(booking => {
          const key = getTimeSlotKey(booking);
          if (!groupedSlots.has(key)) {
              groupedSlots.set(key, []);
          }
          groupedSlots.get(key)?.push(booking);
      });
      const mappedEventsOrNull: (CalendarEvent | null)[] = Array.from(groupedSlots.entries()).map(([slotKey, bookingsInSlot]) => {
          if (bookingsInSlot.length === 0) return null;
          const firstBooking = bookingsInSlot[0];
          if (!firstBooking) return null;

          const startTime = new Date(firstBooking.start_time);
          const endTime = new Date(firstBooking.end_time);
          const timeDisplay = `${formatTime(firstBooking.start_time)} - ${formatTime(firstBooking.end_time)}`;
          const resourceData: SlotResource = { bookings: bookingsInSlot, timeKey: slotKey };
          return {
              id: slotKey,
              title: `${timeDisplay} (${bookingsInSlot.length} Booking${bookingsInSlot.length > 1 ? 's' : ''})`,
              start: startTime,
              end: endTime,
              resource: resourceData,
              allDay: false
          };
      });
      const mappedEvents: CalendarEvent[] = mappedEventsOrNull.filter(
          (event): event is CalendarEvent => event !== null
      );
      setCalendarEvents(mappedEvents);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load schedule data';
      console.error(errorMessage, e);
      setCalendarError(errorMessage);
      setCalendarEvents([]);
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [profile?.id]);

  const fetchProfileData = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
      setEditFields({
        user_id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || ''
      });
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to fetch profile');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
      fetchMyClients();
      fetchCalendarData();
    }
  }, [profile?.id, fetchData, fetchMyClients, fetchCalendarData]);

  const handleCalendarEventClick = (event: CalendarEvent) => {
    const resource = event.resource as SlotResource;
    if (resource && resource.bookings) {
        setSelectedSlotBookings(resource.bookings);
        setSelectedSlotTimeKey(resource.timeKey);
        setIsSlotModalOpen(true);
    }
  };

  const startEdit = () => {
    if (!profile) return;
    setEditFields({
      user_id: profile.id,
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || ''
    });
    setEditProfile(true);
  };
  const cancelEdit = () => setEditProfile(false);
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFields((f: Partial<ProfileType>) => ({ ...f, [name]: value }));
  };

  const saveProfile = async () => {
    if (!profile?.id) {
      setProfileError("User ID missing, cannot save profile.");
      return;
    }
    setIsSaving(true);
    setProfileError(null);
    try {
      const payload: Partial<ProfileType> = {
        user_id: profile.id,
        first_name: editFields.first_name || null,
        last_name: editFields.last_name || null,
        phone: editFields.phone?.trim() === '' ? null : editFields.phone?.trim(),
      };
      const updatedProfileData = await updateUserProfile(payload);
      setProfile((prevProfile: UserWithRole | null) => prevProfile ? { ...prevProfile, ...updatedProfileData, id: prevProfile.id } : null);
      setEditProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBookingPaidStatus = useCallback(async (bookingId: number, currentStatus: boolean) => {
    setError(null);
    const newStatus = !currentStatus;
    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_paid: newStatus }),
      });
      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update booking status');
      }
      setBookings(prevBookings =>
          prevBookings.map(b =>
              b.id === bookingId ? { ...b, is_paid: newStatus } : b
          )
      );
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update booking status';
        setError(message);
        console.error("Error toggling paid status:", message);
    }
  }, []);

  const staffTabs = [
    {
      id: 'schedule',
      label: 'My Schedule',
      content: (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">My Schedule</h2>
            {isLoadingCalendar && <p>Loading schedule...</p>}
            {calendarError && <p className="text-red-500">Error: {calendarError}</p>}
            {!isLoadingCalendar && !calendarError && (
                <CalendarView
                    events={calendarEvents}
                    onSelectEvent={handleCalendarEventClick}
                />
            )}
        </div>
      ),
    },
    {
      id: 'my-clients',
      label: 'My Clients',
      content: (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">My Assigned Clients</h2>
            {isLoadingMyClients && <p>Loading clients...</p>}
            {myClientsError && <p className="text-red-500">Error: {myClientsError}</p>}
            {!isLoadingMyClients && !myClientsError && myClients.length === 0 && (
                <p>No clients currently assigned to you.</p>
            )}
            {!isLoadingMyClients && !myClientsError && myClients.length > 0 && (
                <ul className="space-y-3">
                    {myClients.map(client => (
                        <li key={client.id} className="p-3 bg-white rounded shadow">
                            <p className="font-semibold">{client.first_name} {client.last_name} (ID: {client.id})</p>
                            <p className="text-sm text-gray-600">Email: {client.email || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Phone: {client.phone || 'N/A'}</p>
                            {client.pets && client.pets.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-sm font-medium">Pets:</p>
                                    <ul className="list-disc list-inside pl-4 text-sm">
                                        {client.pets.map(pet => <li key={pet.id}>{pet.name} ({pet.breed || 'Unknown breed'})</li>)}
                                    </ul>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
      ),
    },
    {
        id: 'petMedia',
        label: 'Pet Media',
        content: <PetMediaTabContent />,
    },
    {
        id: 'booking-management',
        label: 'Booking Management (All)',
        content: <BookingManagement
                    role="staff"
                    services={services}
                    bookings={bookings}
                    error={error}
                    isLoadingBookings={isLoadingData}
                    refetchBookings={fetchData}
                    handleToggleBookingPaidStatus={handleToggleBookingPaidStatus}
                 />,
    },
    {
      id: 'settings',
      label: 'My Profile',
      content: (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">My Profile</h2>
          {profileLoading && <p>Loading profile...</p>}
          {profileError && <p className="text-red-500">Error: {profileError}</p>}
          {profile && !editProfile && (
            <div className="space-y-2">
              <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
              <button onClick={startEdit} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Edit My Profile</button>
            </div>
          )}
          {editProfile && (
            <div className="space-y-3">
              <div>
                <label htmlFor="s_first_name" className="block text-sm font-medium">First Name</label>
                <input type="text" name="first_name" id="s_first_name" value={editFields.first_name || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="s_last_name" className="block text-sm font-medium">Last Name</label>
                <input type="text" name="last_name" id="s_last_name" value={editFields.last_name || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label htmlFor="s_phone" className="block text-sm font-medium">Phone</label>
                <input type="text" name="phone" id="s_phone" value={editFields.phone || ''} onChange={handleEditChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex space-x-2">
                <button onClick={saveProfile} disabled={isSaving} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
                <button onClick={cancelEdit} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ),
    }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarNavigation tabs={staffTabs} />
      <SlotDetailModal
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        bookings={selectedSlotBookings}
        slotTimeKey={selectedSlotTimeKey}
        services={services}
      />
    </div>
  );
}

interface SlotDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookings: Booking[] | null;
    slotTimeKey: string | null;
    services: Service[];
}

const SlotDetailModal: React.FC<SlotDetailModalProps> = ({ isOpen, onClose, bookings, slotTimeKey, services }) => {
    if (!isOpen || !bookings) return null;

    const getServiceName = (serviceType: string | null) => {
        if (!serviceType) return 'Unknown Service';
        const service = services.find(s => s.name === serviceType || s.id?.toString() === serviceType);
        return service ? service.name : serviceType;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bookings for ${slotTimeKey || 'Selected Slot'}`}>
            <div className="space-y-4">
                {bookings.map(booking => (
                    <div key={booking.id} className="p-3 border rounded-md bg-gray-50">
                        <p><strong>Service:</strong> {getServiceName(booking.service_type)}</p>
                        <p><strong>Time:</strong> {formatTime(booking.start_time)} - {formatTime(booking.end_time)}</p>
                        <p><strong>Status:</strong> {booking.status}</p>
                        <p><strong>Client:</strong> {booking.client_name || 'N/A'}</p>
                        {booking.pets && booking.pets.length > 0 && (
                            <p><strong>Pets:</strong> {booking.pets.map(p => p.name).join(', ')}</p>
                        )}
                    </div>
                ))}
            </div>
        </Modal>
    );
};

const formatTime = (isoString: string): string => {
    if (!isoString || !isoString.includes('T')) return 'N/A';
    try {
        const parts = isoString.split('T');
        const timePart = parts[1];
        if (typeof timePart === 'string') {
            return timePart.substring(0, 5);
        }
        return 'N/A';
    } catch (e) {
        console.error("Error extracting time:", isoString, e);
        return 'Invalid Time';
    }
};

const formatDate = (isoString: string): string => {
    if (!isoString) return 'Invalid Date';
    try {
        const datePart = isoString.split('T')[0];
        return datePart ?? 'Invalid Date';
    } catch (e) {
        console.error("Error extracting date:", isoString, e);
        return 'Invalid Date';
    }
};

const getTimeSlotKey = (booking: Booking): string => {
    return `${formatDate(booking.start_time)} ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`;
};