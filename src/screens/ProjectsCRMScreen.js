import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal } from 'react-native';
import useProjectStore from '../store/useProjectStore';
import { theme } from '../theme/Theme';

const STATUS_COLUMNS = [
    { id: 'soumission', title: 'À soumissionner' },
    { id: 'standby', title: 'En attente' },
    { id: 'actif', title: 'En cours' },
    { id: 'archive', title: 'Archive' }
];

export default function ProjectsCRMScreen({ navigation }) {
    const { projects, updateProjectStatus, userRole } = useProjectStore();
    const isAdmin = userRole === 'admin';
    const [selectedProject, setSelectedProject] = useState(null);
    const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);

    const getProjectsByStatus = (statusId) => {
        return projects.filter(p => p.status === statusId || (!p.status && statusId === 'standby'));
    };

    const handleStatusChange = async (newStatus) => {
        if (selectedProject) {
            await updateProjectStatus(selectedProject.id, newStatus);
            setIsStatusModalVisible(false);
            setSelectedProject(null);
        }
    };

    const renderProjectCard = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.projectName}>{item.name}</Text>
                {isAdmin && (
                    <TouchableOpacity onPress={() => { setSelectedProject(item); setIsStatusModalVisible(true); }}>
                        <Text style={styles.editStatus}>✏️</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.projectClient}>{item.client || 'Client non spécifié'}</Text>
            
            <View style={styles.cardActions}>
                {isAdmin && (
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: theme.colors.primaryDark }]}
                        onPress={() => navigation.navigate('Admin', { screen: 'Calendar', params: { assignProjectId: item.id }})} // Navigates to Admin Calendar
                    >
                        <Text style={styles.actionButtonText}>📅 Déployer</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary, borderWidth: 1 }]}
                    onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
                >
                    <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>📁 Ouvrir Carnet</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {STATUS_COLUMNS.map(column => (
                    <View key={column.id} style={styles.column}>
                        <View style={styles.columnHeader}>
                            <Text style={styles.columnTitle}>{column.title}</Text>
                            <Text style={styles.columnCount}>{getProjectsByStatus(column.id).length}</Text>
                        </View>
                        <FlatList
                            data={getProjectsByStatus(column.id)}
                            keyExtractor={item => item.id}
                            renderItem={renderProjectCard}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.columnList}
                        />
                    </View>
                ))}
            </ScrollView>

            <Modal visible={isStatusModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Modifier le statut</Text>
                        <Text style={styles.modalSubtitle}>{selectedProject?.name}</Text>
                        {STATUS_COLUMNS.map(status => (
                            <TouchableOpacity
                                key={status.id}
                                style={[styles.statusOption, selectedProject?.status === status.id && styles.statusOptionSelected]}
                                onPress={() => handleStatusChange(status.id)}
                            >
                                <Text style={[styles.statusOptionText, selectedProject?.status === status.id && styles.statusOptionTextSelected]}>
                                    {status.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.cancelButton} onPress={() => setIsStatusModalVisible(false)}>
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: 15,
    },
    column: {
        width: 300,
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        marginRight: 15,
        padding: 10,
    },
    columnHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 5,
    },
    columnTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    columnCount: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: 'bold',
        backgroundColor: 'rgba(79, 195, 247, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    columnList: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: '#2C2C2C',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    projectName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1,
        marginRight: 10,
    },
    editStatus: {
        fontSize: 16,
    },
    projectClient: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginTop: 4,
        marginBottom: 12,
    },
    cardActions: {
        flexDirection: 'column',
        gap: 8,
    },
    actionButton: {
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    actionButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: theme.colors.surface,
        width: '80%',
        borderRadius: 12,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 5,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: 20,
        textAlign: 'center',
    },
    statusOption: {
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        backgroundColor: '#2C2C2C',
    },
    statusOptionSelected: {
        backgroundColor: theme.colors.primaryDark,
    },
    statusOptionText: {
        color: theme.colors.text,
        textAlign: 'center',
        fontWeight: '600',
    },
    statusOptionTextSelected: {
        color: '#FFF',
    },
    cancelButton: {
        marginTop: 10,
        padding: 15,
    },
    cancelButtonText: {
        color: theme.colors.error,
        textAlign: 'center',
        fontWeight: 'bold',
    }
});
