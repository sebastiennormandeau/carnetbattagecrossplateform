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
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker'; // You'll need to install this
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
          setPileNo(data.pileNo || '');
          setShape(data.shape || 'Cercle');
          setGauge(data.gaugeIn || '');
          setDepth(data.depthFt !== undefined ? data.depthFt.toString() : '0');
          setImplanted(data.implanted || false);
          setRebattage(data.rebattage || false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const pileRef = doc(db, 'projects', projectId, 'piles', pileId);
      
      const updatedData = {
        pileNo: pileNo,
        shape: shape,
        gaugeIn: gauge,
        depthFt: parseFloat(depth.replace(',', '.')) || 0,
        implanted: implanted,
        rebattage: rebattage,
        updatedAt: Date.now() // Optional: keep track of when it was modified
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
  const shapes = ["Cercle", "Carre", "Triangle", "Hexagone", "Etoile"]; // Update these to match your old enum if needed

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
              <Picker.Item key={index} label={s} value={s} />
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
          <Button 
            title={saving ? "Enregistrement..." : "Enregistrer"} 
            onPress={handleSave} 
            color={theme.colors.primaryDark}
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
