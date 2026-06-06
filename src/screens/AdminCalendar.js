import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CreateProjectModal from '../components/CreateProjectModal';
import AssignProjectModal from '../components/AssignProjectModal';
import EditDailyAssignmentModal from '../components/EditDailyAssignmentModal';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import useProjectStore from '../store/useProjectStore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTenantQuery } from '../utils/firestore-tenant';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/Theme';

// Configuration de la langue française pour le calendrier
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthNamesShort: ['Janv.','Févr.','Mars','Avril','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'],
  dayNames: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
  today: 'Aujourd\'hui'
};
LocaleConfig.defaultLocale = 'fr';

const AdminCalendar = ({ route }) => {
    const { calendarEvents, projects, deleteProject } = useProjectStore();
    const bottomSheetRef = useRef(null);
    const navigation = useNavigation();
    
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [projectToAssign, setProjectToAssign] = useState(null);
    const [eventToEdit, setEventToEdit] = useState(null);
    const [usersMap, setUsersMap] = useState({});
    const [totalEmployees, setTotalEmployees] = useState(0);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const usersSnap = await getDocs(getTenantQuery('users'));
                const map = {};
                let empCount = 0;
                usersSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    map[docSnap.id] = data.name || data.email || docSnap.id;
                    if (data.role !== 'admin') {
                        empCount++;
                    }
                });
                setUsersMap(map);
                setTotalEmployees(empCount);
            } catch (error) {
                console.error("Erreur récupération utilisateurs:", error);
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        if (route?.params?.assignProjectId) {
            setProjectToAssign(route.params.assignProjectId);
        }
    }, [route?.params?.assignProjectId]);

    // Points d'ancrage du bottom sheet
    const snapPoints = useMemo(() => ['15%', '50%'], []);

    const standbyProjects = useMemo(() => {
        return projects.filter(p => p.status === 'standby');
    }, [projects]);

    // Marquer les jours qui ont des événements
    const markedDates = useMemo(() => {
        const marks = {};
        
        calendarEvents.forEach(event => {
            if (!marks[event.date]) {
                marks[event.date] = { dots: [] };
            }
            const hasProjectDot = marks[event.date].dots.some(d => d.key === event.projectId);
            if (!hasProjectDot) {
                marks[event.date].dots.push({ 
                    key: event.projectId, 
                    color: event.colorCode || '#3498db' 
                });
            }
        });

        // Ajouter la sélection courante
        if (!marks[selectedDate]) {
            marks[selectedDate] = { selected: true, selectedColor: '#2ecc71', dots: [] };
        } else {
            marks[selectedDate].selected = true;
            marks[selectedDate].selectedColor = '#2ecc71';
        }

        return marks;
    }, [calendarEvents, selectedDate]);

    // Filtrer les événements pour le jour sélectionné
    const selectedDayEvents = useMemo(() => {
        return calendarEvents
            .filter(event => event.date === selectedDate)
            .map(event => {
                const project = projects.find(p => p.id === event.projectId) || {};
                return {
                    ...event,
                    projectName: project.name || 'Projet Inconnu',
                    address: project.address || 'Adresse non spécifiée',
                    client: project.client || ''
                };
            });
    }, [calendarEvents, projects, selectedDate]);

    // Calcul de l'utilisation du staff pour la journée sélectionnée
    const staffUtilization = useMemo(() => {
        if (totalEmployees === 0) return 0;
        
        const assignedSet = new Set();
        selectedDayEvents.forEach(evt => {
            if (evt.assignedUsers) {
                evt.assignedUsers.forEach(uid => assignedSet.add(uid));
            }
        });
        
        return Math.round((assignedSet.size / totalEmployees) * 100);
    }, [selectedDayEvents, totalEmployees]);

    const renderItem = useCallback(({ item }) => {
        return (
            <TouchableOpacity 
                style={[styles.itemContainer, { borderLeftColor: item.colorCode || '#3498db' }]}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: item.projectId || item.id })}
            >
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View style={{flex: 1}}>
                        <Text style={styles.itemTitle}>{item.projectName}</Text>
                        <Text style={styles.itemClient}>{item.client}</Text>
                        <Text style={styles.itemAddress}>{item.address}</Text>
                        <Text style={styles.itemTeam}>
                            Employés ({item.assignedUsers?.length || 0}) : {
                                item.assignedUsers?.map(uid => usersMap[uid] || uid).join(', ') || 'Aucun'
                            }
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={{padding: 10, backgroundColor: '#f1f2f6', borderRadius: 8}}
                        onPress={() => setEventToEdit(item)}
                    >
                        <Ionicons name="pencil" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    }, [navigation, usersMap]);

    const handleDelete = (projectId) => {
        Alert.alert("Supprimer le projet ?", "Cette action est irréversible et supprimera également les événements au calendrier. Continuer ?", [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: () => deleteProject(projectId) }
        ]);
    };

    const renderStandbyItem = useCallback(({ item }) => (
        <View style={styles.standbyItem}>
            <TouchableOpacity 
                style={styles.standbyInfo}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })} // Remplacer 'ProjectDetail' par le nom exact de la route
            >
                <Text style={styles.standbyTitle}>{item.name}</Text>
                <Text style={styles.standbyClient}>{item.client}</Text>
            </TouchableOpacity>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity 
                    style={styles.assignButton}
                    onPress={() => setProjectToAssign(item.id)}
                >
                    <Text style={styles.assignButtonText}>Assigner</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                >
                    <Text style={{fontSize: 18}}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </View>
    ), []);

    return (
        <GestureHandlerRootView style={styles.container}>
            {/* Dashboard Staff */}
            <View style={styles.dashboard}>
                <Text style={styles.dashboardTitle}>Dashboard Admin</Text>
                <Text style={styles.dashboardMetric}>Staff Utilisé : {staffUtilization}%</Text>
            </View>

            {/* Calendrier Mensuel Robuste */}
            <Calendar
                current={selectedDate}
                markingType={'multi-dot'}
                onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                }}
                markedDates={markedDates}
                theme={{
                    backgroundColor: '#ffffff',
                    calendarBackground: '#ffffff',
                    textSectionTitleColor: '#b6c1cd',
                    selectedDayBackgroundColor: '#2ecc71',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#2ecc71',
                    dayTextColor: '#2d4150',
                    textDisabledColor: '#d9e1e8',
                    dotColor: '#2ecc71',
                    selectedDotColor: '#ffffff',
                    arrowColor: '#2ecc71',
                    monthTextColor: '#2d4150',
                }}
            />

            {/* Liste des événements du jour */}
            <View style={styles.listContainer}>
                <Text style={styles.listHeader}>Événements du {selectedDate}</Text>
                <FlatList
                    data={selectedDayEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.flatListContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucun événement pour ce jour.</Text>
                        </View>
                    }
                />
            </View>

            {/* Panneau Stand-by */}
            <BottomSheet
                ref={bottomSheetRef}
                index={0}
                snapPoints={snapPoints}
                backgroundStyle={styles.bottomSheetBackground}
            >
                <View style={styles.bottomSheetHeader}>
                    <Text style={styles.bottomSheetTitle}>Projets en Stand-by ({standbyProjects.length})</Text>
                </View>
                <BottomSheetFlatList
                    data={standbyProjects}
                    keyExtractor={(item) => item.id}
                    renderItem={renderStandbyItem}
                    contentContainerStyle={styles.contentContainer}
                />
            </BottomSheet>

            {/* Modal d'assignation globale */}
            <AssignProjectModal 
                visible={!!projectToAssign} 
                onClose={() => setProjectToAssign(null)} 
                projectId={projectToAssign} 
            />

            {/* Modal d'édition journalière */}
            <EditDailyAssignmentModal
                visible={!!eventToEdit}
                onClose={() => setEventToEdit(null)}
                eventToEdit={eventToEdit}
            />

            {/* Modal de création */}
            <CreateProjectModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />

            {/* FAB (Floating Action Button) */}
            <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA'
    },
    dashboard: {
        padding: 15,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    dashboardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50'
    },
    dashboardMetric: {
        fontSize: 16,
        color: '#27ae60',
        fontWeight: '600'
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    listHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#7f8c8d',
        padding: 15,
        backgroundColor: '#F8F9FA',
    },
    flatListContent: {
        paddingHorizontal: 15,
        paddingBottom: 80, // Espace pour le bottom sheet
    },
    itemContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderLeftWidth: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 5
    },
    itemClient: {
        fontSize: 14,
        color: '#4A4A4A',
        marginBottom: 3
    },
    itemAddress: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 5
    },
    itemTeam: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#34495e'
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center'
    },
    emptyText: {
        color: '#bdc3c7',
        fontStyle: 'italic'
    },
    bottomSheetBackground: {
        backgroundColor: '#f1f2f6',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    bottomSheetHeader: {
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#dfe4ea'
    },
    bottomSheetTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2f3640'
    },
    contentContainer: {
        padding: 15,
    },
    standbyItem: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
    },
    standbyInfo: {
        flex: 1,
    },
    standbyTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1A1A1A'
    },
    standbyClient: {
        fontSize: 13,
        color: '#7f8c8d',
        marginTop: 2
    },
    assignButton: {
        backgroundColor: '#3498db',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
    },
    assignButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14
    },
    deleteButton: {
        marginLeft: 10,
        padding: 5
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 80, // Éviter qu'il soit caché par le bottom sheet minimisé
        backgroundColor: '#3498db',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        zIndex: 1000
    },
    fabText: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: 'bold',
        marginTop: -2
    }
});

export default AdminCalendar;
