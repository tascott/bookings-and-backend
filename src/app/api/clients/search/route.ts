import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
    const supabase = await createClient();
    const supabaseAdmin = await createAdminClient();

    // 1. Check Auth & Role (Admin/Staff)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (staffError || !staffData || !['admin', 'staff'].includes(staffData.role || '')) {
        return NextResponse.json({ error: 'Forbidden: Requires admin or staff role' }, { status: 403 });
    }

    // 2. Get Search Term
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('term');

    if (!searchTerm || searchTerm.trim().length < 2) { // Require at least 2 chars
        return NextResponse.json({ error: 'Search term must be at least 2 characters long' }, { status: 400 });
    }

    const searchTermLower = searchTerm.toLowerCase().trim();
    const searchPattern = `%${searchTermLower}%`; // For LIKE operator

    // 3. Query Clients
    try {
        const { data: clients, error: queryError } = await supabaseAdmin
            .from('clients')
            .select(
                'id, email, profiles ( first_name, last_name )'
            )
            // Case-insensitive search on email OR first/last name
            .or(
                `email.ilike.${searchPattern},profiles.first_name.ilike.${searchPattern},profiles.last_name.ilike.${searchPattern}`
            )
            .limit(10); // Limit results for performance

        if (queryError) {
            console.error("Client search query error:", queryError);
            throw new Error('Database error during client search.');
        }

        // 4. Format Results
        const formattedResults = (clients || []).map(client => {
             // Handle profiles potentially being an array or null
             const profileData = Array.isArray(client.profiles) ? client.profiles[0] : client.profiles;
             const firstName = profileData?.first_name || '';
             const lastName = profileData?.last_name || '';
             const fullName = `${firstName} ${lastName}`.trim();

            return {
                id: client.id,
                name: fullName || 'No Name Set', // Display name or fallback
                email: client.email,
            };
        });

        return NextResponse.json(formattedResults);

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred during client search.';
        console.error('Client Search Error:', e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}