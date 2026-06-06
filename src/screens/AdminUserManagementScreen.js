import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { theme } from '../theme/Theme';
import useUserStore from '../store/useUserStore';
import CreateUserModal from '../components/CreateUserModal';
import { Ionicons } from '@expo/vector-icons';

export default function AdminUserManagementScreen() {
    const { users, fetchUsers, isLoading } = useUserStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [activeTab, setActiveTab] = useState('actifs');

    useEffect(() => {
        fetchUsers();
    }, []);

    const openCreateModal = () => {
        setSelectedUser(null);
        setModalVisible(true);
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setModalVisible(true);
    };

    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin': return 'Administrateur';
            case 'contremaitre': return 'Contremaître';
            default: return 'Employé';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Gestion des Employés</Text>
                    <Text style={styles.subtitle}>{users.length} profils trouvés</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
                    <Ionicons name="add" size={24} color="#000" />
                    <Text style={styles.addButtonText}>Nouvel Employé</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabsContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'actifs' && styles.activeTab]}
                    onPress={() => setActiveTab('actifs')}
                >
                    <Text style={[styles.tabText, activeTab === 'actifs' && styles.activeTabText]}>Actifs</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'archives' && styles.activeTab]}
                    onPress={() => setActiveTab('archives')}
                >
                    <Text style={[styles.tabText, activeTab === 'archives' && styles.activeTabText]}>Archivés</Text>
                </TouchableOpacity>
            </View>

            {isLoading && users.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <ScrollView style={styles.list}>
                    {users
                        .filter(u => activeTab === 'actifs' ? u.isActive !== false : u.isActive === false)
                        .map((user) => (
                        <TouchableOpacity key={user.id} style={[styles.card, user.isActive === false && styles.archivedCard]} onPress={() => openEditModal(user)}>
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.userName, user.isActive === false && styles.archivedText]}>{user.name || 'Sans Nom'}</Text>
                                    {user.isActive === false && (
                                        <View style={styles.archivedBadge}>
                                            <Text style={styles.archivedBadgeText}>Inactif</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.roleBadge}>{getRoleLabel(user.role)}</Text>
                            </View>
                            <Text style={styles.email}>{user.email}</Text>
                            
                            <View style={styles.infoGrid}>
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoLabel}>ID Paie Externe</Text>
                                    <Text style={styles.infoValue}>{user.employeeId || 'Non défini'}</Text>
                                </View>
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoLabel}>Métier (Trade)</Text>
                                    <Text style={styles.infoValue}>{user.trade || 'Non défini'}</Text>
                                </View>
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoLabel}>Secteur (Sector)</Text>
                                    <Text style={styles.infoValue}>{user.sector || 'Non défini'}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <CreateUserModal 
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                userToEdit={selectedUser}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        padding: 20,
        backgroundColor: theme.colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 5,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
    },
    addButtonText: {
        color: '#000',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 15,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    archivedCard: {
        opacity: 0.7,
        borderColor: '#555',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    archivedText: {
        textDecorationLine: 'line-through',
        color: '#7f8c8d',
    },
    archivedBadge: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 10,
    },
    archivedBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    roleBadge: {
        backgroundColor: theme.colors.primaryDark,
        color: 'white',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 'bold',
        overflow: 'hidden',
    },
    email: {
        color: theme.colors.textMuted,
        marginBottom: 15,
    },
    infoGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingTop: 10,
    },
    infoBox: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 13,
        color: theme.colors.text,
        fontWeight: '500',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 15,
        marginBottom: 5,
    },
    tab: {
        marginRight: 20,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: theme.colors.primary,
    },
    tabText: {
        fontSize: 16,
        color: theme.colors.textMuted,
        fontWeight: '600',
    },
    activeTabText: {
        color: theme.colors.primary,
    }
});
