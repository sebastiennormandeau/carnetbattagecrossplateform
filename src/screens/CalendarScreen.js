import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import useProjectStore from '../store/useProjectStore';
import AdminCalendar from './AdminCalendar';
import EmployeeCalendar from './EmployeeCalendar';

const CalendarScreen = ({ route }) => {
    const { userRole, isLoading, error, initializeData, cleanup } = useProjectStore();

    useEffect(() => {
        initializeData();
        return () => {
            cleanup();
        };
    }, []);

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Chargement du calendrier...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Erreur: {error}</Text>
            </View>
        );
    }

    // Affiche la vue appropriée en fonction du rôle
    return userRole === 'admin' ? <AdminCalendar route={route} /> : <EmployeeCalendar route={route} />;
};

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA'
    },
    loadingText: {
        marginTop: 10,
        color: '#4A4A4A',
        fontSize: 16
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 16,
        padding: 20,
        textAlign: 'center'
    }
});

export default CalendarScreen;
