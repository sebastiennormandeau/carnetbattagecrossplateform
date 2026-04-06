import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { theme } from '../theme/Theme';

export default function AdminScreen({ navigation }) {
    const [users, setUsers] = useState([]);
    const [adminsMap, setAdminsMap] = useState({});
    const [projects, setProjects] = useState([]);
    const [selectedTab, setSelectedTab] = useState('USERS'); // USERS or PROJECTS
    const [selectedProject, setSelectedProject] = useState(null);

    useEffect(() => {
        // Fetch all users
        const unsubUsers = onSnapshot(collection(db, 'users'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setUsers(data);
        });

        // Fetch admins
        const unsubAdmins = onSnapshot(collection(db, 'admins'), snapshot => {
            const map = {};
            snapshot.forEach(docSnap => {
                map[docSnap.id] = docSnap.data().enabled;
            });
            setAdminsMap(map);
        });

        // Fetch projects
        const unsubProjects = onSnapshot(collection(db, 'projects'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setProjects(data);
        });

        return () => { unsubUsers(); unsubAdmins(); unsubProjects(); };
    }, []);

    const toggleAdmin = async (userId, currentStatus) => {
        // Prevent removing oneself
        if (userId === auth.currentUser?.uid && currentStatus) {
            Alert.alert("Attention", "Vous ne pouvez pas retirer vos propres droits d'administrateur ici.");
            return;
        }

        try {
            await setDoc(doc(db, 'admins', userId), { enabled: !currentStatus });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de modifier les droits.");
        }
    };

    const toggleBan = async (userId, isBanned) => {
        if (userId === auth.currentUser?.uid) return;
        try {
            await setDoc(doc(db, 'users', userId), { banned: !isBanned }, { merge: true });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de bannir l'utilisateur.");
        }
    };

    const toggleProjectAccess = async (projectId, userId, allowedUsersArr) => {
        const currentArr = allowedUsersArr || [];
        const isAllowed = currentArr.includes(userId);
        
        let newArr = [...currentArr];
        if (isAllowed) {
            newArr = newArr.filter(id => id !== userId);
        } else {
            newArr.push(userId);
        }

        try {
            await updateDoc(doc(db, 'projects', projectId), { allowedUsers: newArr });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de modifier l'accès au projet.");
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>Retour</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Panneau Administrateur</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'USERS' && styles.activeTab]} 
                    onPress={() => { setSelectedTab('USERS'); setSelectedProject(null); }}
                >
                    <Text style={[styles.tabText, selectedTab === 'USERS' && styles.activeTabText]}>Utilisateurs</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'PROJECTS' && styles.activeTab]} 
                    onPress={() => setSelectedTab('PROJECTS')}
                >
                    <Text style={[styles.tabText, selectedTab === 'PROJECTS' && styles.activeTabText]}>Accès Projets</Text>
                </TouchableOpacity>
            </View>

            {selectedTab === 'USERS' && (
                <FlatList
                    data={users}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    renderItem={({ item }) => (
                        <View style={styles.userCard}>
                            <Text style={styles.userEmail}>{item.email}</Text>
                            <View style={styles.switchesRow}>
                                <View style={styles.switchGroup}>
                                    <Text style={styles.switchLabel}>Administrateur</Text>
                                    <Switch 
                                        value={!!adminsMap[item.id]} 
                                        onValueChange={() => toggleAdmin(item.id, !!adminsMap[item.id])}
                                    />
                                </View>
                                <View style={styles.switchGroup}>
                                    <Text style={[styles.switchLabel, { color: theme.colors.error }]}>Banni</Text>
                                    <Switch 
                                        value={!!item.banned} 
                                        onValueChange={() => toggleBan(item.id, !!item.banned)}
                                        trackColor={{ true: theme.colors.error }}
                                    />
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}

            {selectedTab === 'PROJECTS' && !selectedProject && (
                <FlatList
                    data={projects}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.projectCard} onPress={() => setSelectedProject(item)}>
                            <Text style={styles.projectName}>{item.name}</Text>
                            <Text style={styles.projectDesc}>{(item.allowedUsers || []).length} utilisateur(s) autorisé(s)</Text>
                            <Text style={styles.projectOwner}>Propriétaire: {item.ownerUid}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            {selectedTab === 'PROJECTS' && selectedProject && (
                <View style={{ flex: 1, padding: 20 }}>
                    <TouchableOpacity style={styles.backBtnProj} onPress={() => setSelectedProject(null)}>
                        <Text style={{ color: 'white' }}>← Revenir à la liste des projets</Text>
                    </TouchableOpacity>
                    
                    <Text style={styles.projectTitleBig}>Accès: {selectedProject.name}</Text>
                    <Text style={{ color: theme.colors.textMuted, marginBottom: 15 }}>
                        Cochez les utilisateurs qui peuvent voir/modifier ce projet.
                    </Text>

                    <FlatList
                        data={users}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            // Find the live project to ensure switch matches reality
                            const liveProj = projects.find(p => p.id === selectedProject.id) || selectedProject;
                            const isAllowed = (liveProj.allowedUsers || []).includes(item.id);
                            const isOwner = liveProj.ownerUid === item.id;
                            const isAdminUser = !!adminsMap[item.id];
                            
                            return (
                                <View style={styles.accessRow}>
                                    <View>
                                        <Text style={{ color: 'white', fontSize: 16 }}>{item.email}</Text>
                                        {isOwner && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Propriétaire natif</Text>}
                                        {isAdminUser && !isOwner && <Text style={{ color: 'orange', fontSize: 12 }}>Accès Admin global</Text>}
                                    </View>
                                    <Switch 
                                        value={isAllowed || isOwner || isAdminUser} 
                                        disabled={isOwner || isAdminUser} // Admins & Owners ALWAYS have access via Firebase Rules
                                        onValueChange={() => toggleProjectAccess(liveProj.id, item.id, liveProj.allowedUsers)}
                                    />
                                </View>
                            );
                        }}
                    />
                </View>
            )}

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: theme.colors.surface },
    backButton: { marginRight: 20 },
    backText: { color: theme.colors.primary, fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.colors.border },
    tab: { flex: 1, padding: 15, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderColor: theme.colors.primary },
    tabText: { color: theme.colors.textMuted, fontSize: 16, fontWeight: 'bold' },
    activeTabText: { color: theme.colors.primary },
    userCard: { backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 15 },
    userEmail: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 15 },
    switchesRow: { flexDirection: 'row', justifyContent: 'space-between' },
    switchGroup: { alignItems: 'center' },
    switchLabel: { color: theme.colors.textMuted, marginBottom: 8, fontSize: 14 },
    projectCard: { backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 15 },
    projectName: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 5 },
    projectDesc: { color: theme.colors.primary, marginBottom: 5 },
    projectOwner: { color: theme.colors.textMuted, fontSize: 12 },
    backBtnProj: { marginBottom: 15, padding: 10, backgroundColor: '#333', borderRadius: 8, alignSelf: 'flex-start' },
    projectTitleBig: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 5 },
    accessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 10 }
});
