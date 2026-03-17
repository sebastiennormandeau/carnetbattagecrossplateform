import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { db } from '../config/firebase';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { theme } from '../theme/Theme';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;

  const [project, setProject] = useState(null);
  const [piles, setPiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set the title dynamically based on the project name passed
  useLayoutEffect(() => {
    navigation.setOptions({
      title: projectName || `Projet #${projectId}`,
    });
  }, [navigation, projectName, projectId]);

  useEffect(() => {
    // 1. Listen to the Project document
    const projectRef = doc(db, 'projects', projectId);
    const unsubProject = onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() });
      }
    });

    // 2. Listen to the Piles subcollection
    const pilesRef = collection(db, 'projects', projectId, 'piles');
    const q = query(pilesRef);
    const unsubPiles = onSnapshot(q, (snapshot) => {
      const pilesData = [];
      snapshot.forEach(doc => {
        pilesData.push({ id: doc.id, ...doc.data() });
      });
      setPiles(pilesData);
      setLoading(false);
    });

    return () => {
      unsubProject();
      unsubPiles();
    };
  }, [projectId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Calculate stats
  const total = piles.length;
  const implantedCount = piles.filter(p => p.implanted).length;
  const validDepthPiles = piles.filter(p => p.depthFt > 0);
  const avgDepth = validDepthPiles.length > 0 
    ? validDepthPiles.reduce((acc, p) => acc + p.depthFt, 0) / validDepthPiles.length 
    : 0;
  const avgDepthRounded = Math.round(avgDepth * 10) / 10;

  // Group piles by shape
  const groupedPiles = piles.reduce((acc, pile) => {
    const shape = pile.shape || "Non définie";
    if (!acc[shape]) acc[shape] = [];
    acc[shape].push(pile);
    return acc;
  }, {});


  const renderPileList = () => {
    if (Object.keys(groupedPiles).length === 0) {
      return <Text style={styles.noDataText}>Aucun pieu pour le moment.</Text>;
    }

    return Object.entries(groupedPiles).map(([shape, shapePiles]) => (
      <View key={shape} style={styles.shapeSection}>
        <Text style={styles.shapeTitle}>Forme: {shape}</Text>
        {shapePiles.map(pile => (
          <TouchableOpacity 
            key={pile.id} 
            style={styles.pileCard}
            onPress={() => navigation.navigate('PileDetail', { 
              projectId: projectId, 
              pileId: pile.id 
            })}
          >
            <View>
              <Text style={styles.pileName}>{pile.pileNo || "Pieu"}</Text>
              <Text style={styles.pileSub}>
                Calibre: {pile.gaugeIn || "-"} in | Prof.: {pile.depthFt} ft | {pile.implanted ? "Implanté" : "Non implanté"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    ));
  };


  return (
    <ScrollView style={styles.container}>
      
      {/* Project Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Localisation</Text>
        <Text style={styles.sectionText}>{project?.location || "Adresse non définie"}</Text>
      </View>

      {/* Summary Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Résumé</Text>
        <Text style={styles.sectionText}>• Profondeur moyenne: {avgDepthRounded} ft</Text>
        <Text style={styles.sectionText}>• Pieux implantés: {implantedCount} / {total}</Text>
      </View>

      {/* Piles List Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pieux ({total})</Text>
        {renderPileList()}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text,
  },
  sectionText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 5,
  },
  shapeSection: {
    marginBottom: 15,
  },
  shapeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: 10,
    marginBottom: 8,
  },
  pileCard: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  pileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  pileSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  noDataText: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  }
});
