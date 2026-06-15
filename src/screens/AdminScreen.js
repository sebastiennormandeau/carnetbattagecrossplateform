import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch, ScrollView, TextInput, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../config/firebase';
import { getTenantQuery, requireTenant, setTenantDoc } from '../utils/firestore-tenant';
import { theme } from '../theme/Theme';
import { SMART_PILING_LOGO_BASE64 } from '../config/smartPilingLogoBase64';
import usePilingStore from '../store/usePilingStore';
import TenantSwitcher from '../components/TenantSwitcher';

const TEAM_COLORS = ['#34495e', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#2980b9', '#f39c12', '#16a085'];

export default function AdminScreen({ navigation }) {
    const [users, setUsers] = useState([]);
    const [selectedTab, setSelectedTab] = useState('USERS'); // USERS, SHIFTS, TEAMS, SETTINGS
    const [deductLunch, setDeductLunch] = useState(false);
    const [lunchMinutes, setLunchMinutes] = useState('30');
    
    // Store Zustand pour le logo
    const reportLogo = usePilingStore(state => state.reportLogo);
    const setReportLogo = usePilingStore(state => state.setReportLogo);

    useEffect(() => {
        // Fetch all users
        const unsubUsers = onSnapshot(getTenantQuery('users'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setUsers(data);
        }, error => console.error("Admin Users Error:", error));


        // Fetch Punch settings
        let unsubPunchSettings = () => {};
        try {
            const tenantId = requireTenant();
            unsubPunchSettings = onSnapshot(doc(db, 'settings', `punch_${tenantId}`), docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setDeductLunch(!!data.deductLunch);
                    setLunchMinutes(data.lunchMinutes ? String(data.lunchMinutes) : '30');
                }
            }, (error) => {
                console.error("ERREUR onSnapshot (settings/punch) in AdminScreen:", error);
            });
        } catch (e) {
            console.error("Erreur Settings Admin:", e);
        }

        return () => { unsubUsers(); unsubPunchSettings(); };
    }, []);

    const toggleAdmin = async (userId, currentRole) => {
        // Prevent removing oneself
        if (userId === auth.currentUser?.uid && currentRole === 'admin') {
            Alert.alert("Attention", "Vous ne pouvez pas retirer vos propres droits d'administrateur ici.");
            return;
        }

        try {
            await setDoc(doc(db, 'users', userId), { role: currentRole === 'admin' ? 'user' : 'admin' }, { merge: true });
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



    const handleToggleDeductLunch = async (val) => {
        try {
            const tenantId = requireTenant();
            await setTenantDoc(doc(db, 'settings', `punch_${tenantId}`), { deductLunch: val }, { merge: true });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de sauvegarder ce paramètre.");
        }
    };

    const handleSaveLunchMinutes = async (val) => {
        // Only update local state here to allow typing, save on blur
        setLunchMinutes(val);
    };

    const handleBlurLunchMinutes = async () => {
        try {
            const tenantId = requireTenant();
            await setTenantDoc(doc(db, 'settings', `punch_${tenantId}`), { lunchMinutes: parseInt(lunchMinutes, 10) || 0 }, { merge: true });
        } catch (e) {
            Alert.alert("Erreur", "Impossible de sauvegarder les minutes.");
        }
    };

    const handlePickLogo = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            const base64String = `data:image/jpeg;base64,${result.assets[0].base64}`;
            setReportLogo(base64String);
            Alert.alert("Succès", "Le logo a été mis à jour avec succès pour vos futurs rapports PDF !");
        }
    };

    const handleResetLogo = () => {
        setReportLogo(SMART_PILING_LOGO_BASE64);
        Alert.alert("Succès", "Le logo par défaut a été restauré.");
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>Retour</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Panneau Administrateur</Text>
            </View>

            <TenantSwitcher />
            
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'USERS' && styles.activeTab]} 
                    onPress={() => setSelectedTab('USERS')}
                >
                    <Text style={[styles.tabText, selectedTab === 'USERS' && styles.activeTabText]}>Utilisateurs</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'SETTINGS' && styles.activeTab]} 
                    onPress={() => setSelectedTab('SETTINGS')}
                >
                    <Text style={[styles.tabText, selectedTab === 'SETTINGS' && styles.activeTabText]}>Paramètres</Text>
                </TouchableOpacity>
            </View>

            {selectedTab === 'USERS' && (
                <FlatList
                    style={{ flex: 1 }}
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
                                        value={item.role === 'admin'} 
                                        onValueChange={() => toggleAdmin(item.id, item.role)}
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
                                    <Text style={styles.switchLabel}>Calendrier</Text>
                                    <Switch 
                                        value={item.tools ? item.tools.calendrier !== false : true} 
                                        onValueChange={() => toggleTool(item.id, 'calendrier', item.tools, true)}
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



            {selectedTab === 'SETTINGS' && (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                    <View style={styles.userCard}>
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Paramètres de Calcul (Horodateur)</Text>
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={{ color: theme.colors.textMuted }}>Déduire automatiquement le dîner</Text>
                            <Switch 
                                value={deductLunch} 
                                onValueChange={handleToggleDeductLunch}
                                trackColor={{ true: theme.colors.primaryDark, false: theme.colors.border }}
                                thumbColor={theme.colors.primary}
                            />
                        </View>
                        
                        {deductLunch && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                <Text style={{ color: theme.colors.textMuted }}>Durée du dîner (minutes)</Text>
                                <TextInput 
                                    style={{ backgroundColor: theme.colors.background, color: 'white', padding: 8, borderRadius: 5, width: 80, textAlign: 'center', borderWidth: 1, borderColor: theme.colors.border }}
                                    value={lunchMinutes}
                                    onChangeText={handleSaveLunchMinutes}
                                    onBlur={handleBlurLunchMinutes}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.userCard}>
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Personnalisation des Rapports PDF</Text>
                        <Text style={{ color: theme.colors.textMuted, marginBottom: 15 }}>
                            Ce logo apparaîtra en haut à gauche de tous les rapports PDF générés par l'application.
                        </Text>
                        
                        <View style={{ alignItems: 'center', marginBottom: 20, backgroundColor: 'white', padding: 10, borderRadius: 10 }}>
                            <Image source={{ uri: reportLogo }} style={{ height: 80, width: 200, resizeMode: 'contain' }} alt="Logo actuel" />
                        </View>

                        <TouchableOpacity style={[styles.exportBtn, { marginTop: 0 }]} onPress={handlePickLogo}>
                            <Text style={styles.exportBtnText}>🖼️ Choisir une image (Galerie)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.exportBtn, { marginTop: 10, backgroundColor: '#333' }]} onPress={handleResetLogo}>
                            <Text style={[styles.exportBtnText, { color: 'white' }]}>🔄 Restaurer le logo par défaut</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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

    toolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: theme.colors.border },

    dateBtn: { backgroundColor: '#333', padding: 10, borderRadius: 6, marginTop: 4, alignItems: 'center' },
    dateBtnText: { color: 'white', fontWeight: 'bold' },
    exportBtn: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    exportBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    textInput: { backgroundColor: '#1e1e1e', color: 'white', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
    colorSwatchSelected: { borderColor: 'white' }
});
