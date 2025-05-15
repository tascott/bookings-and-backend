import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, SectionList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PetMediaStackParamList } from '../../navigation/PetMediaStackNavigator';
import { PetWithDetails } from '@booking-and-accounts-monorepo/shared-types';
import {
  getAllPetsWithClientNames,
  getTodaysPetsForStaff,
} from '@booking-and-accounts-monorepo/api-services/src/image-service';
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client'; // Assuming this client setup works for RN too

// Define props for this screen
type Props = NativeStackScreenProps<PetMediaStackParamList, 'PetSelector'>;

// Placeholder for user auth - REPLACE with your actual mobile auth logic
// This might come from a context, async storage, etc.
const useUserAuth = () => {
  const [staffUserId, setStaffUserId] = useState<string | null>(null); // This should be auth.uid()
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Memoize Supabase client creation for stability within the hook
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // setIsLoadingAuth(true); // Already true by default, onAuthStateChange will set it to false

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setStaffUserId(session?.user?.id ?? null);
        setIsLoadingAuth(false); // Set loading to false once the auth state is determined (initially and on changes)
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]); // Dependency array includes supabase

  return { staffUserId, isLoadingAuth };
};

export default function PetSelectorScreen({ navigation }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { staffUserId, isLoadingAuth } = useUserAuth();

  const [todaysPets, setTodaysPets] = useState<PetWithDetails[]>([]);
  const [allPets, setAllPets] = useState<PetWithDetails[]>([]);
  const [isLoadingTodaysPets, setIsLoadingTodaysPets] = useState(false);
  const [isLoadingAllPets, setIsLoadingAllPets] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSelectPet = (pet: PetWithDetails) => {
    if (pet && pet.id) {
      navigation.navigate('PetImageGallery', { petId: pet.id, petName: pet.name || 'Pet' });
    }
  };

  const renderPetItem = ({ item }: { item: PetWithDetails }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => handleSelectPet(item)}>
      <Text style={styles.itemText}>{item.name || 'Unnamed Pet'} (Owner: {item.client_name || 'N/A'})</Text>
      <Text style={styles.itemIdText}>ID: {item.id}</Text>
    </TouchableOpacity>
  );

  if (isLoadingAuth) {
    return <View style={styles.container}><ActivityIndicator size="large" /><Text>Loading user...</Text></View>;
  }
  if (!staffUserId) {
    return <View style={styles.container}><Text style={styles.errorText}>Please log in as staff to access this feature.</Text></View>;
  }

  const sections = [];
  if (todaysPets.length > 0 || isLoadingTodaysPets) {
    sections.push({
      title: "Today's Pets",
      data: isLoadingTodaysPets ? [{id: 'loader-today', type: 'loader'}] : todaysPets,
      type: 'pets'
    });
  } else if (!isLoadingTodaysPets) {
    sections.push({
      title: "Today's Pets",
      data: [{id: 'empty-today', type: 'empty', message: 'No pets scheduled for you today.'}],
      type: 'status'
    });
  }

  if (allPets.length > 0 || isLoadingAllPets) {
    sections.push({
      title: 'All Pets',
      data: isLoadingAllPets ? [{id: 'loader-all', type: 'loader'}] : allPets,
      type: 'pets'
    });
  } else if (!isLoadingAllPets) {
     sections.push({
      title: "All Pets",
      data: [{id: 'empty-all', type: 'empty', message: 'No pets found in the system.'}],
      type: 'status'
    });
  }

  const renderSectionItem = ({ item, section }: { item: any, section: any }) => {
    if (item.type === 'loader') {
      return <ActivityIndicator style={{ marginTop: 10}} />;
    }
    if (item.type === 'empty') {
      return <Text style={styles.emptyListText}>{item.message}</Text>;
    }
    // Default is pet item
    return renderPetItem({ item }); // renderPetItem expects { item: PetWithDetails }
  };

  return (
    <SectionList
      style={styles.scrollViewContainer}
      sections={sections}
      keyExtractor={(item, index) => item.id.toString() + index}
      renderItem={renderSectionItem}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Select a Pet</Text>
          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </>
      }
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  listSection: {
    // marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  itemContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  itemIdText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
  },
});