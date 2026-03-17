import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { auth } from '../config/firebase';
import { theme } from '../theme/Theme';

export default function HomeScreen({ navigation }) {
  
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
        <TouchableOpacity 
          style={styles.card}
          onPress={() => navigation.navigate('Projects')}
        >
          <Text style={styles.cardTitle}>Carnet de battage</Text>
          <Text style={styles.cardDesc}>Gestion de tous vos projets et listes de pieux</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => alert("Fonctionnalité 'Carte Interactive' bientot disponible !")}
        >
          <Text style={styles.cardTitle}>Carte Interactive</Text>
          <Text style={styles.cardDesc}>Visualisation globale de vos données sur le terrain</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => alert("Fonctionnalité 'Fiche d'inspection' bientot disponible !")}
        >
          <Text style={styles.cardTitle}>Fiche d"inspection</Text>
          <Text style={styles.cardDesc}>Rapports et vérifications des équipements</Text>
        </TouchableOpacity>
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
