import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Calendar, CalendarProvider, WeekCalendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import useProjectStore from '../store/useProjectStore';

const getLocalDateString = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const EmployeeCalendar = () => {
    const { calendarEvents, projects } = useProjectStore();
    const navigation = useNavigation();
    
    const { width } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && width > 800;

    const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));
    const [viewMode, setViewMode] = useState('week'); // 'month' ou 'week'

    const changeWeek = (direction) => {
        const currentDate = new Date(selectedDate);
        currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        setSelectedDate(currentDate.toISOString().split('T')[0]);
    };

    // Marquer les jours qui ont des événements assignés à l'employé
    const markedDates = useMemo(() => {
        const marks = {};
        calendarEvents.forEach(event => {
            if (!marks[event.date]) {
                marks[event.date] = { periods: [] };
            }
            const hasProjectPeriod = marks[event.date].periods.some(p => p.key === event.projectId);
            if (!hasProjectPeriod) {
                marks[event.date].periods.push({ 
                    key: event.projectId, 
                    color: event.colorCode || '#3498db',
                    startingDay: true,
                    endingDay: true
                });
            }
        });
        
        // Ajouter la sélection courante
        if (!marks[selectedDate]) {
            marks[selectedDate] = { selected: true, selectedColor: '#3498db', periods: [] };
        } else {
            marks[selectedDate].selected = true;
            marks[selectedDate].selectedColor = '#3498db';
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
            
            <View style={styles.toggleContainer}>
                <TouchableOpacity 
                    style={[styles.toggleButton, viewMode === 'week' && styles.activeToggle]} 
                    onPress={() => setViewMode('week')}
                >
                    <Text style={[styles.toggleText, viewMode === 'week' && styles.activeToggleText]}>Semaine</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.toggleButton, viewMode === 'month' && styles.activeToggle]} 
                    onPress={() => setViewMode('month')}
                >
                    <Text style={[styles.toggleText, viewMode === 'month' && styles.activeToggleText]}>Mois</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'week' && (
                <View style={styles.weekNavigation}>
                    <TouchableOpacity onPress={() => changeWeek('prev')} style={styles.navButton}>
                        <Ionicons name="chevron-back" size={24} color="#3498db" />
                        <Text style={styles.navText}>Sem. préc.</Text>
                    </TouchableOpacity>
                    <Text style={styles.weekNavTitle}>Navigation</Text>
                    <TouchableOpacity onPress={() => changeWeek('next')} style={styles.navButton}>
                        <Text style={styles.navText}>Sem. suiv.</Text>
                        <Ionicons name="chevron-forward" size={24} color="#3498db" />
                    </TouchableOpacity>
                </View>
            )}

            {(() => {
                const CalendarContent = viewMode === 'month' ? (
                    <Calendar
                        current={selectedDate}
                        markingType={'multi-period'}
                        onDayPress={(day) => {
                            setSelectedDate(day.dateString);
                        }}
                        markedDates={markedDates}
                        firstDay={1}
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
                ) : (
                    <View style={{ height: 130, width: '100%' }}>
                        <CalendarProvider
                            date={selectedDate}
                            onDateChanged={(date) => setSelectedDate(date)}
                            showTodayButton
                        >
                            <WeekCalendar
                                firstDay={1}
                                {...(isDesktop && { calendarWidth: width / 2 })}
                                markingType={'multi-period'}
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
                                    monthTextColor: '#2c3e50',
                                }}
                            />
                        </CalendarProvider>
                    </View>
                );

                const ListContent = (
                    <View style={[styles.listContainer, isDesktop && { flex: 1, borderLeftWidth: 1, borderLeftColor: '#ecf0f1', paddingLeft: 10 }]}>
                        <Text style={styles.listHeader}>Tâches du {selectedDate}</Text>
                        <FlatList
                            data={selectedDayEvents}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.flatListContent}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>Aucune tâche pour ce jour.</Text>
                                </View>
                            }
                        />
                    </View>
                );

                return isDesktop ? (
                    <View style={{ flexDirection: 'row', flex: 1 }}>
                        <View style={{ flex: 1, maxWidth: '50%' }}>
                            {CalendarContent}
                        </View>
                        {ListContent}
                    </View>
                ) : (
                    <>
                        {CalendarContent}
                        {ListContent}
                    </>
                );
            })()}
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
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    toggleButton: {
        paddingVertical: 6,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginHorizontal: 5,
        backgroundColor: '#f1f2f6',
    },
    activeToggle: {
        backgroundColor: '#3498db',
    },
    toggleText: {
        color: '#7f8c8d',
        fontWeight: 'bold',
    },
    activeToggleText: {
        color: '#ffffff',
    },
    weekNavigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    navText: {
        color: '#3498db',
        fontWeight: 'bold',
        fontSize: 16,
    },
    weekNavTitle: {
        color: '#7f8c8d',
        fontSize: 14,
        fontWeight: 'bold',
    }
});

export default EmployeeCalendar;
