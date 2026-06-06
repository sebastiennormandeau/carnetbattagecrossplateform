import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import { registerForPushNotificationsAsync } from './src/utils/pushNotifications';
import { setTenant } from './src/utils/firestore-tenant';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProjectListScreen from './src/screens/ProjectListScreen';
import ProjectDetailScreen from './src/screens/ProjectDetailScreen';
import PileDetailScreen from './src/screens/PileDetailScreen';
import ProjectPlanScreen from './src/screens/ProjectPlanScreen';
import DepthMapScreen from './src/screens/DepthMapScreen';
import ProjectDocsScreen from './src/screens/ProjectDocsScreen';
import AdminScreen from './src/screens/AdminScreen';
import PunchScreen from './src/screens/PunchScreen';
import EngineeringScreen from './src/screens/EngineeringScreen';
import ProjectsCRMScreen from './src/screens/ProjectsCRMScreen';
import HammerConfigScreen from './src/screens/HammerConfigScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import LegalScreen from './src/screens/LegalScreen';
import AdminPayrollDashboard from './src/screens/AdminPayrollDashboard';
import AdminUserManagementScreen from './src/screens/AdminUserManagementScreen';
import { ActivityIndicator, View, TouchableOpacity, Text } from 'react-native';
import { theme } from './src/theme/Theme';
import usePilingStore from './src/store/usePilingStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      
      if (currentUser) {
        // Obtenir le Custom Claim "companyId" généré par Cloud Functions
        try {
          // true force le rafraîchissement du token pour s'assurer d'avoir les claims à jour
          const tokenResult = await currentUser.getIdTokenResult(true);
          console.log("Claims App.js (Force Refresh):", tokenResult.claims);
          const companyId = tokenResult.claims.companyId;
          
          if (companyId) {
            setTenant(companyId);
            console.log("Tenant actif configuré :", companyId);
          } else {
            console.warn("ATTENTION: Aucun companyId trouvé dans les claims de l'utilisateur !");
          }
        } catch (e) {
          console.error("Erreur lors de la récupération des Custom Claims:", e);
        }

        setUser(currentUser);
        setLoading(false);
        
        // Fetch hammers globally only if the user is authenticated
        usePilingStore.getState().fetchHammers();
        
        // Enregistrer pour les notifications push
        const token = await registerForPushNotificationsAsync();
        if (token) {
          try {
            await setDoc(doc(db, 'users', currentUser.uid), { pushToken: token }, { merge: true });
          } catch (e) {
            console.error("Erreur sauvegarde pushToken:", e);
          }
        }
      } else {
        // Si aucun utilisateur n'est connecté, arrêter le chargement
        setUser(null);
        setLoading(false);
      }
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
            <Stack.Screen 
              name="ProjectPlan" 
              component={ProjectPlanScreen} 
            />
            <Stack.Screen 
              name="ProjectDocs" 
              component={ProjectDocsScreen} 
            />
            <Stack.Screen 
              name="DepthMap" 
              component={DepthMapScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Admin" 
              component={AdminScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="AdminPayroll" 
              component={AdminPayrollDashboard} 
              options={{ title: 'Export Paie' }}
            />
            <Stack.Screen 
              name="Punch" 
              component={PunchScreen} 
              options={{ title: 'Horodateur' }}
            />
            <Stack.Screen 
              name="AdminUserManagement" 
              component={AdminUserManagementScreen} 
              options={{ title: 'Gestion des Employés' }}
            />
            <Stack.Screen 
              name="ProjectsCRM" 
              component={ProjectsCRMScreen} 
              options={{ title: 'Projets CRM' }}
            />
            <Stack.Screen 
              name="Formulas" 
              component={EngineeringScreen} 
              options={{ title: 'Formules de Battage' }}
            />
            <Stack.Screen 
              name="HammerConfig" 
              component={HammerConfigScreen} 
              options={{ title: 'Config Marteaux' }}
            />
            <Stack.Screen 
              name="Calendar" 
              component={CalendarScreen} 
              options={{ title: 'Calendrier' }}
            />
            <Stack.Screen 
              name="Legal" 
              component={LegalScreen} 
              options={{ title: 'Mentions Légales' }}
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
