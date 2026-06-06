import React, { useLayoutEffect, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { theme } from '../theme/Theme';

export default function HomeScreen({ navigation }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [tools, setTools] = useState({ carnet: true, carte: true, inspection: true, punch: true, formules: false, calendrier: true });

  useEffect(() => {
    const checkPrivileges = async () => {
      if (auth.currentUser) {
        try {
          // Check Admin via Custom Claims
          const tokenResult = await auth.currentUser.getIdTokenResult();
          console.log("Claims HomeScreen:", tokenResult.claims);
          if (tokenResult.claims.role === 'admin') {
            setIsAdmin(true);
          }
          
          // Check Tools Permissions
          const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userSnap.exists() && userSnap.data().tools) {
              setTools({
                  carnet: userSnap.data().tools.carnet !== false,
                  carte: userSnap.data().tools.carte !== false,
                  inspection: userSnap.data().tools.inspection !== false,
                  punch: userSnap.data().tools.punch !== false,
                  formules: userSnap.data().tools.formules === true, // explicitly default to false
                  calendrier: userSnap.data().tools.calendrier !== false
              });
          }
        } catch (e) {
          console.error("ERREUR PRIVILEGES (HomeScreen):", e);
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
        <Text style={styles.title}>Smart Piling</Text>
        <Text style={styles.subtitle}>Sélectionnez un outil</Text>
      </View>

      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {tools.calendrier && (
          <TouchableOpacity 
            style={[styles.card, { borderColor: '#3498db' }]}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Text style={[styles.cardTitle, { color: '#3498db' }]}>Calendrier 📅</Text>
            <Text style={styles.cardDesc}>Planification et assignation des chantiers</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.card, { borderColor: '#f1c40f' }]}
          onPress={() => navigation.navigate('ProjectsCRM')}
        >
          <Text style={[styles.cardTitle, { color: '#f1c40f' }]}>Projets CRM 📊</Text>
          <Text style={styles.cardDesc}>Gestion Kanban du statut des projets</Text>
        </TouchableOpacity>


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

        {tools.punch && (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('Punch')}
          >
            <Text style={styles.cardTitle}>Horodateur 🕒</Text>
            <Text style={styles.cardDesc}>Signalez votre arrivée et départ géolocalisés</Text>
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

        {tools.formules && (
          <TouchableOpacity 
            style={[styles.card, { borderColor: '#BB86FC' }]}
            onPress={() => navigation.navigate('Formulas')}
          >
            <Text style={[styles.cardTitle, { color: '#BB86FC' }]}>Formules de Battage 🧮</Text>
            <Text style={styles.cardDesc}>Calculs avancés (Hiley, Euler, etc.) réservés à l'ingénierie.</Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <>
             <TouchableOpacity 
               style={[styles.card, { borderColor: theme.colors.primary }]}
               onPress={() => navigation.navigate('Admin')}
             >
               <Text style={styles.cardTitle}>Autorisations (Admin)</Text>
               <Text style={styles.cardDesc}>Gérer les accès utilisateurs et les délégations de projets</Text>
             </TouchableOpacity>

             <TouchableOpacity 
               style={[styles.card, { borderColor: '#f39c12', marginTop: 15 }]}
               onPress={() => navigation.navigate('AdminUserManagement')}
             >
               <Text style={[styles.cardTitle, { color: '#f39c12' }]}>Gestion des Employés 👥</Text>
               <Text style={styles.cardDesc}>Gérer les profils et paramètres de paie (CCQ) des employés</Text>
             </TouchableOpacity>

             <TouchableOpacity 
               style={[styles.card, { borderColor: '#27ae60', marginTop: 15 }]}
               onPress={() => navigation.navigate('AdminPayroll')}
             >
               <Text style={[styles.cardTitle, { color: '#27ae60' }]}>Paie & Export CSV (Admin) 📈</Text>
               <Text style={styles.cardDesc}>Visualiser les heures soumises et exporter pour la paie</Text>
             </TouchableOpacity>
          </>
        )}

        <TouchableOpacity 
          style={styles.legalButton}
          onPress={() => navigation.navigate('Legal')}
        >
          <Text style={styles.legalText}>Mentions Légales & Confidentialité</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => auth.signOut()}
        >
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>

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
  },
  legalButton: {
    marginTop: 15,
    alignItems: 'center',
    paddingVertical: 10,
  },
  legalText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textDecorationLine: 'underline',
  },
  logoutButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
});
