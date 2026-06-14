import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch, ScrollView, TextInput, Image } from 'react-native';
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
import { migrateOldDataToVibeCodingMind } from '../utils/dataMigration';

const TEAM_COLORS = ['#34495e', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#2980b9', '#f39c12', '#16a085'];

export default function AdminScreen({ navigation }) {
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedTab, setSelectedTab] = useState('USERS'); // USERS, PROJECTS, SHIFTS, TEAMS, SETTINGS
    const [selectedProject, setSelectedProject] = useState(null);
    const [shifts, setShifts] = useState([]);
    const [deductLunch, setDeductLunch] = useState(false);
    const [lunchMinutes, setLunchMinutes] = useState('30');
    
    // Store Zustand pour le logo
    const reportLogo = usePilingStore(state => state.reportLogo);
    const setReportLogo = usePilingStore(state => state.setReportLogo);
    
    // Date Picker state
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 14); // Par défaut: 2 dernières semaines
        d.setHours(0,0,0,0);
        return d;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setHours(23,59,59,999);
        return d;
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        // Fetch all users
        const unsubUsers = onSnapshot(getTenantQuery('users'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setUsers(data);
        }, error => console.error("Admin Users Error:", error));

        // Fetch projects
        const unsubProjects = onSnapshot(getTenantQuery('projects'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setProjects(data);
        }, error => console.error("Admin Projects Error:", error));

        // Fetch shifts
        const unsubShifts = onSnapshot(getTenantQuery('shifts'), snapshot => {
            const data = [];
            snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
            setShifts(data);
        }, error => console.error("Admin Shifts Error:", error));

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

        return () => { unsubUsers(); unsubProjects(); unsubShifts(); unsubPunchSettings(); };
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

    const handleExportPayrollPDF = async () => {
        try {
            Alert.alert("Génération", "Préparation du rapport de paie...");

            const dateStr = new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
            const sDateStr = startDate.toLocaleDateString('fr-CA');
            const eDateStr = endDate.toLocaleDateString('fr-CA');

            // Filtrer les quarts dans la période ET qui sont terminés
            const validShifts = shifts.filter(s => {
                if (!s.punchOutTime || !s.punchInTime) return false;
                const inMs = s.punchInTime.toMillis();
                return inMs >= startDate.getTime() && inMs <= endDate.getTime();
            });

            // Regrouper par employé
            const empData = {};
            validShifts.forEach(s => {
                const emp = s.userEmail || s.userId;
                if (!empData[emp]) empData[emp] = { totalMs: 0, shiftsCount: 0, projects: new Set() };
                
                const inMs = s.punchInTime.toMillis();
                const outMs = s.punchOutTime.toMillis();
                let diffMs = outMs - inMs;
                
                if (deductLunch) {
                    const inDateObj = new Date(inMs);
                    const outDateObj = new Date(outMs);
                    if (inDateObj.getHours() < 12 && outDateObj.getHours() >= 12) {
                        const lunchMs = (parseInt(lunchMinutes) || 0) * 60 * 1000;
                        diffMs -= lunchMs;
                        if (diffMs < 0) diffMs = 0;
                    }
                }
                
                empData[emp].totalMs += diffMs;
                empData[emp].shiftsCount += 1;
                empData[emp].projects.add(s.projectName || 'Inconnu');
            });

            const rowsHtml = Object.keys(empData).map(emp => {
                const hours = (empData[emp].totalMs / 3600000).toFixed(2);
                const projs = Array.from(empData[emp].projects).join(', ');
                return `
                <tr>
                    <td>${emp}</td>
                    <td>${empData[emp].shiftsCount}</td>
                    <td>${projs}</td>
                    <td style="text-align: right; font-weight: bold; font-size: 14px;">${hours} h</td>
                </tr>
                `;
            }).join('');

            const html = `
            <html>
                <head>
                <style>
                    body { font-family: Helvetica, Arial, sans-serif; padding: 10px 30px; color: #333; margin: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px; }
                    .logo-img { max-height: 80px; width: auto; max-width: 250px; }
                    .title-box { display: flex; flex-direction: column; flex: 1; margin-left: 20px; margin-top: 5px; }
                    .title { color: #003366; font-size: 24px; font-weight: bold; margin: 0; }
                    .subtitle { font-size: 14px; color: #333; margin-top: 8px; }
                    .date { font-size: 12px; color: #333; margin-top: 8px; text-align: right; }
                    hr { border: 0; border-top: 1px solid #999; margin-top: 30px; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border-bottom: 1px solid #ccc; padding: 12px 8px; text-align: left; }
                    th { background-color: #003366; color: white; font-weight: bold; }
                    td { color: black; }
                </style>
                </head>
                <body>
                <div class="header">
                    <img src="${reportLogo || SMART_PILING_LOGO_BASE64}" class="logo-img" />
                    <div class="title-box">
                    <p class="title">Sommaire de Paie (Horodateur)</p>
                    <p class="subtitle">Période: ${sDateStr} au ${eDateStr}</p>
                    <p class="subtitle" style="font-size:12px; color:#666;">Dîner déduit automatiquement: ${deductLunch ? lunchMinutes + ' min' : 'Non'}</p>
                    </div>
                    <div class="date">Généré le:<br/>${dateStr}</div>
                </div>
                <hr />
                <table>
                    <tr>
                    <th>Employé</th>
                    <th>Quarts</th>
                    <th>Chantiers visités</th>
                    <th style="text-align: right;">Heures Totales</th>
                    </tr>
                    ${rowsHtml || '<tr><td colspan="4" style="text-align:center;">Aucune donnée dans cette période</td></tr>'}
                </table>
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            const stamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
            const newFile = new File(Paths.cache, `SommairePaie_${stamp}.pdf`);
            const oldFile = new File(uri);
            oldFile.move(newFile);
            await Sharing.shareAsync(newFile.uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Partager le rapport' });
        } catch (e) {
            console.error("PDF Export Crash:", e);
            Alert.alert("Erreur Système", "L'opération a échoué.\nDétails: " + e.message);
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

            <TenantSwitcher />
            
            <View style={{ padding: 15, backgroundColor: theme.colors.surface, marginHorizontal: 20, borderRadius: 10, marginBottom: 15 }}>
                <Text style={{ color: 'white', marginBottom: 10, fontWeight: 'bold' }}>Outils de Migration (Temporaire)</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 15 }}>
                    Utilisez ce bouton pour réaffecter tous les anciens projets et données (sans compagnie ou avec une ancienne compagnie) à votre compagnie actuelle.
                </Text>
                <TouchableOpacity 
                    style={{ backgroundColor: theme.colors.primary, padding: 12, borderRadius: 8, alignItems: 'center' }}
                    onPress={migrateOldDataToVibeCodingMind}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Lier les anciennes données à cette compagnie</Text>
                </TouchableOpacity>
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
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 'SETTINGS' && styles.activeTab]} 
                    onPress={() => { setSelectedTab('SETTINGS'); setSelectedProject(null); }}
                >
                    <Text style={[styles.tabText, selectedTab === 'SETTINGS' && styles.activeTabText]}>Paramètres</Text>
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
                            const isAdminUser = item.role === 'admin';
                            
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

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderColor: '#333', paddingTop: 15 }}>
                        <View style={{flex: 1}}>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Du :</Text>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateBtn}>
                                <Text style={styles.dateBtnText}>{startDate.toLocaleDateString()}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 1, marginLeft: 10}}>
                            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Au :</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateBtn}>
                                <Text style={styles.dateBtnText}>{endDate.toLocaleDateString()}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display="default"
                            onChange={(event, date) => {
                                setShowStartPicker(false);
                                if (date) { date.setHours(0,0,0,0); setStartDate(date); }
                            }}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display="default"
                            onChange={(event, date) => {
                                setShowEndPicker(false);
                                if (date) { date.setHours(23,59,59,999); setEndDate(date); }
                            }}
                        />
                    )}

                    <TouchableOpacity style={styles.exportBtn} onPress={handleExportPayrollPDF}>
                        <Text style={styles.exportBtnText}>📄 Exporter le Sommaire (PDF)</Text>
                    </TouchableOpacity>

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


            {selectedTab === 'SETTINGS' && (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
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
    projectCard: { backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 15 },
    projectName: { fontSize: 18, fontWeight: 'bold', color: 'white', marginBottom: 5 },
    projectDesc: { color: theme.colors.primary, marginBottom: 5 },
    projectOwner: { color: theme.colors.textMuted, fontSize: 12 },
    backBtnProj: { marginBottom: 15, padding: 10, backgroundColor: '#333', borderRadius: 8, alignSelf: 'flex-start' },
    projectTitleBig: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 5 },
    accessRow: { backgroundColor: theme.colors.surface, padding: 15, borderRadius: 10, marginBottom: 10 },
    toolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: theme.colors.border },
    radioGroup: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, padding: 4 },
    radioBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    radioBtnActive: { backgroundColor: '#333' },
    radioText: { color: theme.colors.textMuted, fontSize: 12 },
    radioTextActive: { color: 'white', fontWeight: 'bold' },
    dateBtn: { backgroundColor: '#333', padding: 10, borderRadius: 6, marginTop: 4, alignItems: 'center' },
    dateBtnText: { color: 'white', fontWeight: 'bold' },
    exportBtn: { backgroundColor: theme.colors.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
    exportBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
    textInput: { backgroundColor: '#1e1e1e', color: 'white', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
    colorSwatchSelected: { borderColor: 'white' }
});
