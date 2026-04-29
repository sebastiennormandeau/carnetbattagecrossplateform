import React, { useState, useEffect, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Button, 
  Switch, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import { theme } from '../theme/Theme';

export default function PileDetailScreen({ route, navigation }) {
  const { projectId, pileId } = route.params;

  const [pile, setPile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [pileNo, setPileNo] = useState('');
  const [shape, setShape] = useState('');
  const [gauge, setGauge] = useState('');
  const [depth, setDepth] = useState('');
  const [implanted, setImplanted] = useState(false);
  const [rebattage, setRebattage] = useState(false);
  const [hasHotspot, setHasHotspot] = useState(false); // Default to false so it shows the red button on error or while loading

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Fiche pieu',
    });
  }, [navigation]);

  useEffect(() => {
    const fetchPile = async () => {
      try {
        const pileRef = doc(db, 'projects', projectId, 'piles', pileId);
        const pileSnap = await getDoc(pileRef);
        
        if (pileSnap.exists()) {
          const data = pileSnap.data();
          setPile(data);
          setPileNo(data.pileNo || data.pile_no || '');
          
          let shapeVal = data.shape || 'CIRCLE';
          if (shapeVal === 'Cercle') shapeVal = 'CIRCLE';
          if (shapeVal === 'Carre' || shapeVal === 'Carré') shapeVal = 'SQUARE';
          if (shapeVal === 'Etoile') shapeVal = 'DIAMOND';
          if (shapeVal === 'Triangle') shapeVal = 'TRIANGLE';
          if (shapeVal === 'Hexagone') shapeVal = 'HEXAGON';
          setShape(shapeVal);

          setGauge(data.gaugeIn || data.gauge_in || '');

          // Check if this pile has a hotspot
          const hotspotsRef = collection(db, 'projects', projectId, 'hotspots');
          const qNew = query(hotspotsRef, where('pileId', '==', pileId));
          const qLegacy = query(hotspotsRef, where('pileRemoteId', '==', pileId));
          const [snapNew, snapLegacy] = await Promise.all([getDocs(qNew), getDocs(qLegacy)]);
          setHasHotspot(!snapNew.empty || !snapLegacy.empty);
          
          let d = data.depthFt !== undefined ? data.depthFt : (data.depth_ft !== undefined ? data.depth_ft : 0);
          setDepth(d.toString());
          
          setImplanted(data.implanted || data.is_implanted || false);
          setRebattage(data.rebattage || data.is_rebattage || false);
        } else {
          Alert.alert("Erreur", "Ce pieu n'existe plus.");
          navigation.goBack();
        }
      } catch (error) {
        console.error("Error fetching pile:", error);
        Alert.alert("Erreur", "Impossible de charger les données du pieu.");
      } finally {
        setLoading(false);
      }
    };

    fetchPile();
  }, [projectId, pileId]);

  const performSave = async () => {
    try {
      const pileRef = doc(db, 'projects', projectId, 'piles', pileId);
      
      const parsedDepth = parseFloat(depth.replace(',', '.')) || 0;

      const updatedData = {
        pileNo: pileNo,
        shape: shape,
        gaugeIn: gauge,
        depthFt: parsedDepth,
        implanted: implanted,
        rebattage: rebattage,
        // Sauvegarde legacy pour compatibilité avec l'ancienne app Kotlin
        pile_no: pileNo,
        gauge_in: gauge,
        depth_ft: parsedDepth,
        is_implanted: implanted,
        is_rebattage: rebattage,
        updatedAt: Date.now()
      };

      await updateDoc(pileRef, updatedData);
      
      Alert.alert(
        "Succès", 
        "Les informations du pieu ont été enregistrées.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error updating pile:", error);
      Alert.alert("Erreur", "Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    
    try {
      // Check for duplicates
      if (pileNo.trim() !== '') {
          const pilesRef = collection(db, 'projects', projectId, 'piles');
          const qNum = query(pilesRef, where('pileNo', '==', pileNo.trim()));
          const qNumLegacy = query(pilesRef, where('pile_no', '==', pileNo.trim()));
          
          const [snapNew, snapLegacy] = await Promise.all([getDocs(qNum), getDocs(qNumLegacy)]);
          
          let isDuplicate = false;
          const checkDoc = (d) => {
              if (d.id !== pileId) {
                  const data = d.data();
                  let docShape = data.shape || 'CIRCLE';
                  if (docShape === 'Cercle') docShape = 'CIRCLE';
                  if (docShape === 'Carre' || docShape === 'Carré') docShape = 'SQUARE';
                  if (docShape === 'Etoile') docShape = 'DIAMOND';
                  if (docShape === 'Triangle') docShape = 'TRIANGLE';
                  if (docShape === 'Hexagone') docShape = 'HEXAGON';
                  
                  if (docShape === shape) {
                      isDuplicate = true;
                  }
              }
          };
          
          snapNew.forEach(checkDoc);
          snapLegacy.forEach(checkDoc);
          
          if (isDuplicate) {
              Alert.alert(
                  "Attention : Doublon détecté",
                  `Le numéro "${pileNo}" avec la même forme est déjà utilisé par un autre pieu dans ce projet. Voulez-vous vraiment l'enregistrer ?`,
                  [
                      { text: "Annuler", style: "cancel", onPress: () => setSaving(false) },
                      { text: "Enregistrer quand même", style: "destructive", onPress: performSave }
                  ]
              );
              return; // Exit handleSave, performSave will be called if user confirms
          }
      }
      
      await performSave();
      
    } catch (error) {
      console.error("Error checking duplicates:", error);
      Alert.alert("Erreur", "Une erreur s'est produite lors de la vérification.");
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer le pieu",
      "Êtes-vous sûr de vouloir supprimer ce pieu et son repère sur le plan ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              // Supprimer le pieu
              await deleteDoc(doc(db, 'projects', projectId, 'piles', pileId));
              
              // Rechercher et supprimer les hotspots rattachés (nouveaux et legacy)
              const hotspotsRef = collection(db, 'projects', projectId, 'hotspots');
              const qNew = query(hotspotsRef, where('pileId', '==', pileId));
              const qLegacy = query(hotspotsRef, where('pileRemoteId', '==', pileId));
              
              const [snapNew, snapLegacy] = await Promise.all([getDocs(qNew), getDocs(qLegacy)]);
              
              const deletePromises = [];
              snapNew.forEach(d => deletePromises.push(deleteDoc(d.ref)));
              snapLegacy.forEach(d => {
                  // Eviter de supprimer deux fois si pour une raison quelconque il a les deux
                  if (!deletePromises.find(p => p.id === d.id)) {
                      deletePromises.push(deleteDoc(d.ref));
                  }
              });
              await Promise.all(deletePromises);
              
              Alert.alert("Succès", "Le pieu a été supprimé.");
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting pile:", error);
              Alert.alert("Erreur", "Impossible de supprimer le pieu.");
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Common gauges from your Android app
  const gauges = [
    "4 1/2 0.250", "4 1/2 0.290", "5 1/2 0.304", "5 1/2 0.361", "5 1/2 0.415",
    "7 0.317", "7 0.362", "7 0.453", "9 5/8 0.313", "9 5/8 0.352", "9 5/8 0.395"
  ];
  
  // Shapes
  const shapes = [
    { label: "Cercle", value: "CIRCLE" },
    { label: "Carré", value: "SQUARE" },
    { label: "Triangle", value: "TRIANGLE" },
    { label: "Hexagone", value: "HEXAGON" },
    { label: "Losange", value: "DIAMOND" },
    { label: "Double Cercle", value: "CIRCLE_CIRCLE" },
    { label: "Double Triangle", value: "TRIANGLE_TRIANGLE" },
    { label: "Double Carré", value: "SQUARE_SQUARE" },
    { label: "Carré/Hexagone", value: "SQUARE_HEX" }
  ];

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        
        <Text style={styles.label}>Numéro sur plan</Text>
        <TextInput
          style={styles.input}
          value={pileNo}
          onChangeText={setPileNo}
          placeholder="Ex: 3"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={styles.label}>Forme</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={shape}
            onValueChange={(itemValue) => setShape(itemValue)}
            style={{ color: theme.colors.text }}
            dropdownIconColor={theme.colors.text}
          >
            {shapes.map((s, index) => (
              <Picker.Item key={index} label={s.label} value={s.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Calibre (pouces)</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gauge}
            onValueChange={(itemValue) => setGauge(itemValue)}
            style={{ color: theme.colors.text }}
            dropdownIconColor={theme.colors.text}
          >
            <Picker.Item label="Choisir..." value="" />
            {gauges.map((g, index) => (
              <Picker.Item key={index} label={g} value={g} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Profondeur (ft)</Text>
        <TextInput
          style={styles.input}
          value={depth}
          onChangeText={setDepth}
          placeholder="Ex: 23.5"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="numeric"
        />

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Implanté</Text>
          <Switch
            value={implanted}
            onValueChange={setImplanted}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryDark }}
            thumbColor={implanted ? theme.colors.primary : "#f4f3f4"}
          />
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Rebattage</Text>
          <Switch
            value={rebattage}
            onValueChange={setRebattage}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryDark }}
            thumbColor={rebattage ? theme.colors.primary : "#f4f3f4"}
          />
        </View>

        <View style={styles.buttonContainer}>
          {hasHotspot ? (
            <View style={{ marginBottom: 15 }}>
               <Button 
                 title="Localiser sur le plan" 
                 onPress={() => navigation.navigate('ProjectPlan', { projectId: projectId, projectName: 'Plan', highlightPiles: [pileId] })} 
                 color="#333"
               />
            </View>
          ) : (
            <View style={{ marginBottom: 15 }}>
               <Button 
                 title="Placer sur le plan (Orphelin)" 
                 onPress={() => navigation.navigate('ProjectPlan', { projectId: projectId, projectName: 'Plan', placePileId: pileId })} 
                 color={theme.colors.error}
               />
               <Text style={{color: theme.colors.error, fontSize: 12, textAlign: 'center', marginTop: 5}}>Ce pieu n'a plus de point sur le plan.</Text>
            </View>
          )}
          <Button 
            title={saving ? "Enregistrement..." : "Enregistrer"} 
            onPress={handleSave} 
            color={theme.colors.primaryDark}
            disabled={saving}
          />
          <View style={{ height: 15 }} />
          <Button 
            title="Supprimer ce pieu" 
            onPress={handleDelete} 
            color={theme.colors.error}
            disabled={saving}
          />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: theme.colors.text,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 5,
    backgroundColor: theme.colors.surface,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  switchLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  buttonContainer: {
    marginTop: 30,
    marginBottom: 40,
  }
});
