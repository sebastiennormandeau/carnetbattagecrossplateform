import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Alert, ScrollView, ActivityIndicator, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, doc, writeBatch, getDocs, getDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import useProjectStore from '../store/useProjectStore';
import { sendPushNotification } from '../utils/pushNotifications';
import { getTenantQuery, requireTenant } from '../utils/firestore-tenant';

const PROJECT_COLORS = ['#34495e', '#e67e22', '#27ae60', '#c0392b', '#8e44ad', '#2980b9', '#f39c12', '#16a085'];

const AssignProjectModal = ({ visible, onClose, projectId }) => {
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    
    const { calendarEvents, projects } = useProjectStore();
    const [includeWeekends, setIncludeWeekends] = useState(false);

    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    
    const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
    const [selectedUsers, setSelectedUsers] = useState([]);

    const [existingEvents, setExistingEvents] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!visible || !projectId) return;

        const loadData = async () => {
            setIsLoadingUsers(true);
            try {
                // 1. Charger les utilisateurs
                const usersSnap = await getDocs(getTenantQuery('users'));
                const data = [];
                usersSnap.forEach(docSnap => {
                    const user = { id: docSnap.id, ...docSnap.data() };
                    if (user.role !== 'admin') {
                        data.push(user);
                    }
                });
                setUsers(data);

                // 2. Vérifier si le projet est déjà planifié
                const projectRef = doc(db, 'projects', projectId);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists() && projectSnap.data().status === 'scheduled') {
                    setIsEditing(true);
                    const pData = projectSnap.data();
                    setSelectedColor(pData.colorCode || PROJECT_COLORS[0]);
                    setSelectedUsers(pData.assignedUsers || []);

                    // 3. Charger les événements existants
                    const eventsQuery = getTenantQuery('calendar_events', where('projectId', '==', projectId));
                    const eventsSnap = await getDocs(eventsQuery);
                    const evts = [];
                    let minDate = null;
                    let maxDate = null;

                    eventsSnap.forEach(eSnap => {
                        const evt = { id: eSnap.id, ...eSnap.data() };
                        evts.push(evt);
                        // On force minuit UTC pour éviter les décalages de fuseau
                        const eDate = new Date(evt.date + 'T00:00:00');
                        if (!minDate || eDate < minDate) minDate = eDate;
                        if (!maxDate || eDate > maxDate) maxDate = eDate;
                    });
                    
                    setExistingEvents(evts);
                    if (minDate) setStartDate(minDate);
                    if (maxDate) setEndDate(maxDate);
                } else {
                    setIsEditing(false);
                    setExistingEvents([]);
                    setStartDate(new Date());
                    setEndDate(new Date());
                    setSelectedColor(PROJECT_COLORS[0]);
                    setSelectedUsers([]);
                }
            } catch (error) {
                console.error("Erreur chargement:", error);
            } finally {
                setIsLoadingUsers(false);
            }
        };

        loadData();
    }, [visible, projectId]);

    const toggleUser = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSave = async () => {
        if (selectedUsers.length === 0) {
            Alert.alert("Erreur", "Veuillez sélectionner au moins un employé.");
            return;
        }

        if (endDate < startDate) {
            Alert.alert("Erreur", "La date de fin doit être après ou égale à la date de début.");
            return;
        }

        let hasConflict = false;
        let conflictDetails = null;

        // Pré-calculer les dates à traiter
        const datesToProcess = [];
        let tempDate = new Date(startDate);
        tempDate.setHours(0, 0, 0, 0);
        
        const lastDate = new Date(endDate);
        lastDate.setHours(0, 0, 0, 0);

        while (tempDate <= lastDate) {
            const dayOfWeek = tempDate.getDay();
            if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
                const year = tempDate.getFullYear();
                const month = String(tempDate.getMonth() + 1).padStart(2, '0');
                const day = String(tempDate.getDate()).padStart(2, '0');
                datesToProcess.push(`${year}-${month}-${day}`);
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }

        // Vérification des conflits
        for (const dateString of datesToProcess) {
            const eventsOnDate = calendarEvents.filter(e => e.date === dateString && e.projectId !== projectId);
            
            for (const evt of eventsOnDate) {
                const conflictingUsers = selectedUsers.filter(uid => evt.assignedUsers?.includes(uid));
                if (conflictingUsers.length > 0) {
                    hasConflict = true;
                    const userObj = users.find(u => u.id === conflictingUsers[0]);
                    const userName = userObj ? (userObj.email || userObj.id) : conflictingUsers[0];
                    conflictDetails = { userName, dateString };
                    break;
                }
            }
            if (hasConflict) break;
        }

        const executeSave = async () => {
            try {
                const batch = writeBatch(db);

                // 1. Mettre à jour le projet globalement
                const projectRef = doc(db, 'projects', projectId);
                batch.update(projectRef, {
                    status: 'scheduled',
                    colorCode: selectedColor,
                    assignedUsers: selectedUsers
                });

                // 2. Traitement des événements (setDoc merge avec ID déterministe)
                const newDatesSet = new Set(datesToProcess);

                for (const dateString of datesToProcess) {
                    const eventId = `${projectId}_${dateString}`;
                    const newEventRef = doc(db, 'calendar_events', eventId);
                    batch.set(newEventRef, {
                        projectId: projectId,
                        date: dateString,
                        colorCode: selectedColor,
                        assignedUsers: selectedUsers,
                        companyId: requireTenant()
                    }, { merge: true });
                }

                // 3. Supprimer les anciens événements hors de la plage
                existingEvents.forEach(evt => {
                    if (!newDatesSet.has(evt.date)) {
                        batch.delete(doc(db, 'calendar_events', evt.id));
                    }
                });

                await batch.commit();

                // === NOTIFICATIONS PUSH ===
                try {
                    const projectData = projects.find(p => p.id === projectId);
                    const projectName = projectData?.name || 'Projet inconnu';
                    const projectAddress = projectData?.address || 'contacter votre supperviseur pour l\'emplacement du projet';

                    // Extraire les pushTokens des utilisateurs sélectionnés
                    const tokensToNotify = users
                        .filter(u => selectedUsers.includes(u.id) && u.pushToken)
                        .map(u => u.pushToken);

                    if (tokensToNotify.length > 0) {
                        const title = "Nouvelle assignation !";
                        const body = `Vous avez été assigné au projet ${projectName} (${projectAddress}).`;
                        await sendPushNotification(tokensToNotify, title, body);
                    }
                } catch (notifError) {
                    console.error("Erreur notification push:", notifError);
                }
                // =========================

                onClose();
                setSelectedUsers([]);
                setStartDate(new Date());
                setEndDate(new Date());
                setIncludeWeekends(false);

            } catch (error) {
                console.error("Erreur d'assignation:", error);
                Alert.alert("Erreur", "Impossible d'assigner le projet.");
            }
        };

        if (hasConflict) {
            Alert.alert(
                "Conflit détecté",
                `${conflictDetails.userName} est déjà sur un autre chantier le ${conflictDetails.dateString}. Forcer l'assignation ?`,
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Forcer", style: "destructive", onPress: executeSave }
                ]
            );
        } else {
            executeSave();
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalBackground}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>{isEditing ? "Modifier l'assignation" : "Assigner le Projet"}</Text>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Dates */}
                        <View style={styles.dateRow}>
                            <View style={{ flex: 1, marginRight: 5 }}>
                                <Text style={styles.label}>Date de début</Text>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                                    <Text style={styles.dateBtnText}>{startDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1, marginLeft: 5 }}>
                                <Text style={styles.label}>Date de fin</Text>
                                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
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
                                    if (date) setStartDate(date);
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
                                    if (date) setEndDate(date);
                                }}
                            />
                        )}

                        {/* Options */}
                        <View style={styles.optionRow}>
                            <Text style={styles.label}>Inclure les week-ends</Text>
                            <Switch
                                value={includeWeekends}
                                onValueChange={setIncludeWeekends}
                                trackColor={{ false: '#bdc3c7', true: '#3498db' }}
                                thumbColor={includeWeekends ? '#ffffff' : '#f4f3f4'}
                            />
                        </View>

                        {/* Couleur */}
                        <Text style={[styles.label, { marginTop: 15 }]}>Couleur au calendrier</Text>
                        <View style={styles.colorPalette}>
                            {PROJECT_COLORS.map((color) => (
                                <TouchableOpacity 
                                    key={color} 
                                    onPress={() => setSelectedColor(color)}
                                    style={[
                                        styles.colorSwatch, 
                                        { backgroundColor: color }, 
                                        selectedColor === color && styles.colorSwatchSelected
                                    ]} 
                                />
                            ))}
                        </View>

                        {/* Employés */}
                        <Text style={[styles.label, { marginTop: 15 }]}>Employés assignés ({selectedUsers.length})</Text>
                        <View style={styles.usersList}>
                            {isLoadingUsers ? (
                                <ActivityIndicator size="small" color="#2c3e50" style={{ padding: 20 }} />
                            ) : (
                                <>
                                    {users.map(user => {
                                        const isSelected = selectedUsers.includes(user.id);
                                        return (
                                            <TouchableOpacity 
                                                key={user.id} 
                                                style={[styles.userRow, isSelected && styles.userRowSelected]}
                                                onPress={() => toggleUser(user.id)}
                                            >
                                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                    {isSelected && <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>✓</Text>}
                                                </View>
                                                <Text style={[styles.userEmail, isSelected && styles.userEmailSelected]}>
                                                    {user.email || user.id}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                    {users.length === 0 && (
                                        <Text style={{ color: '#7f8c8d', fontStyle: 'italic', padding: 10 }}>Aucun employé disponible.</Text>
                                    )}
                                </>
                            )}
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Assigner</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '90%',
        maxHeight: '85%',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 20,
        textAlign: 'center'
    },
    label: {
        fontSize: 14,
        color: '#34495e',
        marginBottom: 5,
        fontWeight: '600'
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateBtn: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ecf0f1',
        alignItems: 'center'
    },
    dateBtnText: {
        color: '#2c3e50',
        fontSize: 16,
        fontWeight: '500'
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 15,
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ecf0f1',
    },
    pickerContainer: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#ecf0f1',
        borderRadius: 8,
        overflow: 'hidden' // Pour arrondir les coins du picker
    },
    usersList: {
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ecf0f1',
        padding: 10,
        maxHeight: 200, // Scroll interne si trop d'employés
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1'
    },
    userRowSelected: {
        backgroundColor: '#e8f4fd',
        borderRadius: 5,
        paddingHorizontal: 5
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#bdc3c7',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    checkboxSelected: {
        backgroundColor: '#3498db',
        borderColor: '#3498db'
    },
    userEmail: {
        fontSize: 14,
        color: '#2c3e50'
    },
    userEmailSelected: {
        fontWeight: 'bold',
        color: '#2980b9'
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20
    },
    cancelButton: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#ecf0f1',
        marginRight: 10,
        alignItems: 'center'
    },
    cancelButtonText: {
        color: '#7f8c8d',
        fontWeight: 'bold',
        fontSize: 16
    },
    saveButton: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#27ae60',
        marginLeft: 10,
        alignItems: 'center'
    },
    saveButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16
    },
    colorPalette: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10
    },
    colorSwatch: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    colorSwatchSelected: {
        borderColor: '#2c3e50'
    }
});

export default AssignProjectModal;
