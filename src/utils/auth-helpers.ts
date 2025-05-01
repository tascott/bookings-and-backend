import { SupabaseClient, User } from '@supabase/supabase-js';

// Type definitions
type AuthResult = {
  user?: User;
  error?: string;
  status?: number;
}

type ClientIdResult = {
  clientId?: number;
  error?: string;
  status?: number;
}

/**
 * Get the authenticated user from Supabase
 * Returns the user object if authenticated, or an error object if not
 */
export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<AuthResult> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated', status: 401 };
  }

  return { user };
}

/**
 * Get the client ID for a user from the clients table
 * Returns the client ID if found, or an error object if not
 */
export async function getClientId(supabase: SupabaseClient, userId: string): Promise<ClientIdResult> {
  try {
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (clientError) {
      console.error('Error fetching client profile for user:', userId, clientError);
      if (clientError.code === 'PGRST116') { // Not found
        return { error: 'Client profile not found for this user', status: 404 };
      }
      throw clientError;
    }

    if (!clientData) {
      return { error: 'Client profile not found for this user', status: 404 };
    }

    return { clientId: clientData.id };
  } catch (error) {
    console.error('Error during client ID fetch:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve client profile';
    return { error: message, status: 500 };
  }
}

/**
 * Check if a user has admin role
 * Returns true if the user is an admin, false otherwise
 */
export async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', userId)
      .single();

    return !staffError && staffData && staffData.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * Check if a user is in the staff table (staff or admin)
 * Returns true if the user is found in staff, false otherwise
 */
export async function isUserStaff(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    // Use count to check for existence
    const { error, count } = await supabase
      .from('staff')
      .select('user_id', { count: 'exact' }) // Get count instead of using head/single
      .eq('user_id', userId);

    if (error) {
      console.error(`Error checking staff status for user ${userId}:`, error);
      return false;
    }

    // Check if count is greater than 0
    return count !== null && count > 0;

  } catch (error) {
    // Handle cases where the query execution itself fails
    console.error(`Error executing staff status check for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get client ID and check if user is admin or staff in one go
 * Common pattern used in many API routes
 */
export async function getUserAuthInfo(supabase: SupabaseClient): Promise<{
  user?: User;
  clientId?: number;
  isAdmin: boolean;
  isStaff: boolean;
  error?: string;
  status?: number;
}> {
  // First check authentication
  const { user, error, status } = await getAuthenticatedUser(supabase);
  if (error) {
    return { isAdmin: false, isStaff: false, error, status };
  }

  // At this point user is guaranteed to be defined
  if (!user) {
    return { isAdmin: false, isStaff: false, error: 'User not found', status: 401 };
  }

  // Check admin and staff status
  const isAdmin = await isUserAdmin(supabase, user.id);
  const isStaff = await isUserStaff(supabase, user.id);

  // Always try to get the client ID regardless of admin/staff status
  // This allows admins/staff to also have a client profile if needed
  const { clientId, error: clientError, status: clientStatus } = await getClientId(supabase, user.id);

  // For admin/staff users, not having a client ID is acceptable
  // Only return client fetch error for non-staff users
  if (clientError && !isAdmin && !isStaff) {
    // Only return error for non-staff/non-admin users
    return { user, isAdmin, isStaff, error: clientError, status: clientStatus };
  }

  // Return the user info with admin status, staff status and clientId if available
  return { user, clientId, isAdmin, isStaff };
}