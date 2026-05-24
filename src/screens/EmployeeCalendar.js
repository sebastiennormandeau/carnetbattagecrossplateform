import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import useProjectStore from '../store/useProjectStore';

const EmployeeCalendar = () => {
    const { calendarEvents, projects } = useProjectStore();
    const navigation = useNavigation();
    
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Marquer les jours qui ont des événements assignés à l'employé
    const markedDates = useMemo(() => {
        const marks = {};
        calendarEvents.forEach(event => {
            marks[event.date] = { marked: true, dotColor: '#3498db' };
        });
        // Ajouter la sélection courante
        marks[selectedDate] = { 
            ...marks[selectedDate], 
            selected: true, 
            selectedColor: '#3498db' 
        };
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

    const renderItem = useCallback(({ item }) => {
        return (
            <TouchableOpacity 
                style={[styles.itemContainer, { borderLeftColor: item.colorCode || '#3498db' }]}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: item.projectId || item.id })} // Remplacer 'ProjectDetail' par le nom exact de la route
            >
                <Text style={styles.itemTitle}>{item.projectName}</Text>
                <Text style={styles.itemAddress}>{item.address}</Text>
                <Text style={styles.itemTeam}>Équipe : {item.teamId}</Text>
            </TouchableOpacity>
        );
    }, [navigation]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mon Horaire</Text>
            </View>
            
            {/* Calendrier Mensuel Robuste */}
            <Calendar
                current={selectedDate}
                onDayPress={(day) => {
                    setSelectedDate(day.dateString);
                }}
                markedDates={markedDates}
                theme={{
                    backgroundColor: '#F8F9FA',
                    calendarBackground: '#ffffff',
                    textSectionTitleColor: '#7f8c8d',
                    selectedDayBackgroundColor: '#3498db',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#e74c3c',
                    dayTextColor: '#2c3e50',
                    textDisabledColor: '#d9e1e8',
                    dotColor: '#3498db',
                    selectedDotColor: '#ffffff',
                    arrowColor: '#3498db',
                    monthTextColor: '#2c3e50',
                }}
            />

            {/* Liste des tâches du jour */}
            <View style={styles.listContainer}>
                <Text style={styles.listHeader}>Tâches du {selectedDate}</Text>
                <FlatList
                    data={selectedDayEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.flatListContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucune tâche assignée pour ce jour.</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA'
    },
    header: {
        padding: 20,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50'
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
        paddingBottom: 20,
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
    }
});

export default EmployeeCalendar;
