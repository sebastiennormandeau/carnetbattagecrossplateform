import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { theme } from '../theme/Theme';
import useUserStore from '../store/useUserStore';
import { setTenant, getActiveCompanyId } from '../utils/firestore-tenant';

export default function TenantSwitcher() {
    const { currentUserProfile } = useUserStore();
    const [companyIdInput, setCompanyIdInput] = useState(getActiveCompanyId() || '');

    if (!currentUserProfile || !currentUserProfile.isSuperAdmin) {
        return null; // Ne rien afficher si pas Super-Admin
    }

    const handleSwitchTenant = () => {
        if (!companyIdInput.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un ID de compagnie valide.');
            return;
        }

        setTenant(companyIdInput.trim());
        Alert.alert('Succès', `Le tenant actif est maintenant : ${companyIdInput.trim()}. Veuillez rafraîchir les données manuellement si nécessaire.`);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🛠 MODE SUPPORT TECHNIQUE (Super-Admin)</Text>
            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    value={companyIdInput}
                    onChangeText={setCompanyIdInput}
                    placeholder="Entrez le companyId du client..."
                    placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.button} onPress={handleSwitchTenant}>
                    <Text style={styles.buttonText}>Basculer</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.warning}>
                Attention: Toute action effectuée maintenant le sera pour cette compagnie.
            </Text>
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
    }
});
