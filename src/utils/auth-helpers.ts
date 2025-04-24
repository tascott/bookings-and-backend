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
 * Get client ID and check if user is admin in one go
 * Common pattern used in many API routes
 */
export async function getUserAuthInfo(supabase: SupabaseClient): Promise<{
  user?: User;
  clientId?: number;
  isAdmin: boolean;
  error?: string;
  status?: number;
}> {
  // First check authentication
  const { user, error, status } = await getAuthenticatedUser(supabase);
  if (error) {
    return { isAdmin: false, error, status };
  }

  // At this point user is guaranteed to be defined
  if (!user) {
    return { isAdmin: false, error: 'User not found', status: 401 };
  }

  // Check admin status
  const isAdmin = await isUserAdmin(supabase, user.id);

  // Always try to get the client ID regardless of admin status
  // This allows admins to also have a client profile if needed
  const { clientId, error: clientError, status: clientStatus } = await getClientId(supabase, user.id);

  // For admin users, not having a client ID is acceptable
  if (clientError && !isAdmin) {
    // Only return error for non-admin users
    return { user, isAdmin, error: clientError, status: clientStatus };
  }

  // Return the user info with admin status and clientId if available
  return { user, clientId, isAdmin };
}