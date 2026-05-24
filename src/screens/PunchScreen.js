import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { getTenantQuery, addTenantDoc, requireTenant } from '../utils/firestore-tenant';
import { theme } from '../theme/Theme';
import { usePunchLocation } from '../hooks/usePunchLocation';
import { Ionicons } from '@expo/vector-icons';

export default function PunchScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [activeShift, setActiveShift] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [historyShifts, setHistoryShifts] = useState([]);

    const [deductLunch, setDeductLunch] = useState(false);
    const [lunchMinutes, setLunchMinutes] = useState('30');

    // Get current user and privileges
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        let unsubscribeProjects = () => {};
        
        const loadProjects = async () => {
            try {
                const tokenResult = await user.getIdTokenResult();
                const isAdmin = tokenResult.claims.role === 'admin';

                if (isAdmin) {
                    unsubscribeProjects = onSnapshot(getTenantQuery('projects'), (snap) => {
                        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        setProjects(data);
                        if (data.length > 0) {
                            setSelectedProjectId(prev => prev ? prev : data[0].id);
                        }
                    });
                } else {
                    const qOwner = query(getTenantQuery('projects'), where('ownerUid', '==', user.uid));
                    const qAllowed = query(getTenantQuery('projects'), where('readUsers', 'array-contains', user.uid));
                    
                    let listO = [];
                    let listA = [];
                    const merge = () => {
                        const map = new Map();
                        listO.forEach(p => map.set(p.id, p));
                        listA.forEach(p => map.set(p.id, p));
                        const arr = Array.from(map.values());
                        setProjects(arr);
                        if (arr.length > 0) {
                            setSelectedProjectId(prev => prev ? prev : arr[0].id);
                        }
                    };

                    const u1 = onSnapshot(qOwner, s => { listO = s.docs.map(d => ({ id: d.id, ...d.data() })); merge(); });
                    const u2 = onSnapshot(qAllowed, s => { listA = s.docs.map(d => ({ id: d.id, ...d.data() })); merge(); });
                    unsubscribeProjects = () => { u1(); u2(); };
                }
            } catch (e) {
                console.error("Erreur projets:", e);
            }
        };

        loadProjects();

        // Check for active shift & fetch history
        const qShift = query(getTenantQuery('shifts'), where('userId', '==', user.uid));
        const unsubShift = onSnapshot(qShift, (snap) => {
            const allShifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const active = allShifts.find(s => s.punchOutTime === null);
            if (active) {
                setActiveShift(active);
                setSelectedProjectId(active.projectId); // Forcer le dropdown sur le projet courant
            } else {
                setActiveShift(null);
            }

            setHistoryShifts(allShifts.filter(s => s.punchOutTime !== null).sort((a,b) => {
                const tA = a.punchInTime ? a.punchInTime.toMillis() : 0;
                const tB = b.punchInTime ? b.punchInTime.toMillis() : 0;
                return tB - tA; // descending
            }));
            
            setLoading(false);
        });

        let unsubPunchSettings = () => {};
        // Fetch Punch settings
        try {
            const tenantId = requireTenant();
            unsubPunchSettings = onSnapshot(doc(db, 'settings', `punch_${tenantId}`), docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDeductLunch(!!data.deductLunch);
                    setLunchMinutes(data.lunchMinutes ? String(data.lunchMinutes) : '30');
                }
            }, (error) => {
                console.error("ERREUR onSnapshot (settings/punch) in PunchScreen:", error);
            });
        } catch (e) {
            console.error("Failed to load punch settings:", e);
        }

        return () => {
            unsubscribeProjects();
            unsubShift();
            unsubPunchSettings();
        };
    }, []);

    // Trouve le projet sélectionné pour obtenir ses coordonnées GPS
    const activeProject = projects.find(p => p.id === selectedProjectId);
    const targetLatitude = activeProject?.latitude || null;
    const targetLongitude = activeProject?.longitude || null;

    // Lancement du Custom Hook GPS
    const { 
        currentLocation, 
        distanceMeters, 
        isWithinRange, 
        errorMsg, 
        loadingLocalisation,
        RANGE_LIMIT_METERS
    } = usePunchLocation(targetLatitude, targetLongitude);

    const handlePunchIn = async () => {
        if (!currentLocation || !selectedProjectId) return;
        setProcessing(true);
        try {
            await addTenantDoc(collection(db, 'shifts'), {
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                projectId: selectedProjectId,
                projectName: activeProject.name,
                punchInTime: serverTimestamp(), // Sécurisé: heure du serveur
                punchInLoc: { lat: currentLocation.latitude, lng: currentLocation.longitude },
                punchOutTime: null,
                punchOutLoc: null
            });
        } catch (e) {
            console.error("Punch In Error:", e);
            Alert.alert("Erreur", "Impossible de créer l'entrée de temps.");
        } finally {
            setProcessing(false);
        }
    };

    const handlePunchOut = async () => {
        if (!activeShift || !currentLocation || !selectedProjectId) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, 'shifts', activeShift.id), {
                punchOutTime: serverTimestamp(),
                punchOutLoc: { lat: currentLocation.latitude, lng: currentLocation.longitude }
            });
            // Réinitialiser la séléction après punch out
            if (projects.length > 0) setSelectedProjectId(projects[0].id);
        } catch (e) {
            console.error("Punch Out Error:", e);
            Alert.alert("Erreur", "Impossible de terminer le quart de travail.");
        } finally {
            setProcessing(false);
        }
    };


    if (loading) {
        return <View style={[styles.container, {justifyContent:'center', alignItems:'center'}]}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
    }

    const missingGpsProject = selectedProjectId && (!targetLatitude || !targetLongitude);

    let totalToday = 0;
    let totalWeek = 0;
    const now = new Date();
    const todayStr = now.toDateString();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Dimanche
    startOfWeek.setHours(0,0,0,0);

    historyShifts.forEach(s => {
        const inMs = s.punchInTime ? s.punchInTime.seconds * 1000 : 0;
        const outMs = s.punchOutTime ? s.punchOutTime.seconds * 1000 : 0;
        if (inMs && outMs) {
            let diffMs = outMs - inMs;
            
            if (deductLunch) {
                const inDate = new Date(inMs);
                const outDate = new Date(outMs);
                if (inDate.getHours() < 12 && outDate.getHours() >= 12) {
                    const lunchMs = (parseInt(lunchMinutes) || 0) * 60 * 1000;
                    diffMs -= lunchMs;
                    if (diffMs < 0) diffMs = 0;
                }
            }

            const diffH = diffMs / 3600000;
            const inDateObj = new Date(inMs);
            if (inDateObj.toDateString() === todayStr) {
                totalToday += diffH;
            }
            if (inDateObj >= startOfWeek) {
                totalWeek += diffH;
            }
        }
    });

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                
                {/* Information de quart de travail actif */}
                {activeShift && (
                    <View style={styles.activeCard}>
                        <Ionicons name="timer" size={24} color="white" style={{marginBottom: 10}} />
                        <Text style={styles.activeText}>Vous êtes actuellement sur le chantier :</Text>
                        <Text style={styles.activeProjectText}>{activeShift.projectName}</Text>
                    </View>
                )}

                <Text style={styles.label}>Sélectionnez le Chantier</Text>
                <View style={[styles.pickerWrapper, activeShift && {opacity: 0.5}]}>
                    <Picker
                        selectedValue={selectedProjectId}
                        onValueChange={(val) => setSelectedProjectId(val)}
                        enabled={!activeShift && !processing}
                        style={{ color: 'white' }}
                        dropdownIconColor="white"
                    >
                        {projects.length === 0 && <Picker.Item label="Aucun projet disponible" value="" />}
                        {projects.map(p => (
                            <Picker.Item key={p.id} label={p.name} value={p.id} />
                        ))}
                    </Picker>
                </View>

                {/* Status GPS */}
                <View style={styles.gpsCard}>
                    {loadingLocalisation ? (
                        <ActivityIndicator color={theme.colors.primary} />
                    ) : errorMsg ? (
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    ) : missingGpsProject ? (
                        <Text style={styles.errorText}>Le chantier sélectionné n'a pas de position GPS enregistrée par un superviseur.</Text>
                    ) : (
                        <View style={{alignItems: 'center'}}>
                            <Ionicons name="location" size={32} color={isWithinRange ? theme.colors.success : theme.colors.error} />
                            <Text style={styles.gpsDistanceText}>
                                {distanceMeters !== null ? `Distance du chantier : ${distanceMeters} m` : "Calcul..."}
                            </Text>
                            {!isWithinRange && distanceMeters !== null && (
                                <Text style={styles.gpsWarningText}>
                                    Vous devez être à moins de {RANGE_LIMIT_METERS}m pour signaler votre présence.
                                </Text>
                            )}
                            {isWithinRange && (
                                <Text style={styles.gpsSuccessText}>Position validée.</Text>
                            )}
                        </View>
                    )}
                </View>

                <View style={{flex: 1}} />

                {/* Bouton Géant (Punch In / Punch Out) */}
                {!activeShift ? (
                    <TouchableOpacity 
                        style={[
                            styles.punchButton, 
                            styles.punchInButton, 
                            (!isWithinRange || processing || missingGpsProject || errorMsg) && styles.disabledButton
                        ]}
                        disabled={!isWithinRange || processing || missingGpsProject || !!errorMsg}
                        onPress={handlePunchIn}
                    >
                        {processing ? <ActivityIndicator color="white" /> : <Text style={styles.punchBtnText}>PUNCH IN</Text>}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        style={[
                            styles.punchButton, 
                            styles.punchOutButton, 
                            (!isWithinRange || processing || errorMsg) && styles.disabledButton
                        ]}
                        disabled={!isWithinRange || processing || !!errorMsg}
                        onPress={handlePunchOut}
                    >
                        {processing ? <ActivityIndicator color="white" /> : <Text style={styles.punchBtnText}>PUNCH OUT</Text>}
                    </TouchableOpacity>
                )}

                {/* Bouton Historique */}
                <TouchableOpacity 
                    style={{ marginTop: 20, alignItems: 'center' }}
                    onPress={() => setHistoryModalVisible(true)}
                >
                    <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: 'bold' }}>📋 Voir mon historique d'heures</Text>
                </TouchableOpacity>

            </View>

            {/* Modal Historique */}
            <Modal visible={historyModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
                    <View style={{ padding: 20, borderBottomWidth: 1, borderColor: '#333', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Historique des heures</Text>
                        <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', padding: 20, justifyContent: 'space-between' }}>
                        <View style={{ backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, flex: 0.48, alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textMuted }}>Aujourd'hui</Text>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{totalToday.toFixed(2)} h</Text>
                        </View>
                        <View style={{ backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, flex: 0.48, alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textMuted }}>Cette semaine</Text>
                            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{totalWeek.toFixed(2)} h</Text>
                        </View>
                    </View>

                    <FlatList
                        data={historyShifts}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 20 }}
                        ListEmptyComponent={<Text style={{color:'gray', textAlign:'center'}}>Aucun historique trouvé.</Text>}
                        renderItem={({ item }) => {
                            const inMs = item.punchInTime ? item.punchInTime.seconds * 1000 : null;
                            const outMs = item.punchOutTime ? item.punchOutTime.seconds * 1000 : null;
                            const inDate = inMs ? new Date(inMs) : null;
                            
                            let durTxt = '';
                            if (inMs && outMs) {
                                let diffMs = outMs - inMs;
                                let hadLunch = false;
                                
                                if (deductLunch) {
                                    const outDate = new Date(outMs);
                                    if (inDate.getHours() < 12 && outDate.getHours() >= 12) {
                                        const lunchMs = (parseInt(lunchMinutes) || 0) * 60 * 1000;
                                        diffMs -= lunchMs;
                                        if (diffMs < 0) diffMs = 0;
                                        hadLunch = true;
                                    }
                                }
                                
                                durTxt = (diffMs / 3600000).toFixed(2) + ' h' + (hadLunch ? ' (-dîner)' : '');
                            }

                            return (
                                <View style={{ backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>{inDate ? inDate.toLocaleDateString() : 'Date inconnue'}</Text>
                                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{durTxt}</Text>
                                    </View>
                                    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Chantier : {item.projectName}</Text>
                                    <Text style={{ color: 'gray', fontSize: 12, marginTop: 5 }}>Entrée : {inDate ? inDate.toLocaleTimeString() : '--'}</Text>
                                    <Text style={{ color: 'gray', fontSize: 12 }}>Sortie : {outMs ? new Date(outMs).toLocaleTimeString() : '--'}</Text>
                                </View>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: 20, borderBottomWidth: 1, borderColor: '#333', alignItems: 'center' },
    title: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    content: { flex: 1, padding: 20 },
    activeCard: { backgroundColor: theme.colors.primaryDark, padding: 20, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
    activeText: { color: 'white', fontSize: 16 },
    activeProjectText: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 5 },
    label: { color: theme.colors.textMuted, fontSize: 14, marginBottom: 5, fontWeight: 'bold' },
    pickerWrapper: { backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
    gpsCard: { backgroundColor: '#1A1A1A', padding: 20, borderRadius: 10, alignItems: 'center', minHeight: 120, justifyContent: 'center' },
    errorText: { color: theme.colors.error, textAlign: 'center', fontWeight: 'bold' },
    gpsDistanceText: { color: 'white', fontSize: 18, marginTop: 10, fontWeight: 'bold' },
    gpsWarningText: { color: theme.colors.error, textAlign: 'center', marginTop: 10, fontSize: 12 },
    gpsSuccessText: { color: theme.colors.primary, textAlign: 'center', marginTop: 10, fontWeight: 'bold' },
    punchButton: { padding: 25, borderRadius: 100, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
    punchInButton: { backgroundColor: theme.colors.primary },
    punchOutButton: { backgroundColor: theme.colors.error },
    disabledButton: { backgroundColor: '#555', elevation: 0, shadowOpacity: 0 },
    punchBtnText: { color: 'white', fontSize: 28, fontWeight: 'black', letterSpacing: 2 }
});
