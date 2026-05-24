import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { collection, doc, writeBatch, arrayUnion, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTenantQuery } from '../utils/firestore-tenant';
import useProjectStore from '../store/useProjectStore';
import { sendPushNotification } from '../utils/pushNotifications';

const EditDailyAssignmentModal = ({ visible, onClose, eventToEdit }) => {
    const { calendarEvents, projects } = useProjectStore();
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);

    useEffect(() => {
        if (!visible || !eventToEdit) return;

        // Initialiser avec les employés déjà assignés à cet événement
        setSelectedUsers(eventToEdit.assignedUsers || []);

        const fetchUsers = async () => {
            setIsLoadingUsers(true);
            try {
                const snapshot = await getDocs(getTenantQuery('users'));
                const data = [];
                snapshot.forEach(docSnap => {
                    const user = { id: docSnap.id, ...docSnap.data() };
                    if (user.role !== 'admin') {
                        data.push(user);
                    }
                });
                setUsers(data);
            } catch (error) {
                console.error("Erreur chargement employés:", error);
            } finally {
                setIsLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [visible, eventToEdit]);

    const toggleUser = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSave = async () => {
        let hasConflict = false;
        let conflictDetails = null;

        // Trouver d'autres événements à la même date pour des projets différents
        const eventsOnDate = calendarEvents.filter(e => e.date === eventToEdit.date && e.projectId !== eventToEdit.projectId);
        
        for (const evt of eventsOnDate) {
            const conflictingUsers = selectedUsers.filter(uid => evt.assignedUsers?.includes(uid));
            if (conflictingUsers.length > 0) {
                hasConflict = true;
                const userObj = users.find(u => u.id === conflictingUsers[0]);
                const userName = userObj ? (userObj.name || userObj.email || userObj.id) : conflictingUsers[0];
                conflictDetails = { userName, dateString: eventToEdit.date };
                break;
            }
        }

        const executeSave = async () => {
            try {
                const batch = writeBatch(db);

                // 1. Mettre à jour l'événement spécifique dans calendar_events
                const eventRef = doc(db, 'calendar_events', eventToEdit.id);
                batch.update(eventRef, {
                    assignedUsers: selectedUsers
                });

                // 2. Mettre à jour le projet avec arrayUnion pour garantir que tous les assignés 
                // ont au moins l'accès global de lecture au projet.
                if (selectedUsers.length > 0) {
                    const projectRef = doc(db, 'projects', eventToEdit.projectId);
                    batch.update(projectRef, {
                        assignedUsers: arrayUnion(...selectedUsers)
                    });
                }

                // Commit the batch
                await batch.commit();

                // === NOTIFICATIONS PUSH ===
                try {
                    const originalUsers = eventToEdit.assignedUsers || [];
                    const newUsers = selectedUsers.filter(u => !originalUsers.includes(u));

                    if (newUsers.length > 0) {
                        const projectData = projects.find(p => p.id === eventToEdit.projectId);
                        const projectName = projectData?.name || eventToEdit.projectName || 'Projet inconnu';
                        const projectAddress = projectData?.address || 'contacter votre supperviseur pour l\'emplacement du projet';

                        const tokensToNotify = users
                            .filter(u => newUsers.includes(u.id) && u.pushToken)
                            .map(u => u.pushToken);

                        if (tokensToNotify.length > 0) {
                            const formattedDate = new Date(eventToEdit.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                            const title = "Nouvelle assignation !";
                            const body = `Vous avez été assigné au projet ${projectName} (${projectAddress}) pour le ${formattedDate}.`;
                            await sendPushNotification(tokensToNotify, title, body);
                        }
                    }
                } catch (notifError) {
                    console.error("Erreur notification push:", notifError);
                }
                // =========================

                onClose();
            } catch (error) {
                console.error("Erreur mise à jour de la journée:", error);
                Alert.alert("Erreur", "Impossible de mettre à jour l'assignation pour cette journée.");
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

    if (!eventToEdit) return null;

    // Formatage de la date pour affichage
    const formattedDate = new Date(eventToEdit.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalBackground}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Modifier la journée</Text>
                    <Text style={styles.modalSubtitle}>{formattedDate}</Text>
                    <Text style={styles.projectText}>{eventToEdit.projectName}</Text>

                    <Text style={[styles.label, { marginTop: 15 }]}>Employés assignés ({selectedUsers.length})</Text>
                    
                    <View style={styles.usersList}>
                        {isLoadingUsers ? (
                            <ActivityIndicator size="small" color="#2c3e50" style={{ padding: 20 }} />
                        ) : (
                            <FlatList 
                                data={users}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item: user }) => {
                                    const isSelected = selectedUsers.includes(user.id);
                                    return (
                                        <TouchableOpacity 
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
                                    );
                                }}
                                style={{ maxHeight: 300 }}
                            />
                        )}
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Enregistrer</Text>
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        maxHeight: '80%'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5,
        textAlign: 'center'
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#e67e22',
        fontWeight: 'bold',
        textAlign: 'center',
        textTransform: 'capitalize'
    },
    projectText: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 10
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#34495e',
        marginBottom: 8
    },
    usersList: {
        borderWidth: 1,
        borderColor: '#ecf0f1',
        borderRadius: 8,
        minHeight: 100,
        maxHeight: 300,
        marginBottom: 20
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1'
    },
    userRowSelected: {
        backgroundColor: '#f0f8ff'
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#bdc3c7',
        borderRadius: 4,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    checkboxSelected: {
        backgroundColor: '#2ecc71',
        borderColor: '#2ecc71'
    },
    userEmail: {
        fontSize: 14,
        color: '#2c3e50'
    },
    userEmailSelected: {
        fontWeight: 'bold',
        color: '#2980b9'
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
    },
    button: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center'
    },
    cancelButton: {
        backgroundColor: '#f1f2f6',
        marginRight: 10
    },
    saveButton: {
        backgroundColor: '#2ecc71',
        marginLeft: 10
    },
    cancelButtonText: {
        color: '#7f8c8d',
        fontWeight: 'bold'
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold'
    }
});

export default EditDailyAssignmentModal;
