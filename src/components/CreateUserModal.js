import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '../theme/Theme';
import useUserStore from '../store/useUserStore';
import { Ionicons } from '@expo/vector-icons';
import { CCQ_SECTORS, CCQ_TRADES } from '../constants/ccqData';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateUserModal({ visible, onClose, userToEdit }) {
    const { updateUserProfile, isLoading } = useUserStore();
    
    // Pour un nouvel utilisateur, il faudrait idéalement appeler une Cloud Function
    // pour le créer dans Firebase Auth. Pour cet ERP, nous allons au minimum 
    // mettre à jour ou créer son profil Firestore si on a son UID.
    // NOTE: Si userToEdit est null, cela signifie une création complète.
    // L'implémentation de création complète (Auth + Firestore) est hors portée 
    // d'une simple maj Firestore, mais on va utiliser un UID temporaire ou demander l'email.
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('employe');
    const [employeeId, setEmployeeId] = useState('');
    const [trade, setTrade] = useState(CCQ_TRADES[0]);
    const [sector, setSector] = useState(CCQ_SECTORS[0]);
    const [isActive, setIsActive] = useState(true);
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name || '');
            setEmail(userToEdit.email || '');
            setRole(userToEdit.role || 'employe');
            setEmployeeId(userToEdit.employeeId || '');
            setTrade(userToEdit.trade || CCQ_TRADES[0]);
            setSector(userToEdit.sector || CCQ_SECTORS[0]);
            setIsActive(userToEdit.isActive !== false);
        } else {
            setName('');
            setEmail('');
            setRole('employe');
            setEmployeeId('');
            setTrade(CCQ_TRADES[0]);
            setSector(CCQ_SECTORS[0]);
            setIsActive(true);
            setPassword('');
        }
    }, [userToEdit, visible]);

    const handleSave = async () => {
        if (!name || !email) {
            Alert.alert("Erreur", "Le nom et le courriel sont obligatoires.");
            return;
        }
        
        if (!userToEdit && password.length < 6) {
            Alert.alert("Erreur", "Un mot de passe d'au moins 6 caractères est requis pour un nouvel employé.");
            return;
        }

        try {
            if (userToEdit) {
                // Mise à jour d'un utilisateur existant
                await updateUserProfile(userToEdit.id, {
                    name,
                    email,
                    role,
                    employeeId,
                    trade,
                    sector,
                    isActive
                });
                Alert.alert("Succès", "Profil mis à jour.");
            } else {
                // Création d'un nouvel utilisateur avec authentification
                const { createUserProfile } = useUserStore.getState();
                await createUserProfile({
                    name,
                    email,
                    role,
                    employeeId,
                    trade,
                    sector,
                    isActive
                }, password);
                Alert.alert("Succès", "Nouvel employé créé et authentifié.");
            }
            
            onClose();
        } catch (error) {
            Alert.alert("Erreur", "Impossible de sauvegarder le profil : " + error.message);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>{userToEdit ? 'Modifier le profil' : 'Nouvel Employé'}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.label}>Nom complet *</Text>
                    <TextInput 
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Ex: Jean Tremblay"
                        placeholderTextColor="#7f8c8d"
                    />

                    <Text style={styles.label}>Courriel *</Text>
                    <TextInput 
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Ex: jean@entreprise.com"
                        placeholderTextColor="#7f8c8d"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!userToEdit} // Ne pas changer l'email facilement
                    />

                    {!userToEdit && (
                        <>
                            <Text style={styles.label}>Mot de passe temporaire *</Text>
                            <TextInput 
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Au moins 6 caractères"
                                placeholderTextColor="#7f8c8d"
                                secureTextEntry
                            />
                        </>
                    )}

                    <Text style={styles.label}>Rôle</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={role}
                            onValueChange={(val) => setRole(val)}
                            style={styles.picker}
                            dropdownIconColor="white"
                        >
                            <Picker.Item label="Employé" value="employe" color="white" />
                            <Picker.Item label="Contremaître" value="contremaitre" color="white" />
                            <Picker.Item label="Administrateur" value="admin" color="white" />
                        </Picker>
                    </View>

                    <Text style={styles.label}>ID Paie Externe</Text>
                    <TextInput 
                        style={styles.input}
                        value={employeeId}
                        onChangeText={setEmployeeId}
                        placeholder="Ex: 00145"
                        placeholderTextColor="#7f8c8d"
                    />

                    <View style={styles.sectionDivider} />
                    <Text style={styles.sectionTitle}>Paramètres CCQ par défaut</Text>

                    <Text style={styles.label}>Métier (Trade)</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={trade}
                            onValueChange={(val) => setTrade(val)}
                            style={styles.picker}
                            dropdownIconColor="white"
                        >
                            {CCQ_TRADES.map(t => (
                                <Picker.Item key={t} label={t} value={t} color="white" />
                            ))}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Secteur (Sector)</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={sector}
                            onValueChange={(val) => setSector(val)}
                            style={styles.picker}
                            dropdownIconColor="white"
                        >
                            {CCQ_SECTORS.map(s => (
                                <Picker.Item key={s} label={s} value={s} color="white" />
                            ))}
                        </Picker>
                    </View>

                    <TouchableOpacity 
                        style={[styles.saveButton, isLoading && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Sauvegarder</Text>}
                    </TouchableOpacity>

                    {userToEdit && (
                        <TouchableOpacity 
                            style={[styles.archiveButton, !isActive && styles.restoreButton]}
                            onPress={() => setIsActive(!isActive)}
                        >
                            <Ionicons name={isActive ? "archive-outline" : "refresh-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>
                                {isActive ? "Archiver l'employé" : "Réactiver l'employé"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 20,
    },
    sectionTitle: {
        color: theme.colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    label: {
        color: theme.colors.textMuted,
        marginBottom: 8,
        fontSize: 14,
    },
    input: {
        backgroundColor: theme.colors.surface,
        color: 'white',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 16,
    },
    pickerContainer: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        marginBottom: 20,
        overflow: 'hidden',
    },
    picker: {
        color: 'white',
        height: 50,
    },
    saveButton: {
        backgroundColor: theme.colors.primary,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    archiveButton: {
        backgroundColor: '#e74c3c',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 40,
    },
    restoreButton: {
        backgroundColor: '#2ecc71',
    }
});
