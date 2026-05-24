import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import useProjectStore from '../store/useProjectStore';

const CreateProjectModal = ({ visible, onClose }) => {
    const { createProject } = useProjectStore();
    
    const [projectNumber, setProjectNumber] = useState('');
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [client, setClient] = useState('');
    
    const handleCreate = async () => {
        if (!projectNumber.trim()) {
            Alert.alert("Erreur", "Le numéro de projet est obligatoire.");
            return;
        }

        try {
            await createProject({
                projectNumber: projectNumber.trim(),
                name: name.trim() || 'Sans nom',
                address: address.trim() || 'Adresse non spécifiée',
                client: client.trim() || 'Client non spécifié'
            });
            // Réinitialiser les champs et fermer
            setProjectNumber('');
            setName('');
            setAddress('');
            setClient('');
            onClose();
        } catch (error) {
            Alert.alert("Erreur", "Une erreur est survenue lors de la création.");
        }
    };

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalBackground}
            >
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Nouveau Projet</Text>

                    <Text style={styles.label}>Numéro de Projet *</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: PROJ-2026-001" 
                        placeholderTextColor="#95a5a6"
                        value={projectNumber}
                        onChangeText={setProjectNumber}
                    />

                    <Text style={styles.label}>Nom du Projet</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: Fondation Tour XYZ" 
                        placeholderTextColor="#95a5a6"
                        value={name}
                        onChangeText={setName}
                    />

                    <Text style={styles.label}>Adresse</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: 123 Rue Principale" 
                        placeholderTextColor="#95a5a6"
                        value={address}
                        onChangeText={setAddress}
                    />

                    <Text style={styles.label}>Client</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Ex: Construction ABC" 
                        placeholderTextColor="#95a5a6"
                        value={client}
                        onChangeText={setClient}
                    />

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
                            <Text style={styles.createButtonText}>Créer le projet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
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
    input: {
        backgroundColor: '#F8F9FA',
        borderWidth: 1,
        borderColor: '#ecf0f1',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#2c3e50',
        marginBottom: 15
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
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
    createButton: {
        flex: 1,
        padding: 15,
        borderRadius: 8,
        backgroundColor: '#3498db',
        marginLeft: 10,
        alignItems: 'center'
    },
    createButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16
    }
});

export default CreateProjectModal;
