import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Alert, Image, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as ImageManipulator from 'expo-image-manipulator';
import { db, storage } from '../config/firebase';
import { doc, onSnapshot, collection, query, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { theme } from '../theme/Theme';
import { Ionicons } from '@expo/vector-icons';
import usePilingStore from '../store/usePilingStore';
import useProjectStore from '../store/useProjectStore';
import { SMART_PILING_LOGO_BASE64 } from '../config/smartPilingLogoBase64';
import AssignProjectModal from '../components/AssignProjectModal';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;

  const userRole = useProjectStore(state => state.userRole);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);

  const [project, setProject] = useState(null);
  const [piles, setPiles] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [projectNameInput, setProjectNameInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [expectedDepthInput, setExpectedDepthInput] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [collapsedShapes, setCollapsedShapes] = useState({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDepth, setIsEditingDepth] = useState(false);

  const reportLogo = usePilingStore(state => state.reportLogo);

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
        setExpectedDepthInput(data.expectedDepth ? data.expectedDepth.toString() : '');
      }
    }, (err) => {
        console.error("Erreur Project listener:", err);
        setLoading(false);
    });

    // 2. Listen to the Piles subcollection
    const pilesRef = collection(db, 'projects', projectId, 'piles');
    const q = query(pilesRef);
    const unsubPiles = onSnapshot(q, (snapshot) => {
      const pilesData = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        
        let dFt = 0;
        if (data.depthFt !== undefined) dFt = parseFloat(data.depthFt) || 0;
        else if (data.depth_ft !== undefined) dFt = parseFloat(data.depth_ft) || 0;

        const isImp = data.implanted === true || data.is_implanted === true || data.implanted === 'true' || data.is_implanted === 'true' || data.is_implanted === 1;
        const isReb = data.rebattage === true || data.is_rebattage === true || data.rebattage === 'true' || data.is_rebattage === 'true' || data.is_rebattage === 1;

        let shapeVal = data.shape || 'CIRCLE';
        if (shapeVal === 'Cercle') shapeVal = 'CIRCLE';
        if (shapeVal === 'Carre' || shapeVal === 'Carré') shapeVal = 'SQUARE';
        if (shapeVal === 'Etoile') shapeVal = 'DIAMOND';
        if (shapeVal === 'Triangle') shapeVal = 'TRIANGLE';
        if (shapeVal === 'Hexagone') shapeVal = 'HEXAGON';

        pilesData.push({ 
            id: doc.id, 
            ...data,
            shape: shapeVal,
            pileNo: data.pileNo || data.pile_no || '',
            gaugeIn: data.gaugeIn || data.gauge_in || '',
            depthFt: dFt,
            implanted: isImp,
            rebattage: isReb
        });
      });
      setPiles(pilesData);
      setLoading(false);
    }, (err) => {
        console.error("Erreur Piles listener:", err);
        setLoading(false);
    });

    // 3. Listen to Photos
    const photosRef = collection(db, 'projects', projectId, 'photos');
    const unsubPhotos = onSnapshot(photosRef, async (snapshot) => {
      let photosData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPhotos(photosData);

      // Fetch URLs asynchronously
      photosData.forEach(async (photo) => {
          if (!photo.url && !photo.downloadUrl && photo.storagePath) {
              try {
                  const url = await getDownloadURL(ref(storage, photo.storagePath));
                  setPhotos(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(p => p.id === photo.id);
                      if (idx !== -1) {
                          next[idx] = { ...next[idx], url };
                      }
                      return next;
                  });
              } catch(e) {
                  console.log("Photo getDownloadURL error:", e.code, e.message);
                  setPhotos(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(p => p.id === photo.id);
                      if (idx !== -1) {
                          next[idx] = { ...next[idx], urlError: e.message || 'Erreur réseau/CORS' };
                      }
                      return next;
                  });
              }
          } else if (photo.downloadUrl && !photo.url) {
              setPhotos(prev => {
                  const next = [...prev];
                  const idx = next.findIndex(p => p.id === photo.id);
                  if (idx !== -1) {
                      next[idx] = { ...next[idx], url: photo.downloadUrl };
                  }
                  return next;
              });
          }
      });
    }, (err) => console.log('Photos listener error:', err));

    // 4. Listen to Notes
    const notesRef = collection(db, 'projects', projectId, 'notes');
    const unsubNotes = onSnapshot(notesRef, (snapshot) => {
      const notesData = [];
      snapshot.forEach(doc => {
         notesData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation time
      notesData.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setNotes(notesData);
    }, (err) => console.log('Notes listener error:', err));

    return () => {
      unsubProject();
      unsubPiles();
      unsubPhotos();
      unsubNotes();
    };
  }, [projectId]);

  // Sync average depth back to project document for the Map
  useEffect(() => {
    if (!project || !piles) return;
    const validDepthPiles = piles.filter(p => p.depthFt > 0);
    const avgD = validDepthPiles.length > 0 
      ? validDepthPiles.reduce((acc, p) => acc + p.depthFt, 0) / validDepthPiles.length 
      : 0;
    const avgDRounded = Math.round(avgD * 10) / 10;
    
    if (project.avgDepthFt !== avgDRounded) {
      updateDoc(doc(db, 'projects', projectId), { avgDepthFt: avgDRounded })
        .catch(e => console.log('Error syncing avgDepthFt:', e));
    }
  }, [piles, project, projectId]);

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

  const expectedD = parseFloat(String(expectedDepthInput).replace(',', '.')) || 0.0;
  const totalDiff = validDepthPiles.reduce((acc, p) => acc + (p.depthFt - expectedD), 0);
  const totalDiffStr = totalDiff === 0 ? '—' : (totalDiff > 0 ? '+' : '') + totalDiff.toFixed(1);

  // Calcul différentiel par calibre
  const diffByGauge = {};
  const unknownPileIds = []; // ID des pieux non identifiés

  validDepthPiles.forEach(p => {
      const gauge = p.gaugeIn;
      const isUnknown = (!gauge || gauge.toString().trim() === '');
      const gaugeKey = isUnknown ? 'Inconnu' : gauge;
      
      if (isUnknown) {
          unknownPileIds.push(p.id);
      }
      
      if (!diffByGauge[gaugeKey]) diffByGauge[gaugeKey] = { diff: 0, count: 0 };
      diffByGauge[gaugeKey].diff += (p.depthFt - expectedD);
      diffByGauge[gaugeKey].count += 1;
  });

  const getShapeLabel = (shapeVal) => {
    switch (shapeVal) {
      case 'CIRCLE': return 'Cercle';
      case 'SQUARE': return 'Carré';
      case 'TRIANGLE': return 'Triangle';
      case 'HEXAGON': return 'Hexagone';
      case 'DIAMOND': return 'Losange';
      case 'CIRCLE_CIRCLE': return 'Double Cercle';
      case 'TRIANGLE_TRIANGLE': return 'Double Triangle';
      case 'SQUARE_SQUARE': return 'Double Carré';
      case 'SQUARE_HEX': return 'Carré/Hexagone';
      case 'CIRCLE_HEX': return 'Cercle/Hexagone';
      default: return shapeVal || 'Non définie';
    }
  };

  // Group piles by shape
  const groupedPiles = piles.reduce((acc, pile) => {
    const shape = getShapeLabel(pile.shape);
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
         
         // Solution: on passe uniquement width sans aucune autre clé pour éviter le NullPointerException
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

  const handleAddNote = async () => {
     if (!newNoteText.trim()) return;
     try {
        await addDoc(collection(db, 'projects', projectId, 'notes'), {
           text: newNoteText.trim(),
           includeInReport: true,
           createdAt: Date.now()
        });
        setNewNoteText('');
     } catch(e) {
        Alert.alert("Erreur", "Impossible d'ajouter la note.");
     }
  };

  const toggleNoteInclude = async (noteId, currentStatus) => {
     try {
        await updateDoc(doc(db, 'projects', projectId, 'notes', noteId), {
           includeInReport: currentStatus === false ? true : false
        });
     } catch(e) {}
  };

  const deleteNote = (noteId) => {
     Alert.alert(
        "Supprimer la note",
        "Voulez-vous vraiment supprimer cette note ?",
        [
           { text: "Annuler", style: "cancel" },
           { 
              text: "Supprimer", 
              style: "destructive",
              onPress: async () => {
                 try {
                    await deleteDoc(doc(db, 'projects', projectId, 'notes', noteId));
                 } catch(e) {}
              }
           }
        ]
     );
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

      const sortedPilesForReport = [...piles].sort((a, b) => {
         if (a.shape !== b.shape) {
             return (a.shape || '').localeCompare(b.shape || '');
         }
         const numA = String(a.pileNo || '');
         const numB = String(b.pileNo || '');
         const chunkify = (t) => t.match(/[^\d]+|\d+/g) || [];
         const aa = chunkify(numA);
         const bb = chunkify(numB);
         for (let x = 0; aa[x] && bb[x]; x++) {
             if (aa[x] !== bb[x]) {
                 const c = Number(aa[x]);
                 const d = Number(bb[x]);
                 if (!isNaN(c) && !isNaN(d)) return c - d;
                 else return (aa[x] > bb[x]) ? 1 : -1;
             }
         }
         return aa.length - bb.length;
      });

      const pilesHtml = sortedPilesForReport.map(p => {
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

      const gaugeHtml = Object.keys(diffByGauge).map(gauge => {
          const item = diffByGauge[gauge];
          const dStr = item.diff === 0 ? '—' : (item.diff > 0 ? '+' : '') + item.diff.toFixed(1);
          return `${gauge === 'Inconnu' ? gauge : gauge + '"'} : ${dStr} ft (sur ${item.count} pieux)<br/>`;
      }).join('');

      const selectedPhotos = photos.filter(p => p.includeInReport !== false);
      const photoHtmlPromises = selectedPhotos.map(async (p) => {
         try {
           if (!p.url) return '';
           const targetFile = new File(Paths.cache, p.id + '_raw.jpg');
           const downloadObj = await File.downloadFileAsync(p.url, targetFile, { idempotent: true });
           
           // Solution: on passe uniquement width sans aucune autre clé pour éviter le NullPointerException
           const manipResult = await ImageManipulator.manipulateAsync(
              downloadObj.uri,
              [{ resize: { width: 800 } }],
              { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
           );
           
           const manipFile = new File(manipResult.uri);
           const b64 = await manipFile.base64();
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

      const selectedNotes = notes.filter(n => n.includeInReport !== false);
      const notesHtml = selectedNotes.map(n => `<li>${n.text}</li>`).join('');
      const notesSection = notesHtml ? `
         <h2>Notes de Projet</h2>
         <ul class="notes-list">
            ${notesHtml}
         </ul>
      ` : '';

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 10px 30px; color: #333; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 20px; }
              .logo-img { max-height: 80px; width: auto; max-width: 250px; }
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
              <img src="${reportLogo || SMART_PILING_LOGO_BASE64}" class="logo-img" />
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
              <br/>
              <strong>Différentiel par calibre:</strong><br/>
              ${gaugeHtml || 'Aucun pieu valide'}
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
            
            ${notesSection}
            
            ${photosSection}
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      
      const safeName = (project?.name || 'Projet').replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 50);
      const stamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
      const newFile = new File(Paths.cache, `Rapport_${safeName}_${stamp}.pdf`);
      
      const oldFile = new File(uri);
      oldFile.move(newFile);
      
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
         await MailComposer.composeAsync({
            subject: `Rapport de projet: ${project?.name ? project.name.trim() : 'Projet'}`,
            body: "Veuillez trouver ci-joint le rapport de projet au format PDF.",
            attachments: [newFile.uri]
         });
      } else {
         await Sharing.shareAsync(newFile.uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Partager le rapport' });
      }
    } catch(e) {
      console.error("PDF Export Crash:", e);
      Alert.alert("Erreur Système", "L'opération a échoué.\nDétails: " + e.message);
    }
  };

  const handleSaveProject = async () => {
    try {
      // Safe parsing to handle French comma decimals
      const parsedDepth = parseFloat(String(expectedDepthInput).replace(',', '.')) || 0.0;

      await updateDoc(doc(db, 'projects', projectId), {
        name: projectNameInput.trim(),
        location: locationInput.trim(),
        expectedDepth: parsedDepth
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
            <Text style={styles.shapeTitle}>Forme: {shape} ({shapePiles.length})</Text>
            <Text style={{color: theme.colors.primary, fontWeight: 'bold'}}>{isCollapsed ? '▼' : '▲'}</Text>
        </TouchableOpacity>
        
        {!isCollapsed && [...shapePiles].sort((a, b) => {
            const strA = String(a.pileNo || '');
            const strB = String(b.pileNo || '');
            
            // Fonction de séparation en blocs de nombres et de textes
            const chunkify = (t) => {
                let tz = [], x = 0, y = -1, n = 0, i, j;
                while (i = (j = t.charAt(x++)).charCodeAt(0)) {
                    let m = (i >= 48 && i <= 57); // On sépare strictement par les chiffres
                    if (m !== n) { tz[++y] = ""; n = m; }
                    tz[y] += j;
                }
                return tz;
            };

            const aa = chunkify(strA);
            const bb = chunkify(strB);

            for (let x = 0; aa[x] && bb[x]; x++) {
                if (aa[x] !== bb[x]) {
                    const c = Number(aa[x]);
                    const d = Number(bb[x]);
                    if (!isNaN(c) && !isNaN(d)) {
                        return c - d;
                    } else {
                        return (aa[x] > bb[x]) ? 1 : -1;
                    }
                }
            }
            return aa.length - bb.length;
        }).map(pile => {
          const isError = pile.implanted && !(pile.depthFt > 0);
          return (
          <TouchableOpacity 
            key={pile.id} 
            style={[styles.pileCard, isError ? { borderColor: theme.colors.error, borderWidth: 2, backgroundColor: '#ffebee' } : {}]}
            onPress={() => navigation.navigate('PileDetail', { 
              projectId: projectId, 
              pileId: pile.id 
            })}
          >
            <View>
              <Text style={styles.pileName}>
                 {pile.pileNo || "Pieu"} 
                 {isError && <Text style={{color: theme.colors.error, fontSize: 12}}> (Erreur: Sans Profondeur)</Text>}
              </Text>
              <Text style={styles.pileSub}>
                Calibre: {pile.gaugeIn || "-"} in | Prof.: {pile.depthFt} ft | {pile.implanted ? "Implanté" : "Non implanté"}
              </Text>
            </View>
          </TouchableOpacity>
        )})}
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

         {userRole === 'admin' && (
             <TouchableOpacity 
                 style={{marginTop: 15, backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6, alignSelf: 'flex-start'}}
                 onPress={() => setIsAssignModalVisible(true)}
             >
                 <Text style={{color: 'white', fontWeight: 'bold', fontSize: 14}}>Modifier l'assignation globale</Text>
             </TouchableOpacity>
         )}
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
                    onBlur={() => { setIsEditingDepth(false); handleSaveProject(); }}
                    autoFocus
                 />
                 <Text style={styles.sectionText}> ft</Text>
                 <TouchableOpacity onPress={() => { setIsEditingDepth(false); handleSaveProject(); }} style={{marginLeft: 10}}>
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                 </TouchableOpacity>
              </View>
           ) : (
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={{...styles.sectionText, fontWeight: 'bold'}}>{expectedDepthInput || '—'} ft</Text>
                 <TouchableOpacity onPress={() => setIsEditingDepth(true)} style={{padding: 5, marginLeft: 5}}>
                    <Ionicons name="pencil" size={16} color="#666" />
                 </TouchableOpacity>
              </View>
           )}
        </View>

        <Text style={styles.sectionText}>• Profondeur moyenne: {avgDepthRounded} ft (sur {validDepthPiles.length} pieux)</Text>
        <Text style={styles.sectionText}>• Pieux implantés: {implantedCount} / {total}</Text>
        
        {piles.filter(p => p.implanted && !(p.depthFt > 0)).length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 5 }}>
            <Text style={{color: theme.colors.error, fontSize: 14, flexShrink: 1}}>⚠️ {piles.filter(p => p.implanted && !(p.depthFt > 0)).length} implanté(s) sans profondeur</Text>
            <TouchableOpacity 
               style={{ marginLeft: 10, backgroundColor: theme.colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
               onPress={() => navigation.navigate('ProjectPlan', { projectId, projectName, highlightPiles: piles.filter(p => p.implanted && !(p.depthFt > 0)).map(p=>p.id) })}
            >
               <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>Localiser</Text>
            </TouchableOpacity>
          </View>
        )}

        {piles.filter(p => !p.implanted).length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 5 }}>
            <Text style={{color: theme.colors.textMuted, fontSize: 14, flexShrink: 1}}>ℹ️ {piles.filter(p => !p.implanted).length} pieux non implantés</Text>
            <TouchableOpacity 
               style={{ marginLeft: 10, backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}
               onPress={() => navigation.navigate('ProjectPlan', { projectId, projectName, highlightPiles: piles.filter(p => !p.implanted).map(p=>p.id) })}
            >
               <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' }}>Localiser</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={[styles.sectionText, {marginTop: 10, fontWeight: 'bold', color: 'white'}]}>Différentiel linéaire:</Text>
        <Text style={styles.sectionText}>  Total: {totalDiffStr} ft</Text>
        {Object.keys(diffByGauge).map(gauge => {
            const item = diffByGauge[gauge];
            const dStr = item.diff === 0 ? '—' : (item.diff > 0 ? '+' : '') + item.diff.toFixed(1);
            
            if (gauge === 'Inconnu' && unknownPileIds.length > 0) {
               return (
                  <View key={gauge} style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <Text style={styles.sectionText}>  Calibre Inconnu: {dStr} ft (sur {item.count} pieux)</Text>
                     <TouchableOpacity 
                        style={{ marginLeft: 10, backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 5 }}
                        onPress={() => navigation.navigate('ProjectPlan', { projectId, projectName, highlightPiles: unknownPileIds })}
                     >
                        <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' }}>Localiser sur le plan</Text>
                     </TouchableOpacity>
                  </View>
               );
            }

            return <Text key={gauge} style={styles.sectionText}>  Calibre {gauge}": {dStr} ft (sur {item.count} pieux)</Text>
        })}

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

      {/* Notes Section */}
      <View style={styles.section}>
         <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <Text style={styles.sectionTitle}>Notes ({notes.length})</Text>
         </View>
         
         <View style={{flexDirection: 'row', marginBottom: 15}}>
            <TextInput 
               style={[styles.input, {flex: 1, marginBottom: 0, marginRight: 10}]}
               placeholder="Ajouter une note..."
               value={newNoteText}
               onChangeText={setNewNoteText}
            />
            <TouchableOpacity style={[styles.gpsButton, {justifyContent: 'center'}]} onPress={handleAddNote}>
               <Text style={styles.gpsButtonText}>Ajouter</Text>
            </TouchableOpacity>
         </View>

         {notes.map(n => (
            <View key={n.id} style={{flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, backgroundColor: theme.colors.background, padding: 10, borderRadius: 8}}>
               <TouchableOpacity 
                  style={{marginRight: 10, marginTop: 2}}
                  onPress={() => toggleNoteInclude(n.id, n.includeInReport)}
               >
                  <Ionicons 
                     name={n.includeInReport !== false ? "checkbox" : "square-outline"} 
                     size={24} 
                     color={n.includeInReport !== false ? theme.colors.primary : theme.colors.border} 
                  />
               </TouchableOpacity>
               <TextInput 
                  style={{flex: 1, color: theme.colors.text, fontSize: 14, padding: 0}}
                  defaultValue={n.text}
                  multiline
                  onEndEditing={async (e) => {
                      const newText = e.nativeEvent.text.trim();
                      if (newText && newText !== n.text) {
                          try {
                              await updateDoc(doc(db, 'projects', projectId, 'notes', n.id), { text: newText });
                          } catch(err) {}
                      } else if (!newText) {
                          // Auto-delete if user clears the text completely
                          try {
                              await deleteDoc(doc(db, 'projects', projectId, 'notes', n.id));
                          } catch(err) {}
                      }
                  }}
               />
               <TouchableOpacity style={{marginLeft: 10}} onPress={() => deleteNote(n.id)}>
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
               </TouchableOpacity>
            </View>
         ))}
      </View>

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
                 ) : p.urlError ? (
                    <TouchableOpacity 
                       style={{width: 120, height: 120, borderRadius: 8, backgroundColor: '#551111', justifyContent: 'center', alignItems: 'center', padding: 5}}
                       onPress={() => {
                           if (Platform.OS === 'web') {
                               window.alert("Détails de l'erreur:\n" + p.urlError);
                           } else {
                               Alert.alert("Détails de l'erreur", p.urlError);
                           }
                       }}
                    >
                       <Ionicons name="warning-outline" size={30} color="#ff4444" />
                       <Text style={{color: '#ff4444', fontSize: 12, textAlign: 'center', marginTop: 5, fontWeight: 'bold'}} numberOfLines={3}>{p.urlError}</Text>
                       <Text style={{color: 'white', fontSize: 9, marginTop: 5}}>Toucher pour lire</Text>
                    </TouchableOpacity>
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

      {/* Modal d'assignation globale (pour admins) */}
      <AssignProjectModal 
          visible={isAssignModalVisible} 
          onClose={() => setIsAssignModalVisible(false)} 
          projectId={projectId} 
      />
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
