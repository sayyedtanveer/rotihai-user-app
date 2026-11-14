import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RotiHai User</Text>
      <Text style={styles.description}>
        Customer mobile app scaffold. Feature implementation will follow.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7f7',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1f9d68' },
  description: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    color: '#444444',
  },
});
