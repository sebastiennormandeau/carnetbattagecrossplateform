import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { theme } from '../theme/Theme';
import useUserStore from '../store/useUserStore';
import { setTenant, getActiveCompanyId } from '../utils/firestore-tenant';

export default function TenantSwitcher() {
    const { currentUserProfile } = useUserStore();
    const [companyIdInput, setCompanyIdInput] = useState(getActiveCompanyId() || '');
    const [tenants, setTenants] = useState([]);
    const [loadingTenants, setLoadingTenants] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (currentUserProfile && currentUserProfile.isSuperAdmin) {
            setLoadingTenants(true);
            useUserStore.getState().fetchAllTenants()
                .then(setTenants)
                .catch(err => console.error(err))
                .finally(() => setLoadingTenants(false));
        }
    }, [currentUserProfile]);

    if (!currentUserProfile) {
        return (
            <View style={{ padding: 10, backgroundColor: '#f8d7da', margin: 10, borderRadius: 5 }}>
                <Text style={{ color: '#721c24' }}>Chargement du profil utilisateur...</Text>
            </View>
        );
    }

    if (!currentUserProfile.isSuperAdmin) {
        return (
            <View style={{ padding: 10, backgroundColor: '#f8d7da', margin: 10, borderRadius: 5 }}>
                <Text style={{ color: '#721c24' }}>
                    Connecté avec : {currentUserProfile.email || 'Inconnu'}{'\n'}
                    Rôle : {currentUserProfile.role || 'Aucun'} (Non Super-Admin)
                </Text>
            </View>
        );
    }

    const handleSwitchTenant = () => {
        if (!companyIdInput.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un ID de compagnie valide.');
            return;
        }

        setTenant(companyIdInput.trim());
        Alert.alert('Succès', `Le tenant actif est maintenant : ${companyIdInput.trim()}. Veuillez rafraîchir les données manuellement si nécessaire.`);
    };

    const filteredTenants = tenants.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const renderTenantItem = ({ item }) => (
        <TouchableOpacity 
            style={[styles.tenantItem, companyIdInput === item && styles.activeTenantItem]}
            onPress={() => {
                setCompanyIdInput(item);
                setModalVisible(false);
            }}
        >
            <Text style={[styles.tenantItemText, companyIdInput === item && styles.activeTenantItemText]}>{item}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🛠 MODE SUPPORT TECHNIQUE (Super-Admin)</Text>
            
            <View style={styles.clientsContainer}>
                {loadingTenants ? (
                    <ActivityIndicator size="small" color="#d84315" />
                ) : (
                    <TouchableOpacity style={styles.selectClientButton} onPress={() => setModalVisible(true)}>
                        <Text style={styles.selectClientButtonText}>Sélectionner un client parmi {tenants.length}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    value={companyIdInput}
                    onChangeText={setCompanyIdInput}
                    placeholder="Entrez le companyId manuellement..."
                    placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.button} onPress={handleSwitchTenant}>
                    <Text style={styles.buttonText}>Basculer</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.warning}>
                Attention: Toute action effectuée maintenant le sera pour cette compagnie.
            </Text>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Sélectionner un client</Text>
                        
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Rechercher un client..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />

                        <FlatList
                            data={filteredTenants}
                            keyExtractor={(item) => item}
                            renderItem={renderTenantItem}
                            style={styles.list}
                            ListEmptyComponent={<Text style={styles.emptyText}>Aucun client trouvé.</Text>}
                        />

                        <TouchableOpacity style={styles.closeModalButton} onPress={() => setModalVisible(false)}>
                            <Text style={styles.closeModalText}>Fermer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffeb3b', // Couleur très distincte (Jaune)
        padding: 10,
        margin: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#f57f17',
    },
    title: {
        fontWeight: 'bold',
        color: '#d84315',
        marginBottom: 8,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        padding: 8,
        marginRight: 8,
        color: '#333',
    },
    button: {
        backgroundColor: '#d84315',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 4,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    warning: {
        color: '#d84315',
        fontSize: 12,
        marginTop: 5,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    clientsContainer: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(216, 67, 21, 0.2)',
        alignItems: 'center',
    },
    selectClientButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d84315',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    selectClientButtonText: {
        color: '#d84315',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        width: '85%',
        height: '70%',
        borderRadius: 10,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#333',
    },
    searchInput: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    list: {
        flex: 1,
    },
    tenantItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    activeTenantItem: {
        backgroundColor: '#ffe0b2',
    },
    tenantItemText: {
        fontSize: 16,
        color: '#333',
    },
    activeTenantItemText: {
        fontWeight: 'bold',
        color: '#d84315',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#999',
        fontStyle: 'italic',
    },
    closeModalButton: {
        backgroundColor: '#d84315',
        padding: 15,
        borderRadius: 8,
        marginTop: 15,
        alignItems: 'center',
    },
    closeModalText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
