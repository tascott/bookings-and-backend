import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../services/supabaseClient';
import type { Client, Pet, Profile } from '@booking-and-accounts-monorepo/shared-types';

// Define the Stack param list for navigation context if needed, or assume it from parent
// For now, we'll just define the params this screen expects.
interface ClientDetailsScreenRouteParams {
  clientId: string; // Or number, depending on your data type
}

// Assuming this screen is part of a stack that can provide these params
type ClientDetailsScreenRouteProp = RouteProp<{ ClientDetails: ClientDetailsScreenRouteParams }, 'ClientDetails'>;

interface Props {
  route: ClientDetailsScreenRouteProp;
}

// Helper type for raw client data before combining with profile
type RawClientData = {
  id: number;
  user_id: string | null;
  email: string | null;
  default_staff_id: number | null;
  // other fields directly from clients table...
};

const ClientDetailsScreen: React.FC<Props> = ({ route }) => {
  const { clientId } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    console.log('ClientDetailsScreen Params:', { clientId });

    const fetchClientAndPets = async () => {
      setIsLoading(true);
      setError(null);
      setClient(null);
      setPets([]);
      try {
        // 1. Fetch basic client details from 'clients' table
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, user_id, email, default_staff_id') // Select specific fields
          .eq('id', clientId)
          .single<RawClientData>();

        if (!isMounted) return;
        if (clientError) throw clientError;
        if (!clientData) throw new Error('Client base data not found');

        let profileData: Partial<Profile> = {};
        // 2. Fetch profile details if user_id exists
        if (clientData.user_id) {
          const { data: fetchedProfileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone, address_line_1, address_line_2, town_or_city, county, postcode, country, latitude, longitude') // Select relevant profile fields
            .eq('user_id', clientData.user_id)
            .single<Profile>();

          if (!isMounted) return;
          // Log profile error but don't block if profile isn't found (optional client profile)
          if (profileError) {
            console.warn(`Profile not found for user_id ${clientData.user_id}:`, profileError.message);
          } else if (fetchedProfileData) {
            profileData = fetchedProfileData;
          }
        }

        // 3. Combine client and profile data into the Client type structure
        const combinedClient: Client = {
          id: clientData.id,
          user_id: clientData.user_id,
          email: clientData.email,
          default_staff_id: clientData.default_staff_id,
          first_name: profileData?.first_name || null,
          last_name: profileData?.last_name || null,
          phone: profileData?.phone || null,
          address_line_1: profileData?.address_line_1 || null,
          address_line_2: profileData?.address_line_2 || null,
          town_or_city: profileData?.town_or_city || null,
          county: profileData?.county || null,
          postcode: profileData?.postcode || null,
          country: profileData?.country || null,
          latitude: profileData?.latitude || null,
          longitude: profileData?.longitude || null,
          pets: [], // Pets will be fetched next
          default_staff_name: null, // Assuming default_staff_name is not fetched here
        };

        setClient(combinedClient);

        // 4. Fetch pets associated with the client
        const { data: petsData, error: petsError } = await supabase
          .from('pets')
          .select('*')
          .eq('client_id', clientId);

        if (!isMounted) return;
        if (petsError) throw petsError;
        setPets(petsData || []);
        // Update the client object in state with pets (optional, could just use separate pets state)
        // setClient(prev => prev ? { ...prev, pets: petsData || [] } : null);

      } catch (err: any) {
        console.error('Error fetching client/pet details:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load details');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchClientAndPets();

    return () => { isMounted = false; };
  }, [clientId]);

  // Render Pet Item for FlatList
  const renderPetItem = ({ item }: { item: Pet }) => (
    <View style={styles.petItem}>
      <Text style={styles.petName}>{item.name}</Text>
      <Text>Breed: {item.breed || 'N/A'}</Text>
      <Text>Age: {item.age || 'N/A'}</Text>
      {item.notes && <Text>Notes: {item.notes}</Text>}
      {/* Add other pet details as needed */}
    </View>
  );

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /><Text>Loading client details...</Text></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  }

  if (!client) {
    // This case might be covered by the error state if fetch fails, but good practice to keep
    return <View style={styles.centered}><Text>Client not found.</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Client Details</Text>
      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Contact Info</Text>
        <Text>Name: {client.first_name || ''} {client.last_name || ''}</Text>
        <Text>Email: {client.email || 'N/A'}</Text>
        <Text>Phone: {client.phone || 'N/A'}</Text>
        {/* Display Address Fields */}
        {(client.address_line_1 || client.town_or_city || client.postcode) && (
            <Text>
              Address: {client.address_line_1 || ''}{client.address_line_2 ? `, ${client.address_line_2}` : ''}, {client.town_or_city || ''}, {client.county || ''}, {client.postcode || ''} {client.country || ''}
            </Text>
        )}
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Pets</Text>
        {pets.length > 0 ? (
          <FlatList
            data={pets}
            renderItem={renderPetItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false} // Disable FlatList scrolling since it's inside ScrollView
          />
        ) : (
          <Text>No pets found for this client.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  petItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  petName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});

export default ClientDetailsScreen;