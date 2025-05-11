import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MyClientsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My Clients Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
  },
});

export default MyClientsScreen;