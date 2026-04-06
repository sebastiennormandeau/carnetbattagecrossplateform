import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { theme } from '../theme/Theme';

export default function ProjectListScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let unsubscribeProjects = () => {};

    const loadProjects = async () => {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        const isAdmin = adminSnap.exists() && adminSnap.data().enabled === true;

        if (isAdmin) {
          unsubscribeProjects = onSnapshot(collection(db, 'projects'), (querySnapshot) => {
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(data);
            setLoading(false);
          });
        } else {
          const qOwner = query(collection(db, 'projects'), where('ownerUid', '==', user.uid));
          const qAllowed = query(collection(db, 'projects'), where('readUsers', 'array-contains', user.uid));
          
          let listOwner = [];
          let listAllowed = [];
          
          const mergeLists = () => {
             const map = new Map();
             listOwner.forEach(p => map.set(p.id, p));
             listAllowed.forEach(p => map.set(p.id, p));
             setProjects(Array.from(map.values()));
             setLoading(false);
          };

          const un1 = onSnapshot(qOwner, snap => {
             listOwner = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             mergeLists();
          });
          const un2 = onSnapshot(qAllowed, snap => {
             listAllowed = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             mergeLists();
          });

          unsubscribeProjects = () => { un1(); un2(); };
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
        setLoading(false);
      }
    };

    loadProjects();

    return () => unsubscribeProjects();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.projectCard}
      onPress={() => {
        navigation.navigate('ProjectDetail', { 
          projectId: item.id,
          projectName: item.name
        });
      }}
    >
      <Text style={styles.projectName}>{item.name}</Text>
      <Text style={styles.projectLocation}>{item.location}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : projects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucun projet trouvé.</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    marginTop: 50,
  },
  listContainer: {
    padding: 15,
  },
  projectCard: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 3, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 5,
  },
  projectLocation: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
});
