import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { theme } from '../theme/Theme';

export default function AdminScreen({ navigation }) {
    const [users, setUsers] = useState([]);
    const [adminsMap, setAdminsMap] = useState({});
    const [projects, setProjects] = useState([]);
    const [selectedTab, setSelectedTab] = useState('USERS'); // USERS, PROJECTS or SHIFTS
    const [selectedProject, setSelectedProject] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [deductLunch, setDeductLunch] = useState(false);
    const [lunchMinutes, setLunchMinutes] = useState('30');

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

        // Fetch shifts
        const unsubShifts = onSnapshot(collection(db, 'shifts'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setShifts(data);
        });

        return () => { unsubUsers(); unsubAdmins(); unsubProjects(); unsubShifts(); };
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

    const toggleTool = async (userId, toolName, currentTools, defaultVal = true) => {
        const tools = currentTools || {};
        const currentVal = tools[toolName] !== undefined ? tools[toolName] : defaultVal;
        try {
            await setDoc(doc(db, 'users', userId), { tools: { ...tools, [toolName]: !currentVal } }, { merge: true });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de modifier l'outil.");
        }
    };

    const setProjectAccess = async (projectId, userId, readArr, writeArr, level) => {
        let r = [...(readArr || [])].filter(id => id !== userId);
        let w = [...(writeArr || [])].filter(id => id !== userId);
        
        if (level === 'READ' || level === 'WRITE') r.push(userId);
        if (level === 'WRITE') w.push(userId);

        try {
            await updateDoc(doc(db, 'projects', projectId), { readUsers: r, writeUsers: w });
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
                    onPress={() => { setSelectedTab('PROJECTS'); setSelectedProject(null); }}
                >
                    <Text style={[styles.tabText, selectedTab === 'PROJECTS' && styles.activeTabText]}>Accès Projets</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'SHIFTS' && styles.activeTab]} 
                    onPress={() => { setSelectedTab('SHIFTS'); setSelectedProject(null); }}
                >
                    <Text style={[styles.tabText, selectedTab === 'SHIFTS' && styles.activeTabText]}>Horodateur</Text>
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
                                    <Text style={styles.switchLabel}>Admin</Text>
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

                            <View style={styles.toolsRow}>
                                <View style={styles.switchGroup}>
                                    <Text style={styles.switchLabel}>Carnet</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.carnet !== false : true} 
                                        onValueChange={() => toggleTool(item.id, 'carnet', item.tools, true)}
                                    />
                                </View>
                                <View style={styles.switchGroup}>
                                    <Text style={styles.switchLabel}>Carte</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.carte !== false : true} 
                                        onValueChange={() => toggleTool(item.id, 'carte', item.tools, true)}
                                    />
                                </View>
                                <View style={styles.switchGroup}>
                                    <Text style={styles.switchLabel}>Insp.</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.inspection !== false : true} 
                                        onValueChange={() => toggleTool(item.id, 'inspection', item.tools, true)}
                                    />
                                </View>
                                <View style={styles.switchGroup}>
                                    <Text style={styles.switchLabel}>Punch</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.punch !== false : true} 
                                        onValueChange={() => toggleTool(item.id, 'punch', item.tools, true)}
                                    />
                                </View>
                                <View style={styles.switchGroup}>
                                    <Text style={[styles.switchLabel, { color: theme.colors.primary }]}>Formules</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.formules === true : false} 
                                        onValueChange={() => toggleTool(item.id, 'formules', item.tools, false)}
                                        trackColor={{ true: theme.colors.primaryDark, false: theme.colors.border }}
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
                            <Text style={styles.projectDesc}>{(item.readUsers || []).length} lecteur(s), {(item.writeUsers || []).length} éditeur(s)</Text>
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
                            const isRead = (liveProj.readUsers || []).includes(item.id);
                            const isWrite = (liveProj.writeUsers || []).includes(item.id);
                            
                            const isOwner = liveProj.ownerUid === item.id;
                            const isAdminUser = !!adminsMap[item.id];
                            
                            let currentLevel = 'NONE';
                            if (isWrite) currentLevel = 'WRITE';
                            else if (isRead) currentLevel = 'READ';

                            return (
                                <View style={styles.accessRow}>
                                    <View style={{ marginBottom: 10 }}>
                                        <Text style={{ color: 'white', fontSize: 16 }}>{item.email}</Text>
                                        {isOwner && <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Propriétaire natif</Text>}
                                        {isAdminUser && !isOwner && <Text style={{ color: 'orange', fontSize: 12 }}>Accès Admin global</Text>}
                                    </View>
                                    
                                    <View style={styles.radioGroup}>
                                        <TouchableOpacity 
                                            disabled={isOwner || isAdminUser}
                                            style={[styles.radioBtn, currentLevel === 'NONE' && styles.radioBtnActive, (isOwner || isAdminUser) && {opacity: 0.5}]}
                                            onPress={() => setProjectAccess(liveProj.id, item.id, liveProj.readUsers, liveProj.writeUsers, 'NONE')}
                                        >
                                            <Text style={[styles.radioText, currentLevel === 'NONE' && styles.radioTextActive]}>Aucun</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            disabled={isOwner || isAdminUser}
                                            style={[styles.radioBtn, currentLevel === 'READ' && styles.radioBtnActive, (isOwner || isAdminUser) && {opacity: 0.5}]}
                                            onPress={() => setProjectAccess(liveProj.id, item.id, liveProj.readUsers, liveProj.writeUsers, 'READ')}
                                        >
                                            <Text style={[styles.radioText, currentLevel === 'READ' && styles.radioTextActive]}>Lecture</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            disabled={isOwner || isAdminUser}
                                            style={[styles.radioBtn, currentLevel === 'WRITE' && styles.radioBtnActive, (isOwner || isAdminUser) && {opacity: 0.5}]}
                                            onPress={() => setProjectAccess(liveProj.id, item.id, liveProj.readUsers, liveProj.writeUsers, 'WRITE')}
                                        >
                                            <Text style={[styles.radioText, currentLevel === 'WRITE' && styles.radioTextActive]}>Écriture</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }}
                    />
                </View>
            )}

            {selectedTab === 'SHIFTS' && (
                <>
                <View style={{ padding: 20, backgroundColor: theme.colors.surface, marginHorizontal: 20, marginTop: 20, borderRadius: 10, borderWidth: 1, borderColor: '#333' }}>
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Paramètres de Calcul</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={{ color: theme.colors.textMuted }}>Déduire automatiquement le dîner</Text>
                        <Switch 
                            value={deductLunch} 
                            onValueChange={setDeductLunch}
                            trackColor={{ true: theme.colors.primaryDark, false: theme.colors.border }}
                            thumbColor={theme.colors.primary}
                        />
                    </View>
                    
                    {deductLunch && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textMuted }}>Durée du dîner (minutes)</Text>
                            <TextInput 
                                style={{ backgroundColor: theme.colors.background, color: 'white', padding: 8, borderRadius: 5, width: 80, textAlign: 'center', borderWidth: 1, borderColor: theme.colors.border }}
                                value={lunchMinutes}
                                onChangeText={setLunchMinutes}
                                keyboardType="numeric"
                            />
                        </View>
                    )}
                    <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 15 }}>* Le système soustraira ce temps uniquement pour les quarts de travail qui ont débuté avant 12h00 ET se sont terminés après 12h00.</Text>
                </View>

                <FlatList
                    data={shifts.sort((a,b) => {
                        const timeA = a.punchInTime ? a.punchInTime.toMillis() : 0;
                        const timeB = b.punchInTime ? b.punchInTime.toMillis() : 0;
                        return timeB - timeA;
                    })}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    renderItem={({ item }) => {
                        const inTimeMs = item.punchInTime ? item.punchInTime.toMillis() : null;
                        const outTimeMs = item.punchOutTime ? item.punchOutTime.toMillis() : null;
                        
                        const inTime = inTimeMs ? new Date(inTimeMs).toLocaleString() : 'Erreur réseau';
                        const outTime = outTimeMs ? new Date(outTimeMs).toLocaleString() : 'En cours...';
                        
                        let durationText = '';
                        if (inTimeMs && outTimeMs) {
                            let diffMs = outTimeMs - inTimeMs;
                            let hadLunch = false;
                            
                            if (deductLunch) {
                                const inDate = new Date(inTimeMs);
                                const outDate = new Date(outTimeMs);
                                
                                if (inDate.getHours() < 12 && outDate.getHours() >= 12) {
                                    const lunchMs = (parseInt(lunchMinutes) || 0) * 60 * 1000;
                                    diffMs -= lunchMs;
                                    if (diffMs < 0) diffMs = 0;
                                    hadLunch = true;
                                }
                            }
                            
                            const diffHours = diffMs / (1000 * 60 * 60);
                            durationText = `${diffHours.toFixed(2)} h ${hadLunch ? '(Dîner déduit)' : ''}`;
                        }

                        return (
                            <View style={styles.userCard}>
                                <Text style={styles.projectName}>{item.userEmail || item.userId}</Text>
                                <Text style={styles.projectOwner}>Chantier : {item.projectName}</Text>
                                <View style={{ marginTop: 10 }}>
                                    <Text style={{ color: theme.colors.success, fontWeight: 'bold' }}>Entrée : {inTime}</Text>
                                    <Text style={{ color: item.punchOutTime ? theme.colors.error : theme.colors.primary, fontWeight: 'bold' }}>Sortie : {outTime}</Text>
                                </View>
                                {durationText ? (
                                    <View style={{ marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Temps total : {durationText}</Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    }}
                />
                </>
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
    accessRow: { backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 10 },
    toolsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: theme.colors.border },
    radioGroup: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, padding: 4 },
    radioBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    radioBtnActive: { backgroundColor: '#333' },
    radioText: { color: theme.colors.textMuted, fontSize: 12 },
    radioTextActive: { color: 'white', fontWeight: 'bold' }
});
