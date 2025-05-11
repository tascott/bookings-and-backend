import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator'; // We might need to update RootStackParamList definition location if App.tsx is the source of truth

type ClientDashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ClientDashboard'>;

interface Props {
  navigation: ClientDashboardScreenNavigationProp;
}

const ClientDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Auth state listener in App.tsx will handle navigation
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Client Dashboard</Text>
      {/* Add client-specific content here */}
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

export default ClientDashboardScreen;