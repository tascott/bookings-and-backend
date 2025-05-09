import { Profile, UserWithRole } from '../types/types';

export async function fetchUserProfile(): Promise<UserWithRole> {
  const response = await fetch('/api/profile');
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch user profile: ${response.status} ${errorBody}`);
  }
  return response.json();
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