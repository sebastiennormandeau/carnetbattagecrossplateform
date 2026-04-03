import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Alert, Image } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as ImageManipulator from 'expo-image-manipulator';
import { db, storage } from '../config/firebase';
import { doc, onSnapshot, collection, query, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { theme } from '../theme/Theme';
import { FONDABEC_LOGO_BASE64 } from '../config/fondabecLogoBase64';
import { Ionicons } from '@expo/vector-icons';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;

  const [project, setProject] = useState(null);
  const [piles, setPiles] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [projectNameInput, setProjectNameInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [expectedDepthInput, setExpectedDepthInput] = useState('0.0');
  const [collapsedShapes, setCollapsedShapes] = useState({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDepth, setIsEditingDepth] = useState(false);

  // Set the title dynamically based on the project name passed
  useLayoutEffect(() => {
    navigation.setOptions({
      title: projectName || `Projet #${projectId}`,
    });
  }, [navigation, projectName, projectId]);

  useEffect(() => {
    // 1. Listen to the Project document
    const projectRef = doc(db, 'projects', projectId);
    const unsubProject = onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProject({ id: docSnap.id, ...data });
        setProjectNameInput(data.name || '');
        setLocationInput(data.location || '');
        setExpectedDepthInput(data.expectedDepth ? data.expectedDepth.toString() : '0.0');
      }
    });

    // 2. Listen to the Piles subcollection
    const pilesRef = collection(db, 'projects', projectId, 'piles');
    const q = query(pilesRef);
    const unsubPiles = onSnapshot(q, (snapshot) => {
      const pilesData = [];
      snapshot.forEach(doc => {
        pilesData.push({ id: doc.id, ...doc.data() });
      });
      setPiles(pilesData);
      setLoading(false);
    });

    // 3. Listen to Photos
    const photosRef = collection(db, 'projects', projectId, 'photos');
    const unsubPhotos = onSnapshot(photosRef, async (snapshot) => {
      const photosData = [];
      for (const d of snapshot.docs) {
         const pData = d.data();
         let url = null;
         try {
            url = await getDownloadURL(ref(storage, pData.storagePath));
         } catch(e){}
         photosData.push({ id: d.id, ...pData, url });
      }
      setPhotos(photosData);
    });

    return () => {
      unsubProject();
      unsubPiles();
      unsubPhotos();
    };
  }, [projectId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Calculate stats
  const total = piles.length;
  const implantedCount = piles.filter(p => p.implanted).length;
  const validDepthPiles = piles.filter(p => p.depthFt > 0);
  const avgDepth = validDepthPiles.length > 0 
    ? validDepthPiles.reduce((acc, p) => acc + p.depthFt, 0) / validDepthPiles.length 
    : 0;
  const avgDepthRounded = Math.round(avgDepth * 10) / 10;

  // Group piles by shape
  const groupedPiles = piles.reduce((acc, pile) => {
    const shape = pile.shape || "Non définie";
    if (!acc[shape]) acc[shape] = [];
    acc[shape].push(pile);
    return acc;
  }, {});

  const toggleShape = (shape) => {
    setCollapsedShapes(pre => ({ ...pre, [shape]: pre[shape] === undefined ? false : !pre[shape] }));
  };

  const handleAddPhoto = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      try {
         Alert.alert("Patientez", "Optimisation et téléversement...");
         const uri = result.assets[0].uri;
         
         const manipResult = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1024 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
         );

         const filename = manipResult.uri.substring(manipResult.uri.lastIndexOf('/') + 1);
         const storagePath = `projects/${projectId}/photos/${Date.now()}_${filename}`;
         
         const response = await fetch(manipResult.uri);
         const blob = await response.blob();
         await uploadBytes(ref(storage, storagePath), blob);
         
         await addDoc(collection(db, 'projects', projectId, 'photos'), {
            storagePath: storagePath,
            includeInReport: true,
            addedAt: Date.now()
         });
         Alert.alert("Succès", "Photo ajoutée optimisée !");
      } catch (e) {
         Alert.alert("Erreur", "L'envoi a échoué : " + e.message);
      }
    }
  };

  const togglePhotoInclude = async (photoId, currentStatus) => {
     try {
        await updateDoc(doc(db, 'projects', projectId, 'photos', photoId), {
           includeInReport: currentStatus === false ? true : false
        });
     } catch(e) {}
  };

  const getShapeSvg = (shape, pileNo) => {
    const noStr = pileNo ? String(pileNo) : '';
    const shortNo = noStr.includes('-') ? noStr.split('-').pop() : noStr;
    const noText = shortNo || '';
    let svg = `<svg width="80" height="24" viewBox="0 0 80 24" style="vertical-align: middle;">
      <text x="35" y="16" font-size="11" font-weight="bold" fill="black">${noText}</text>`;
    
    const draw = (content) => svg + `<g transform="translate(15, 12)">${content}</g></svg>`;
    
    switch(shape) {
      case 'CIRCLE': return draw(`<circle cx="0" cy="0" r="7" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'SQUARE': return draw(`<rect x="-7" y="-7" width="14" height="14" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'DIAMOND': return draw(`<polygon points="0,-9 9,0 0,9 -9,0" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'TRIANGLE': return draw(`<polygon points="0,-8 8,6 -8,6" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'HEXAGON': return draw(`<polygon points="0,-8 7,-3.5 7,3.5 0,8 -7,3.5 -7,-3.5" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'SQUARE_HEX': return draw(`<rect x="-8" y="-8" width="16" height="16" stroke="black" stroke-width="1.5" fill="none" /><polygon points="0,-5 4.5,-2.5 4.5,2.5 0,5 -4.5,2.5 -4.5,-2.5" stroke="black" stroke-width="1" fill="none" />`);
      case 'CIRCLE_HEX': return draw(`<circle cx="0" cy="0" r="8" stroke="black" stroke-width="1.5" fill="none" /><polygon points="0,-5 4.5,-2.5 4.5,2.5 0,5 -4.5,2.5 -4.5,-2.5" stroke="black" stroke-width="1" fill="none" />`);
      case 'SQUARE_SQUARE': return draw(`<rect x="-8" y="-8" width="16" height="16" stroke="black" stroke-width="1.5" fill="none" /><rect x="-4" y="-4" width="8" height="8" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'CIRCLE_CIRCLE': return draw(`<circle cx="0" cy="0" r="8" stroke="black" stroke-width="1.5" fill="none" /><circle cx="0" cy="0" r="4.5" stroke="black" stroke-width="1.5" fill="none" />`);
      case 'TRIANGLE_TRIANGLE': return draw(`<polygon points="0,-9 9,7 -9,7" stroke="black" stroke-width="1.5" fill="none" /><polygon points="0,-3.5 4,4 -4,4" stroke="black" stroke-width="1.5" fill="none" />`);
      default: return `<span style="font-size: 11px; margin-left: 20px;">(auto) &nbsp;&nbsp; ${noText}</span>`;
    }
  };

  const handleExportPDF = async () => {
    try {
      Alert.alert("Génération", "Préparation du PDF...");

      const dateStr = new Date().toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
      
      const expectedD = parseFloat(expectedDepthInput) || 0.0;
      const totalDiff = validDepthPiles.reduce((acc, p) => acc + (p.depthFt - expectedD), 0);
      const totalDiffStr = totalDiff === 0 ? '—' : (totalDiff > 0 ? '+' : '') + totalDiff.toFixed(1);

      const pilesHtml = piles.map(p => {
         const diff = p.depthFt > 0 ? (p.depthFt - expectedD) : 0;
         const diffStr = diff === 0 ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(2);
         return `
          <tr>
            <td>${getShapeSvg(p.shape, p.pileNo)}</td>
            <td>${p.gaugeIn || '—'}</td>
            <td>${p.depthFt === 0 ? '—' : p.depthFt.toFixed(2)}</td>
            <td>${expectedD.toFixed(2)}</td>
            <td>${diffStr}</td>
            <td>${p.implanted ? 'Implanté' : 'Non implanté'}</td>
            <td>${p.rebattage ? 'Oui' : 'Non'}</td>
          </tr>
         `;
      }).join('');

      const selectedPhotos = photos.filter(p => p.includeInReport !== false);
      const photoHtmlPromises = selectedPhotos.map(async (p) => {
         try {
           if (!p.url) return '';
           const tempFile = FileSystem.cacheDirectory + p.id + '_raw.jpg';
           const downloadObj = await FileSystem.downloadAsync(p.url, tempFile);
           
           const manipResult = await ImageManipulator.manipulateAsync(
              downloadObj.uri,
              [{ resize: { width: 800 } }],
              { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
           );
           
           const b64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: FileSystem.EncodingType.Base64 });
           return `
            <div class="photo-container">
              <img src="data:image/jpeg;base64,${b64}" class="photo-img" />
            </div>`;
         } catch(e) { 
           console.warn("Error embedding image:", p.id, e);
           return ''; 
         }
      });
      const generatedPhotosHtmlArray = await Promise.all(photoHtmlPromises);
      const photosHtml = generatedPhotosHtmlArray.join('');

      const photosSection = photosHtml ? `
         <h2 class="photos-title">Photos du Chantier</h2>
         ${photosHtml}
      ` : '';

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 10px 30px; color: #333; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px; }
              .logo { width: 180px; }
              .title-box { display: flex; flex-direction: column; flex: 1; margin-left: 20px; margin-top: 5px; }
              .title { color: #003366; font-size: 24px; font-weight: bold; margin: 0; }
              .subtitle { font-size: 14px; color: #333; margin-top: 8px; }
              .date { font-size: 12px; color: #333; margin-top: 8px; }
              hr { border: 0; border-top: 1px solid #999; margin-top: 30px; margin-bottom: 30px; }
              
              h2 { color: #003366; font-size: 20px; margin-top: 10px; margin-bottom: 20px; }
              .summary { font-size: 12px; line-height: 1.5; color: #333; margin-bottom: 40px; }
              
              table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 30px; }
              th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: left; }
              th { background-color: #003366; color: white; font-weight: bold; }
              td { color: black; font-weight: 500; }
              
              .photos-title { page-break-before: always; margin-top: 40px; }
              .photo-container { text-align: left; margin-bottom: 20px; width: 100%; }
              .photo-img { width: 100%; max-height: 800px; object-fit: contain; }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${FONDABEC_LOGO_BASE64}" class="logo" />
              <div class="title-box">
                <p class="title">Rapport de Battage de Pieux</p>
                <p class="subtitle">${project?.name || 'Projet à déterminer'}</p>
              </div>
              <div class="date">${dateStr}</div>
            </div>
            
            <hr />
            
            <h2>Détails du Projet</h2>
            <div class="summary">
              Ville: ${project?.location || 'N/A'}<br/>
              Nombre de pieux: ${total} (dont ${implantedCount} implantés)<br/>
              Profondeur moyenne: ${avgDepthRounded} ft (sur ${validDepthPiles.length} pieux)<br/>
              Profondeur prévue: ${expectedD.toFixed(1)} ft<br/>
              Différentiel total: ${totalDiffStr} ft<br/>
            </div>
            
            <h2>Liste des Pieux</h2>
            <table>
              <tr>
                <th style="width: 140px;">FORME PIEU N°</th>
                <th>CALIBRE (IN)</th>
                <th>PROF. ACTU. (FT)</th>
                <th>PROF. PRÉVUE</th>
                <th>DIFFÉR. (FT)</th>
                <th>STATUT</th>
                <th>REBATTAGE</th>
              </tr>
              ${pilesHtml}
            </table>
            
            ${photosSection}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      
      const safeName = (project?.name || 'Projet').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 50);
      const stamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
      const newPath = FileSystem.cacheDirectory + `Rapport_${safeName}_${stamp}.pdf`;
      
      await FileSystem.moveAsync({ from: uri, to: newPath });
      
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
         await MailComposer.composeAsync({
            subject: `Rapport de projet: ${project?.name ? project.name.trim() : 'Projet'}`,
            body: "Veuillez trouver ci-joint le rapport de projet au format PDF.",
            attachments: [newPath]
         });
      } else {
         await Sharing.shareAsync(newPath, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Partager le rapport' });
      }
    } catch(e) {
      console.error("PDF Export Crash:", e);
      Alert.alert("Erreur Système", "L'opération a échoué.\nDétails: " + e.message);
    }
  };

  const handleSaveProject = async () => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        name: projectNameInput.trim(),
        location: locationInput.trim(),
        expectedDepth: parseFloat(expectedDepthInput) || 0.0
      });
      Alert.alert("Enregistré", "Le projet a été mis à jour.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sauvegarder : " + e.message);
    }
  };

  const handleGpsLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erreur", "Permission GPS refusée.");
      return;
    }
    try {
      Alert.alert("Localisation", "Recherche de la position en cours...");
      const loc = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      if (geo && geo.length > 0) {
        const addr = `${geo[0].streetNumber || ''} ${geo[0].street || ''}, ${geo[0].city || ''}`.trim();
        setLocationInput(addr);
        await updateDoc(doc(db, 'projects', projectId), {
          location: addr,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }
    } catch (e) {
      Alert.alert("Erreur GPS", "Impossible de vous localiser.");
    }
  };

  const handleDeleteProject = () => {
    Alert.alert("Suppression", "Voulez-vous vraiment supprimer ce projet ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try {
          await deleteDoc(doc(db, 'projects', projectId));
          navigation.goBack();
        } catch(e) {}
      }}
    ]);
  };

  const renderPileList = () => {
    if (Object.keys(groupedPiles).length === 0) {
      return <Text style={styles.noDataText}>Aucun pieu pour le moment.</Text>;
    }

    return Object.entries(groupedPiles).map(([shape, shapePiles]) => {
      const isCollapsed = collapsedShapes[shape] !== false; // collapsed by default
      return (
      <View key={shape} style={styles.shapeSection}>
        <TouchableOpacity style={styles.shapeHeader} onPress={() => toggleShape(shape)}>
            <Text style={styles.shapeTitle}>Forme: {shape}</Text>
            <Text style={{color: theme.colors.primary, fontWeight: 'bold'}}>{isCollapsed ? '▼' : '▲'}</Text>
        </TouchableOpacity>
        
        {!isCollapsed && shapePiles.map(pile => (
          <TouchableOpacity 
            key={pile.id} 
            style={styles.pileCard}
            onPress={() => navigation.navigate('PileDetail', { 
              projectId: projectId, 
              pileId: pile.id 
            })}
          >
            <View>
              <Text style={styles.pileName}>{pile.pileNo || "Pieu"}</Text>
              <Text style={styles.pileSub}>
                Calibre: {pile.gaugeIn || "-"} in | Prof.: {pile.depthFt} ft | {pile.implanted ? "Implanté" : "Non implanté"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    )});
  };


  return (
    <ScrollView style={styles.container}>
      
      {/* Project Header */}
      <View style={{paddingVertical: 15, paddingHorizontal: 20}}>
         <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {isEditingName ? (
               <View style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
                  <TextInput 
                     style={{flex: 1, borderBottomWidth: 1, borderColor: '#ccc', fontSize: 24, fontWeight: 'bold', padding: 0, color: theme.colors.text}}
                     value={projectNameInput}
                     onChangeText={setProjectNameInput}
                     autoFocus
                  />
                  <TouchableOpacity onPress={() => { setIsEditingName(false); handleSaveProject(); }} style={{padding: 10}}>
                     <Ionicons name="checkmark" size={24} color={theme.colors.primary} />
                  </TouchableOpacity>
               </View>
            ) : (
               <View style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={{fontSize: 24, fontWeight: 'bold', color: theme.colors.text, flexShrink: 1}}>{projectNameInput || 'Projet inconnu'}</Text>
                  <TouchableOpacity onPress={() => setIsEditingName(true)} style={{padding: 10, marginLeft: 5}}>
                     <Ionicons name="pencil" size={20} color="#666" />
                  </TouchableOpacity>
               </View>
            )}
         </View>

         <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
            <Ionicons name="location" size={16} color="#666" />
            <TextInput 
               style={{flex: 1, borderBottomWidth: 1, borderColor: '#ccc', marginLeft: 5, color: '#666', padding: 0}}
               value={locationInput}
               onChangeText={setLocationInput}
               onBlur={handleSaveProject}
               placeholder="Localisation"
            />
            <TouchableOpacity onPress={handleGpsLocation} style={{marginLeft: 10, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#eee', borderRadius: 4}}>
               <Text style={{fontSize: 12, fontWeight: 'bold'}}>GPS</Text>
            </TouchableOpacity>
         </View>
      </View>

      {/* Summary Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Résumé</Text>
        
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
           <Text style={styles.sectionText}>• Profondeur prévue: </Text>
           {isEditingDepth ? (
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <TextInput 
                    style={{borderBottomWidth: 1, borderColor: '#ccc', width: 60, textAlign: 'center', padding: 0, color: theme.colors.text}}
                    keyboardType="numeric"
                    value={expectedDepthInput}
                    onChangeText={setExpectedDepthInput}
                    autoFocus
                 />
                 <Text style={styles.sectionText}> ft</Text>
                 <TouchableOpacity onPress={() => { setIsEditingDepth(false); handleSaveProject(); }} style={{marginLeft: 10}}>
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                 </TouchableOpacity>
              </View>
           ) : (
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={{...styles.sectionText, fontWeight: 'bold'}}>{parseFloat(expectedDepthInput) || 0} ft</Text>
                 <TouchableOpacity onPress={() => setIsEditingDepth(true)} style={{padding: 5, marginLeft: 5}}>
                    <Ionicons name="pencil" size={16} color="#666" />
                 </TouchableOpacity>
              </View>
           )}
        </View>

        <Text style={styles.sectionText}>• Profondeur moyenne: {avgDepthRounded} ft (sur {validDepthPiles.length} pieux)</Text>
        <Text style={styles.sectionText}>• Pieux implantés: {implantedCount} / {total}</Text>
        
        <TouchableOpacity style={[styles.saveBtn, {marginTop: 15}]} onPress={handleExportPDF}>
           <Text style={styles.saveBtnText}>Exporter un rapport PDF</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.openPlanButton}
        onPress={() => navigation.navigate('ProjectPlan', {
          projectId,
          projectName
        })}
      >
        <Text style={styles.openPlanButtonText}>Ouvrir le Plan PDF Interactif</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.openPlanButton, {backgroundColor: '#7b1fa2', marginTop: 10}]}
        onPress={() => navigation.navigate('ProjectDocs', {
          projectId,
          projectName
        })}
      >
        <Text style={styles.openPlanButtonText}>Voir les Documents Techniques</Text>
      </TouchableOpacity>

      {/* Photos Section */}
      <View style={styles.section}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
           <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
           <TouchableOpacity style={styles.gpsButton} onPress={handleAddPhoto}>
              <Text style={styles.gpsButtonText}>+ Photo</Text>
           </TouchableOpacity>
        </View>
        <ScrollView horizontal>
           {photos.map(p => (
              <TouchableOpacity key={p.id} style={{marginRight: 10}} onPress={() => togglePhotoInclude(p.id, p.includeInReport)}>
                 {p.url ? (
                    <View>
                      <Image source={{uri: p.url}} style={{width: 120, height: 120, borderRadius: 8, backgroundColor: '#333', opacity: p.includeInReport !== false ? 1 : 0.3}} />
                      {p.includeInReport !== false && <View style={styles.checkBadge}><Text style={{color:'white', fontWeight:'bold'}}>✓</Text></View>}
                    </View>
                 ) : (
                    <View style={{width: 120, height: 120, borderRadius: 8, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center'}}>
                       <ActivityIndicator color={theme.colors.primary} />
                    </View>
                 )}
              </TouchableOpacity>
           ))}
        </ScrollView>
      </View>

      {/* Piles List Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pieux ({total})</Text>
        {renderPileList()}
      </View>

      <TouchableOpacity style={styles.deleteProjectBtn} onPress={handleDeleteProject}>
        <Text style={styles.deleteProjectBtnText}>Supprimer le projet</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  checkBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#4caf50',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text,
  },
  sectionText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginBottom: 5,
  },
  openPlanButton: {
    backgroundColor: theme.colors.primaryDark,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  openPlanButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shapeSection: {
    marginBottom: 15,
  },
  shapeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: 10,
    marginBottom: 8,
  },
  pileCard: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  pileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  pileSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  noDataText: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16
  },
  gpsButton: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 10,
  },
  gpsButtonText: {
    color: '#121212',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  shapeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 10,
  },
  deleteProjectBtn: {
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 40,
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    borderRadius: 8
  },
  deleteProjectBtnText: {
    color: 'white',
    fontWeight: 'bold'
  }
});
