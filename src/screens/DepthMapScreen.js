import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, Switch, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { getTenantQuery, addTenantDoc } from '../utils/firestore-tenant';
import { theme } from '../theme/Theme';

export default function DepthMapScreen({ navigation }) {
    const [projects, setProjects] = useState([]);
    const [history, setHistory] = useState([]);
    const [heatmapEnabled, setHeatmapEnabled] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // UI states
    const [addPicking, setAddPicking] = useState(false);
    const [addForm, setAddForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [draftBusy, setDraftBusy] = useState(false);

    // Form states
    const [draftName, setDraftName] = useState('');
    const [draftAddr, setDraftAddr] = useState('');
    const [draftAvg, setDraftAvg] = useState('');
    const [draftLatLng, setDraftLatLng] = useState(null);

    const DEFAULT_REGION = {
        latitude: 46.8138,
        longitude: -71.2079,
        latitudeDelta: 5.0,
        longitudeDelta: 5.0,
    };

    const mapRef = useRef(null);

    useEffect(() => {
        const unsubProjects = onSnapshot(getTenantQuery('projects'), snapshot => {
            const data = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.latitude && d.longitude) {
                    data.push({
                        kind: 'PROJECT',
                        id: doc.id,
                        title: d.name || `Projet ${doc.id}`,
                        address: '',
                        lat: d.latitude,
                        lng: d.longitude,
                        avgDepthFt: d.avgDepthFt || 0
                    });
                }
            });
            setProjects(data);
        });

        const unsubHistory = onSnapshot(getTenantQuery('map_points'), snapshot => {
            const data = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.latitude && d.longitude) {
                    data.push({
                        kind: 'HISTORY',
                        id: doc.id,
                        title: d.name || 'Chantier',
                        address: d.addressLine || '',
                        lat: d.latitude,
                        lng: d.longitude,
                        avgDepthFt: d.avgDepthFt || 0
                    });
                }
            });
            setHistory(data);
        });

        return () => { unsubProjects(); unsubHistory(); };
    }, []);

    useEffect(() => {
        const checkAdmin = async () => {
            if (auth.currentUser) {
                try {
                    const tokenResult = await auth.currentUser.getIdTokenResult();
                    if (tokenResult.claims.role === 'admin') {
                        setIsAdmin(true);
                    }
                } catch (e) {
                    console.log("Erreur admin:", e);
                }
            }
        };
        checkAdmin();
    }, []);

    const markers = useMemo(() => [...projects, ...history], [projects, history]);
    const maxDepth = useMemo(() => Math.max(1, ...markers.map(m => m.avgDepthFt)), [markers]);

    const heatmapPoints = useMemo(() => {
        return markers.map(m => ({
            latitude: m.lat,
            longitude: m.lng,
            weight: Math.max(1, m.avgDepthFt)
        }));
    }, [markers]);

    const centerAll = () => {
        if (markers.length === 0 || !mapRef.current) return;
        const coords = markers.map(m => ({ latitude: m.lat, longitude: m.lng }));
        mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
        });
    };

    // Auto-center on load
    useEffect(() => {
        if (markers.length > 0) setTimeout(centerAll, 500);
    }, [markers.length]);

    const handleLongPress = async (e) => {
        if (!addPicking) return;
        const coords = e.nativeEvent.coordinate;
        setDraftLatLng(coords);

        try {
            setDraftBusy(true);
            const reverse = await Location.reverseGeocodeAsync(coords);
            if (reverse && reverse.length > 0) {
                const r = reverse[0];
                setDraftAddr(`${r.streetNumber || ''} ${r.street || ''}, ${r.city || ''}`.trim());
            }
        } catch (err) {
            console.warn(err);
        } finally {
            setDraftBusy(false);
            setAddPicking(false);
            setAddForm(true);
        }
    };

    const savePoint = async () => {
        if (!draftLatLng || !draftName || !draftAvg) return;
        try {
            await addTenantDoc(collection(db, 'map_points'), {
                name: draftName.trim(),
                addressLine: draftAddr.trim(),
                latitude: draftLatLng.latitude,
                longitude: draftLatLng.longitude,
                avgDepthFt: parseFloat(draftAvg) || 0,
                createdAtEpochMs: Date.now(),
                updatedAtEpochMs: Date.now()
            });
            Alert.alert("Succès", "Point ajouté avec succès.");
            resetDraft();
            setAddForm(false);
        } catch (e) {
            Alert.alert("Erreur", "Impossible d'ajouter le point.");
        }
    };

    const resetDraft = () => {
        setDraftName('');
        setDraftAddr('');
        setDraftAvg('');
        setDraftLatLng(null);
    };

    const deleteHistoryPoint = async (id) => {
        try {
            await deleteDoc(doc(db, 'map_points', id));
            setSelected(null);
            Alert.alert("Succès", "Point supprimé.");
        } catch (e) {
            Alert.alert("Erreur", "Impossible de supprimer.");
        }
    };

    const getPinColor = (kind, avgDepth) => {
        if (kind === 'HISTORY') return '#2196F3'; // Blue
        const n = Math.max(0, Math.min(1, avgDepth / maxDepth));
        const hue = 120 * (1 - n);
        return `hsl(${hue}, 100%, 45%)`;
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.btnText}>Retour</Text>
                    </TouchableOpacity>
                    <View style={styles.actions}>
                        <Text style={{ color: 'white', marginRight: 5 }}>Heatmap</Text>
                        <Switch value={heatmapEnabled} onValueChange={setHeatmapEnabled} />
                        <TouchableOpacity style={styles.btnAction} onPress={centerAll}>
                            <Text style={styles.btnText}>Centrer</Text>
                        </TouchableOpacity>
                        {isAdmin && (
                            <TouchableOpacity
                                style={[styles.btnAction, { backgroundColor: theme.colors.primary }]}
                                onPress={() => {
                                    setSelected(null);
                                    resetDraft();
                                    setAddForm(false);
                                    setAddPicking(true);
                                    Alert.alert("Placement", "Maintenez votre doigt sur la carte pour placer le point.");
                                }}
                            >
                                <Text style={[styles.btnText, { color: '#121212' }]}>Ajouter</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>

            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={DEFAULT_REGION}
                onLongPress={handleLongPress}
            >
                {heatmapEnabled && heatmapPoints.length > 1 && (
                    <Heatmap points={heatmapPoints} radius={50} opacity={0.35} />
                )}

                {markers.map((m, i) => (
                    <Marker
                        key={m.id}
                        coordinate={{ latitude: m.lat, longitude: m.lng }}
                        title={m.title}
                        description={m.address}
                        onPress={() => setSelected(m)}
                    >
                        <View style={[styles.customMarker, { backgroundColor: getPinColor(m.kind, m.avgDepthFt) }]} />
                    </Marker>
                ))}

                {addPicking && draftLatLng && (
                    <Marker coordinate={draftLatLng} title="Nouveau point" pinColor="yellow" />
                )}
            </MapView>

            {addPicking && (
                <View style={styles.instructionOverlay}>
                    <Text style={styles.overlayTitle}>Placement du point</Text>
                    <Text style={{ color: 'white', marginBottom: 10 }}>Maintenez le doigt sur la carte pour placer le chantier.</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.btnSecondary} onPress={() => { setAddPicking(false); resetDraft(); }}>
                            <Text style={styles.btnText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnPrimary} onPress={() => draftLatLng ? setAddForm(true) : alert('Placez le point d\'abord.')}>
                            <Text style={[styles.btnText, { color: '#121212' }]}>Continuer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Details Modal */}
            <Modal visible={!!selected && !addPicking && !addForm} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        {selected && (
                            <>
                                <Text style={styles.modalTitle}>{selected.title}</Text>
                                <Text style={{ color: theme.colors.textMuted, marginBottom: 5 }}>{selected.address || 'Adresse non renseignée'}</Text>
                                <Text style={{ color: 'white', marginBottom: 20 }}>Profondeur moyenne : {selected.avgDepthFt.toFixed(1)} ft</Text>

                                {selected.kind === 'PROJECT' ? (
                                    <TouchableOpacity style={styles.btnPrimaryFull} onPress={() => {
                                        const pid = selected.id;
                                        setSelected(null);
                                        navigation.navigate('ProjectDetail', { projectId: pid });
                                    }}>
                                        <Text style={{ color: '#121212', fontWeight: 'bold' }}>Ouvrir le projet</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={[styles.btnPrimaryFull, { backgroundColor: theme.colors.error }]} onPress={() => deleteHistoryPoint(selected.id)}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Supprimer ce point</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.btnSecondaryFull} onPress={() => setSelected(null)}>
                                    <Text style={{ color: 'white' }}>Fermer</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Add Form Modal */}
            <Modal visible={addForm} transparent animationType="slide">
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Ajouter chantier historique</Text>

                        <TextInput style={styles.input} placeholderTextColor="#888" placeholder="Nom du chantier" value={draftName} onChangeText={setDraftName} />
                        <TextInput style={styles.input} placeholderTextColor="#888" placeholder="Localisation / adresse" value={draftAddr} onChangeText={setDraftAddr} />
                        <TextInput style={styles.input} placeholderTextColor="#888" placeholder="Profondeur moyenne (ft)" value={draftAvg} onChangeText={setDraftAvg} keyboardType="numeric" />

                        <Text style={{ color: 'gray', marginBottom: 15, fontSize: 12 }}>
                            {draftLatLng ? `📍 Position: ${draftLatLng.latitude.toFixed(5)}, ${draftLatLng.longitude.toFixed(5)}` : 'Aucun point.'}
                        </Text>

                        <TouchableOpacity style={[styles.btnPrimaryFull, { marginBottom: 10 }]} onPress={savePoint}>
                            <Text style={{ color: '#121212', fontWeight: 'bold' }}>Sauvegarder</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.btnSecondaryFull} onPress={() => { setAddForm(false); setAddPicking(true); }}>
                            <Text style={{ color: 'white' }}>Replacer sur la carte</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.btnSecondaryFull, { borderWidth: 0 }]} onPress={() => { setAddForm(false); resetDraft(); }}>
                            <Text style={{ color: 'gray' }}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: theme.colors.surface },
    actions: { flexDirection: 'row', alignItems: 'center' },
    map: { flex: 1 },
    btnText: { color: 'white', fontWeight: '500' },
    btnAction: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5, marginLeft: 10 },
    customMarker: { width: 14, height: 14, borderRadius: 7, borderColor: 'white', borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5 },
    instructionOverlay: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(30,30,30,0.9)', padding: 15, borderRadius: 10, width: '90%' },
    overlayTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 5 },
    btnPrimary: { backgroundColor: theme.colors.primary, padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
    btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' },
    modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { backgroundColor: theme.colors.surface, padding: 20, borderTopLeftRadius: 15, borderTopRightRadius: 15 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 15 },
    input: { backgroundColor: '#1E1E1E', color: 'white', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
    btnPrimaryFull: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    btnSecondaryFull: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }
});
