import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProjectListScreen from './src/screens/ProjectListScreen';
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import PileDetailScreen from './src/screens/PileDetailScreen';
import { ActivityIndicator, View, TouchableOpacity, Text } from 'react-native';
import { theme } from './src/theme/Theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Common header options for dark theme
  const darkHeaderOptions = {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.primary,
    headerTitleStyle: { color: theme.colors.text }
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ contentStyle: { backgroundColor: theme.colors.background } }}>
        {user ? (
          // User is signed in
          <Stack.Group screenOptions={darkHeaderOptions}>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ 
                title: 'Accueil',
                headerRight: () => (
                  <TouchableOpacity onPress={() => auth.signOut()}>
                    <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>Déconnexion</Text>
                  </TouchableOpacity>
                ),
              }} 
            />
            <Stack.Screen 
              name="Projects" 
              component={ProjectListScreen} 
              options={{ title: 'Mes Projets' }} 
            />
            <Stack.Screen 
              name="ProjectDetail" 
              component={ProjectDetailScreen} 
            />
            <Stack.Screen 
              name="PileDetail" 
              component={PileDetailScreen} 
            />
          </Stack.Group>
        ) : (
          // No user is signed in
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
