import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { auth, db, storage } from '../config/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/Theme';

export default function ProjectDocsScreen({ route, navigation }) {
    const { projectId, projectName } = route.params;
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        navigation.setOptions({ title: "Documents: " + (projectName || '') });
        
        const docsRef = collection(db, 'projects', projectId, 'docs');
        const unsub = onSnapshot(docsRef, async (snapshot) => {
            let temp = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            temp.sort((a,b) => b.addedAt - a.addedAt);
            setDocs(temp);
            setLoading(false);

            // Fetch URLs asynchronoulsy
            temp.forEach(async (docItem) => {
                if (!docItem.url && docItem.storagePath) {
                    try {
                        const url = await getDownloadURL(ref(storage, docItem.storagePath));
                        setDocs(prev => {
                            const next = [...prev];
                            const idx = next.findIndex(d => d.id === docItem.id);
                            if (idx !== -1) {
                                next[idx] = { ...next[idx], url };
                            }
                            return next;
                        });
                    } catch(e) {
                        console.error("Erreur getDownloadURL:", e.code, e.message);
                        setDocs(prev => {
                            const next = [...prev];
                            const idx = next.findIndex(d => d.id === docItem.id);
                            if (idx !== -1) {
                                next[idx] = { ...next[idx], urlError: e.message || 'Erreur réseau/CORS' };
                            }
                            return next;
                        });
                    }
                }
            });
        }, (error) => {
            console.error("Erreur Firestore onSnapshot (docs):", error);
            Alert.alert("Erreur", "Impossible de charger les documents.");
            setLoading(false);
        });
        return () => unsub();
    }, [projectId, projectName]);

    const handleAddDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });
            if (result.canceled) return;
            
            const file = result.assets[0];
            setUploading(true);
            
            const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            // On utilise "documents" pour matcher EXACTEMENT votre règle Firebase :
            // match /projects/{projectId}/documents/{allPaths=**}
            const storagePath = `projects/${projectId}/documents/${Date.now()}_${safeName}`;
            
            // Standard fetch upload with blob
            const response = await fetch(file.uri);
            const blob = await response.blob();
            await uploadBytes(ref(storage, storagePath), blob);
            
            await addDoc(collection(db, 'projects', projectId, 'docs'), {
                name: file.name,
                mimeType: file.mimeType || 'application/pdf',
                size: file.size || 0,
                storagePath: storagePath,
                addedAt: Date.now()
            });
            
            setUploading(false);
            Alert.alert("Succès", "Document ajouté !");
        } catch(e) {
            setUploading(false);
            console.error(e);
            Alert.alert("Erreur", "L'upload a échoué: " + e.message);
        }
    };

    const handleOpenDocument = async (docItem) => {
        if (!docItem.url) {
            Alert.alert("Erreur", "Lien de téléchargement introuvable.");
            return;
        }
        if (Platform.OS === 'web') {
            try {
                const link = document.createElement('a');
                link.href = docItem.url;
                link.target = '_blank';
                link.download = docItem.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (e) {
                window.open(docItem.url, '_blank');
            }
            return;
        }

        try {
            Alert.alert("Téléchargement", "Ouverture du document en cours...");
            const safeName = docItem.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const targetFile = new File(Paths.cache, safeName);
            
            const downloadedFile = await File.downloadFileAsync(docItem.url, targetFile);
            console.log("Fichier téléchargé :", downloadedFile.uri);
            
            if (Platform.OS === 'android') {
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: downloadedFile.contentUri || downloadedFile.uri,
                    flags: 1,
                    type: docItem.mimeType || 'application/pdf'
                });
            } else {
                await Sharing.shareAsync(downloadedFile.uri, { mimeType: docItem.mimeType || 'application/pdf' });
            }
        } catch(e) {
            console.error("Open Doc Error", e);
            Alert.alert("Erreur", "Impossible d'ouvrir ce document.\n" + e.message);
        }
    };

    const handleDeleteDocument = (docItem) => {
        Alert.alert("Suppression", `Voulez-vous supprimer le document "${docItem.name}" ?`, [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: async () => {
                try {
                    await deleteDoc(doc(db, 'projects', projectId, 'docs', docItem.id));
                    await deleteObject(ref(storage, docItem.storagePath));
                } catch(e) {
                    Alert.alert("Erreur", "Échec de la suppression.");
                }
            }}
        ]);
    };

    const renderItem = ({ item }) => {
        const isPdf = item.mimeType?.includes('pdf') || item.name.toLowerCase().endsWith('.pdf');
        const iconName = item.urlError ? 'warning' : (isPdf ? 'document-text' : 'image');
        const iconColor = item.urlError ? '#ff4444' : (isPdf ? '#d32f2f' : '#7b1fa2');
        const sizeMb = (item.size / (1024 * 1024)).toFixed(2);

        return (
            <TouchableOpacity style={styles.card} onPress={() => handleOpenDocument(item)}>
                <View style={[styles.iconBox, {backgroundColor: iconColor + '20'}]}>
                    <Ionicons name={iconName} size={32} color={iconColor} />
                </View>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cardSub}>Ajouté le: {new Date(item.addedAt).toLocaleDateString()} • {sizeMb} MB</Text>
                    {item.urlError && (
                        <TouchableOpacity onPress={() => {
                            if (Platform.OS === 'web') {
                                window.alert("Erreur:\n" + item.urlError);
                            } else {
                                Alert.alert("Erreur", item.urlError);
                            }
                        }}>
                            <Text style={{color: '#ff4444', fontSize: 12, marginTop: 5, fontWeight: 'bold'}}>⚠️ Voir l'erreur</Text>
                        </TouchableOpacity>
                    )}
                    {!item.url && !item.urlError && <Text style={{color: theme.colors.primary, fontSize: 10, marginTop: 2}}>Chargement du lien...</Text>}
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteDocument(item)}>
                    <Ionicons name="trash-outline" size={24} color="#d32f2f" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            {uploading && (
                <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="white" />
                    <Text style={styles.uploadingText}>Téléversement en cours...</Text>
                </View>
            )}
            
            <FlatList
                data={docs}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{padding: 15, paddingBottom: 100}}
                ListEmptyComponent={<Text style={styles.noDataText}>Aucun document technique attaché.</Text>}
            />
            
            <TouchableOpacity style={styles.fab} onPress={handleAddDocument}>
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 15, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.1, shadowRadius: 4 },
    iconBox: { width: 50, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
    cardSub: { fontSize: 12, color: '#666' },
    deleteBtn: { padding: 10 },
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.3, shadowRadius: 4 },
    noDataText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666', fontStyle: 'italic' },
    uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
    uploadingText: { color: 'white', marginTop: 15, fontSize: 16, fontWeight: 'bold' }
});
