'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // For navigation
import { PetWithDetails } from '@booking-and-accounts-monorepo/shared-types';
import {
  getAllPetsWithClientNames,
  getTodaysPetsForStaff,
} from '@booking-and-accounts-monorepo/api-services/src/image-service';
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client';

// Placeholder for user session logic - replace with your actual auth solution
const useUser = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient(); // Assuming createClient doesn't need to be in useMemo here as useUser is a hook itself.
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    fetchUser();
  }, [supabase]);
  return { userId };
};

// Renamed from PetMediaPage to PetMediaSelector
export default function PetMediaSelector() {
  const router = useRouter();
  // supabase client is memoized to prevent re-creation on every render
  const supabase = useMemo(() => createClient(), []);
  const { userId: staffUserId } = useUser();

  const [todaysPets, setTodaysPets] = useState<PetWithDetails[]>([]);
  const [allPets, setAllPets] = useState<PetWithDetails[]>([]);
  const [isLoadingTodaysPets, setIsLoadingTodaysPets] = useState(false);
  const [isLoadingAllPets, setIsLoadingAllPets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTodaysPetId, setSelectedTodaysPetId] = useState<number | string>('');
  const [selectedAllPetId, setSelectedAllPetId] = useState<number | string>('');

  useEffect(() => {
    if (staffUserId && supabase) {
      setIsLoadingTodaysPets(true);
      getTodaysPetsForStaff(supabase, staffUserId)
        .then(setTodaysPets)
        .catch(err => {
          console.error("Error fetching today's pets:", err);
          setError("Failed to load today's pets.");
        })
        .finally(() => setIsLoadingTodaysPets(false));
    }
  }, [staffUserId, supabase]);

  useEffect(() => {
    if (supabase) {
      setIsLoadingAllPets(true);
      getAllPetsWithClientNames(supabase)
        .then(setAllPets)
        .catch(err => {
          console.error('Error fetching all pets:', err);
          setError("Failed to load all pets.");
        })
        .finally(() => setIsLoadingAllPets(false));
    }
  }, [supabase]);

  const handlePetSelection = (petId: number | string) => {
    if (petId) {
      router.push(`/dashboard/staff/media/${petId}`);
    }
  };

  const formatPetOption = (pet: PetWithDetails) => {
    return `${pet.name || 'Unnamed Pet'} (Owner: ${pet.client_name || 'N/A'}, ID: ${pet.id})`;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Pet Image Management</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ marginBottom: '30px' }}>
        <h2>Select from Today&apos;s Pets</h2>
        {isLoadingTodaysPets ? (
          <p>Loading today&apos;s pets...</p>
        ) : todaysPets.length > 0 ? (
          <select
            value={selectedTodaysPetId}
            onChange={(e) => {
              const petId = e.target.value;
              setSelectedTodaysPetId(petId);
              setSelectedAllPetId('');
              handlePetSelection(petId);
            }}
            style={{ padding: '8px', minWidth: '300px' }}
          >
            <option value="">-- Select a pet from today&apos;s bookings --</option>
            {todaysPets.map(pet => (
              <option key={`today-${pet.id}`} value={pet.id}>
                {formatPetOption(pet)}
              </option>
            ))}
          </select>
        ) : (
          <p>No pets scheduled for you today, or unable to load.</p>
        )}
      </div>

      <div>
        <h2>Select from All Pets</h2>
        {isLoadingAllPets ? (
          <p>Loading all pets...</p>
        ) : allPets.length > 0 ? (
          <select
            value={selectedAllPetId}
            onChange={(e) => {
              const petId = e.target.value;
              setSelectedAllPetId(petId);
              setSelectedTodaysPetId('');
              handlePetSelection(petId);
            }}
            style={{ padding: '8px', minWidth: '300px' }}
          >
            <option value="">-- Select any pet --</option>
            {allPets.map(pet => (
              <option key={`all-${pet.id}`} value={pet.id}>
                {formatPetOption(pet)}
              </option>
            ))}
          </select>
        ) : (
          <p>No pets found in the system, or unable to load.</p>
        )}
      </div>
    </div>
  );
}