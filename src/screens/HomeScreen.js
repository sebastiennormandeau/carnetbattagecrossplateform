import React, { useLayoutEffect, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { theme } from '../theme/Theme';

export default function HomeScreen({ navigation }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [tools, setTools] = useState({ carnet: true, carte: true, inspection: true });

  useEffect(() => {
    const checkPrivileges = async () => {
      if (auth.currentUser) {
        try {
          // Check Admin
          const adminSnap = await getDoc(doc(db, 'admins', auth.currentUser.uid));
          if (adminSnap.exists() && adminSnap.data().enabled === true) {
            setIsAdmin(true);
          }
          
          // Check Tools Permissions
          const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userSnap.exists() && userSnap.data().tools) {
             // Fusionne les permissions pour que celles non-définies restent 'true'
             setTools({
                 carnet: userSnap.data().tools.carnet !== false,
                 carte: userSnap.data().tools.carte !== false,
                 inspection: userSnap.data().tools.inspection !== false
             });
          }
        } catch (e) {
          console.log("Erreur privileges:", e);
        }
      }
    };
    checkPrivileges();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Accueil',
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      
      <View style={styles.header}>
        <Text style={styles.title}>Fondabec Battage</Text>
        <Text style={styles.subtitle}>Sélectionnez un outil</Text>
      </View>

      <View style={styles.menuContainer}>
        {tools.carnet && (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('Projects')}
          >
            <Text style={styles.cardTitle}>Carnet de battage</Text>
            <Text style={styles.cardDesc}>Gestion de tous vos projets et listes de pieux</Text>
          </TouchableOpacity>
        )}

        {tools.carte && (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('DepthMap')}
          >
            <Text style={styles.cardTitle}>Carte Interactive</Text>
            <Text style={styles.cardDesc}>Visualisation globale de vos données sur le terrain</Text>
          </TouchableOpacity>
        )}

        {tools.inspection && (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => alert("Fonctionnalité 'Fiche d'inspection' bientot disponible !")}
          >
            <Text style={styles.cardTitle}>Fiche d"inspection</Text>
            <Text style={styles.cardDesc}>Rapports et vérifications des équipements</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
           <TouchableOpacity 
             style={[styles.card, { borderColor: theme.colors.primary }]}
             onPress={() => navigation.navigate('Admin')}
           >
             <Text style={styles.cardTitle}>Autorisations (Admin)</Text>
             <Text style={styles.cardDesc}>Gérer les accès utilisateurs et les délégations de projets</Text>
           </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  menuContainer: {
    gap: 15,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
  }
});
