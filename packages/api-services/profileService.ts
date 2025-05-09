import { Profile, UserWithRole } from '@booking-and-accounts-monorepo/shared-types';

export async function fetchUserProfile(): Promise<UserWithRole> {
  const response = await fetch('/api/profile');
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch user profile: ${response.status} ${errorBody}`);
  }
  const profileData = await response.json();

  return {
    ...profileData,
    id: profileData.user_id,
    role: profileData.role || 'staff',
  } as UserWithRole;
}

export async function updateUserProfile(profileData: Partial<Profile>): Promise<Profile> {
  const response = await fetch('/api/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update user profile: ${response.status} ${errorBody}`);
  }
  return response.json();
}