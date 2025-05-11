import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { supabase } from '../services/supabaseClient'; // Adjust path as needed
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator'; // Adjust path as needed

type StaffDashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'StaffDashboard'>;

interface Props {
  navigation: StaffDashboardScreenNavigationProp;
}

const StaffDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
      // Optionally show an alert to the user
    }
    // The auth state listener should automatically navigate to Login screen
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff Dashboard</Text>
      {/* Add staff-specific content here */}
      <Button title="Log Out" onPress={handleLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default StaffDashboardScreen;