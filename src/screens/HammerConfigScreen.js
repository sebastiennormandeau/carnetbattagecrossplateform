import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import usePilingStore from '../store/usePilingStore';
import { theme } from '../theme/Theme';

export default function HammerConfigScreen() {
    const store = usePilingStore();
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [efficiency, setEfficiency] = useState('55');
    
    const [capMaterial, setCapMaterial] = useState('UHMW');
    const [capThicknessIn, setCapThicknessIn] = useState('7');
    const [capAreaSqIn, setCapAreaSqIn] = useState('240.25');
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const materials = {
        'UHMW': 900,
        'Pruche': 650,
        'Micarta': 2700
    };

    const handleSaveHammer = async () => {
        if (!name || !weightKg || !efficiency) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        setIsSubmitting(true);
        const payload = {
            name,
            weightKg: Number(weightKg),
            defaultEfficiency: Number(efficiency),
            capMaterial,
            capThicknessIn: Number(capThicknessIn),
            capAreaSqIn: Number(capAreaSqIn),
            capModulusMPa: materials[capMaterial] || 900
        };

        try {
            if (editingId) {
                await store.updateHammer(editingId, payload);
                alert('Marteau modifié avec succès !');
            } else {
                await store.addHammer(payload);
                alert('Marteau ajouté avec succès !');
            }
            resetForm();
        } catch (error) {
            alert('Erreur lors de la sauvegarde du marteau');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (hammerId) => {
        Alert.alert(
            "Supprimer le marteau",
            "Êtes-vous sûr de vouloir supprimer définitivement ce marteau ?",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Supprimer", style: "destructive", onPress: () => store.deleteHammer(hammerId) }
            ]
        );
    };

    const handleEdit = (hammer) => {
        setEditingId(hammer.id);
        setName(hammer.name || hammer.label || '');
        setWeightKg(hammer.weightKg ? hammer.weightKg.toString() : '');
        setEfficiency(hammer.defaultEfficiency ? hammer.defaultEfficiency.toString() : '55');
        
        setCapMaterial(hammer.capMaterial || 'UHMW');
        setCapThicknessIn(hammer.capThicknessIn ? hammer.capThicknessIn.toString() : '7');
        setCapAreaSqIn(hammer.capAreaSqIn ? hammer.capAreaSqIn.toString() : '240.25');
    };

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setWeightKg('');
        setEfficiency('55');
        setCapMaterial('UHMW');
        setCapThicknessIn('7');
        setCapAreaSqIn('240.25');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            
            {/* LISTE DES MARTEAUX */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Marteaux Disponibles</Text>
                
                {store.availableHammers.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun marteau configuré dans la base de données.</Text>
                ) : (
                    store.availableHammers.map((hammer, idx) => (
                        <View key={hammer.id || idx} style={styles.hammerRow}>
                            <View style={styles.hammerInfo}>
                                <Text style={styles.hammerName}>{hammer.name || hammer.label}</Text>
                                <Text style={styles.hammerDetails}>
                                    Poids: {hammer.weightKg} kg  |  Efficacité: {hammer.defaultEfficiency || 55}%
                                </Text>
                                <Text style={styles.hammerSubDetails}>
                                    Casque: {hammer.capMaterial || 'UHMW'} ({hammer.capThicknessIn || 7}" x {hammer.capAreaSqIn || 240.25} po²)
                                </Text>
                            </View>
                            <View style={styles.hammerActions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(hammer)}>
                                    <Text style={styles.actionTextEdit}>✏️</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(hammer.id)}>
                                    <Text style={styles.actionTextDelete}>🗑️</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* FORMULAIRE D'AJOUT / EDITION */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>{editingId ? "Modifier le Marteau" : "Ajouter un Nouveau Marteau"}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nom du Marteau</Text>
                    <TextInput 
                        style={styles.highInput} 
                        placeholder="Ex: Delmag D19-42"
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#9E9E9E"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Poids du piston (kg)</Text>
                    <TextInput 
                        style={styles.highInput} 
                        keyboardType="numeric"
                        placeholder="Ex: 1820"
                        value={weightKg}
                        onChangeText={setWeightKg}
                        placeholderTextColor="#9E9E9E"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Efficacité par défaut (%)</Text>
                    <TextInput 
                        style={styles.highInput} 
                        keyboardType="numeric"
                        value={efficiency}
                        onChangeText={setEfficiency}
                        placeholderTextColor="#9E9E9E"
                    />
                </View>

                <Text style={styles.subSectionTitle}>Configuration du Casque</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Matériau du coussin</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={capMaterial}
                            onValueChange={(itemValue) => setCapMaterial(itemValue)}
                            style={[styles.picker, { color: '#000000' }]}
                            dropdownIconColor="#000000"
                            mode="dialog"
                        >
                            <Picker.Item label="Plastique UHMW (900 MPa)" value="UHMW" />
                            <Picker.Item label="Bois de Pruche (Compacté) (650 MPa)" value="Pruche" />
                            <Picker.Item label="Micarta (2700 MPa)" value="Micarta" />
                        </Picker>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, {flex: 1, marginRight: 5}]}>
                        <Text style={styles.label}>Épaisseur (po)</Text>
                        <TextInput 
                            style={styles.highInput} 
                            keyboardType="numeric"
                            value={capThicknessIn}
                            onChangeText={setCapThicknessIn}
                            placeholderTextColor="#9E9E9E"
                        />
                    </View>
                    <View style={[styles.inputGroup, {flex: 1, marginLeft: 5}]}>
                        <Text style={styles.label}>Surface (po²)</Text>
                        <TextInput 
                            style={styles.highInput} 
                            keyboardType="numeric"
                            value={capAreaSqIn}
                            onChangeText={setCapAreaSqIn}
                            placeholderTextColor="#9E9E9E"
                        />
                    </View>
                </View>

                <View style={styles.formActions}>
                    {editingId && (
                        <TouchableOpacity style={[styles.cancelButton]} onPress={resetForm} disabled={isSubmitting}>
                            <Text style={styles.cancelButtonText}>ANNULER</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                        style={[styles.addButton, editingId && {flex: 1, marginLeft: 10}, isSubmitting && styles.addButtonDisabled]} 
                        onPress={handleSaveHammer}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.addButtonText}>{editingId ? "MODIFIER" : "ENREGISTRER"}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EEEEEE'
    },
    scrollContent: {
        padding: 16
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#212121',
        marginBottom: 16,
        textTransform: 'uppercase'
    },
    subSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1976D2',
        marginTop: 10,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#BBDEFB',
        paddingBottom: 4
    },
    emptyText: {
        fontSize: 16,
        color: '#757575',
        fontStyle: 'italic'
    },
    hammerRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    hammerInfo: {
        flex: 1
    },
    hammerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#424242'
    },
    hammerDetails: {
        fontSize: 14,
        color: '#757575',
        marginTop: 4
    },
    hammerSubDetails: {
        fontSize: 12,
        color: '#9E9E9E',
        marginTop: 2
    },
    hammerActions: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    actionBtn: {
        padding: 10,
        marginLeft: 5,
        backgroundColor: '#F5F5F5',
        borderRadius: 8
    },
    actionTextEdit: {
        fontSize: 18,
    },
    actionTextDelete: {
        fontSize: 18,
    },
    inputGroup: {
        marginBottom: 20
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#424242',
        marginBottom: 8
    },
    highInput: {
        height: 60,
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 18,
        color: '#000'
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        backgroundColor: '#FAFAFA',
        overflow: 'hidden'
    },
    picker: {
        height: 60,
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
    },
    addButton: {
        height: 64,
        flex: 1,
        backgroundColor: '#1976D2',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    cancelButton: {
        height: 64,
        flex: 1,
        backgroundColor: '#9E9E9E',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addButtonDisabled: {
        backgroundColor: '#90CAF9'
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1
    }
});
