import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { doc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { theme } from '../theme/Theme';

export default function ProjectPlanScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;
  const webViewRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [piles, setPiles] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [mode, setMode] = useState(route.params?.placePileId ? 'PLACE' : 'NAV'); // NAV, ADD, DEL, MOVE, PLACE
  const [movingHotspotId, setMovingHotspotId] = useState(null);
  const [highlightPiles, setHighlightPiles] = useState(route.params?.highlightPiles || []);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debugData, setDebugData] = useState({ pile: null, hotspot: null });

  // Constants
  const MIN_DIST_THRESHOLD = 0.05;

  useEffect(() => {
    navigation.setOptions({ title: 'Plan PDF' });

    const unsub = onSnapshot(doc(db, 'projects', projectId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.planPdfPath) {
          try {
            const url = await getDownloadURL(ref(storage, data.planPdfPath));
            
            // Download to local cache to bypass WebView CORS
            const fileUri = FileSystem.cacheDirectory + 'current_plan_' + projectId + '.pdf';
            const { uri } = await FileSystem.downloadAsync(url, fileUri);
            
            // Read as Base64 to inject directly into the WebView's memory
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            const dataUri = `data:application/pdf;base64,${base64}`;
            
            setPdfUrl(dataUri);
          } catch (error) {
            console.error("PDF Fetch Error:", error);
            Alert.alert("Erreur", "Impossible de charger le document PDF.");
          }
        }
      }
      setLoading(false);
    }, () => setLoading(false));

    const unsubPiles = onSnapshot(collection(db, 'projects', projectId, 'piles'), (snap) => {
      if (snap.docs.length > 0) {
          setDebugData(prev => ({ ...prev, pile: snap.docs[0].data() }));
      }
      setPiles(snap.docs.map(d => {
         const data = d.data();
         // Parse depth safely
         let dFt = 0;
         if (data.depthFt !== undefined) dFt = parseFloat(data.depthFt) || 0;
         else if (data.depth_ft !== undefined) dFt = parseFloat(data.depth_ft) || 0;

         // Parse booleans safely
         const isImp = data.implanted === true || data.is_implanted === true || data.implanted === 'true' || data.is_implanted === 'true' || data.is_implanted === 1;
         const isReb = data.rebattage === true || data.is_rebattage === true || data.rebattage === 'true' || data.is_rebattage === 'true' || data.is_rebattage === 1;

         return { 
             id: d.id, 
             ...data,
             pileNo: data.pileNo || data.pile_no || '',
             gaugeIn: data.gaugeIn || data.gauge_in || '',
             depthFt: dFt,
             implanted: isImp,
             rebattage: isReb
         };
      }));
    });

    const unsubHotspots = onSnapshot(collection(db, 'projects', projectId, 'hotspots'), (snap) => {
      if (snap.docs.length > 0) {
          setDebugData(prev => ({ ...prev, hotspot: snap.docs[0].data() }));
      }
      setHotspots(snap.docs.map(d => {
         const data = d.data();
         
         // Extract pileId robustly
         let pId = data.pileId || data.pile_id || data.pileRemoteId || data.pile || data.pieu_id || data.pieuId || data.pileRef || data.pile_ref || null;
         if (pId && typeof pId === 'object' && pId.id) {
             pId = pId.id;
         } else if (pId && typeof pId === 'object' && pId.path) {
             pId = pId.path.split('/').pop();
         }

         return { 
            id: d.id, 
            ...data,
            pileId: pId ? String(pId) : undefined,
            pageIndex: data.pageIndex !== undefined ? data.pageIndex : (data.page_index || 0),
            xNorm: data.xNorm !== undefined ? data.xNorm : (data.x_norm !== undefined ? data.x_norm : data.xnorm),
            yNorm: data.yNorm !== undefined ? data.yNorm : (data.y_norm !== undefined ? data.y_norm : data.ynorm)
         };
      }));
    });

    return () => { unsub(); unsubPiles(); unsubHotspots(); };
  }, [projectId]);

  // Helper to resolve the true pileId for a hotspot, considering legacy Kotlin DB structures
  const resolvePileId = (hotspot) => {
      if (hotspot.pileId) return hotspot.pileId;
      // Fallback 1: The pile has a reference to the hotspot (inversed relationship)
      let linked = piles.find(p => p.hotspotId === hotspot.id || p.hotspot_id === hotspot.id || p.hotspotRef === hotspot.id || p.hotspot_ref === hotspot.id);
      if (linked) return linked.id;
      // Fallback 2: The hotspot and the pile share the exact same Document ID
      linked = piles.find(p => p.id === hotspot.id);
      if (linked) return linked.id;
      return undefined;
  };

  // When data changes, inject script to update the HTML markers
  useEffect(() => {
    // Auto-navigate to highlighted pile's page if necessary
    if (highlightPiles.length > 0 && hotspots.length > 0) {
        const highlightId = highlightPiles[0];
        const hotspot = hotspots.find(h => resolvePileId(h) === highlightId);
        if (hotspot && hotspot.pageIndex !== undefined && hotspot.pageIndex !== currentPage) {
            setCurrentPage(hotspot.pageIndex);
        }
    }
    
    if (webViewRef.current && pdfUrl) {
       const pageHotspots = hotspots.filter(h => h.pageIndex === currentPage).map(h => ({
           ...h,
           pileId: resolvePileId(h) // Inject resolved ID
       }));
       const script = `if (typeof updateMarkers === 'function') { updateMarkers(${JSON.stringify(pageHotspots)}, ${JSON.stringify(piles)}, '${mode}', '${movingHotspotId || ''}', ${JSON.stringify(highlightPiles)}); } true;`;
       webViewRef.current.injectJavaScript(script);
    }
  }, [hotspots, piles, mode, currentPage, pdfUrl, movingHotspotId, highlightPiles]);

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'TAP') {
         const { xNorm, yNorm } = data;
         if (mode === 'ADD') {
            const newPileRef = await addDoc(collection(db, 'projects', projectId, 'piles'), {
               pileNo: '',
               gaugeIn: '',
               depthFt: 0.0,
               implanted: false,
               rebattage: false,
               shape: 'CIRCLE',
               createdAtEpochMs: Date.now(),
               updatedAtEpochMs: Date.now()
            });

            await addDoc(collection(db, 'projects', projectId, 'hotspots'), {
              pageIndex: currentPage,
              xNorm: xNorm,
              yNorm: yNorm,
              pileId: newPileRef.id
            });
         } else if (mode === 'PLACE') {
            const placePileId = route.params?.placePileId;
            if (placePileId) {
               await addDoc(collection(db, 'projects', projectId, 'hotspots'), {
                  pageIndex: currentPage,
                  xNorm: xNorm,
                  yNorm: yNorm,
                  pileId: placePileId
               });
               navigation.setParams({ placePileId: null });
               setMode('NAV');
               Alert.alert("Succès", "Le pieu a été replacé sur le plan !");
            }
         } else {
            const pageHotspots = hotspots.filter(h => h.pageIndex === currentPage);
            
            let bestId = null;
            let bestDist = Infinity;
            if (pageHotspots.length > 0) {
               for (let h of pageHotspots) {
                  const rawX = h.xNorm !== undefined ? h.xNorm : h.x_norm !== undefined ? h.x_norm : h.xnorm || 0;
                  const rawY = h.yNorm !== undefined ? h.yNorm : h.y_norm !== undefined ? h.y_norm : h.ynorm || 0;
                  const validX = parseFloat(rawX) || 0;
                  const validY = parseFloat(rawY) || 0;
                  
                  const dx = validX - xNorm;
                  const dy = validY - yNorm;
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist < bestDist) {
                     bestDist = dist;
                     bestId = h.id;
                  }
               }
            }

            if (mode === 'MOVE') {
               if (movingHotspotId) {
                  // User selected a new destination for the hotspot
                  await updateDoc(doc(db, 'projects', projectId, 'hotspots', movingHotspotId), {
                      xNorm: xNorm, 
                      yNorm: yNorm, 
                      x_norm: xNorm, // legacy format
                      y_norm: yNorm // legacy format
                  });
                  setMovingHotspotId(null);
               } else {
                  // Select the hotspot to move
                  if (bestDist < MIN_DIST_THRESHOLD && bestId) {
                      setMovingHotspotId(bestId);
                  }
               }
            } else if (bestDist < MIN_DIST_THRESHOLD && bestId) {
               const hotspot = pageHotspots.find(h => h.id === bestId);
               
               if (mode === 'DEL') {
                  const targetPileId = resolvePileId(hotspot);
                  if (hotspot && targetPileId) {
                     await deleteDoc(doc(db, 'projects', projectId, 'piles', targetPileId));
                  }
                  await deleteDoc(doc(db, 'projects', projectId, 'hotspots', bestId));
               } else if (mode === 'NAV') {
                  if (hotspot) {
                     const targetPileId = resolvePileId(hotspot);
                     if (targetPileId) {
                        navigation.navigate('PileDetail', { projectId, pileId: targetPileId });
                     } else {
                        // Create pile for legacy unlinked hotspot (matches Kotlin logic)
                        const newPileRef = await addDoc(collection(db, 'projects', projectId, 'piles'), {
                           pileNo: '', gaugeIn: '', depthFt: 0.0, implanted: false, rebattage: false, shape: 'CIRCLE', createdAtEpochMs: Date.now(), updatedAtEpochMs: Date.now()
                        });
                        await updateDoc(doc(db, 'projects', projectId, 'hotspots', bestId), { pileId: newPileRef.id });
                        navigation.navigate('PileDetail', { projectId, pileId: newPileRef.id });
                     }
                  }
               }
            }
         }
      } else if (data.type === 'PAGE_CHANGED') {
         // Optionally sync from HTML if needed, but RN drives it now
      } else if (data.type === 'READY') {
         setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.log('WebView message error:', e);
    }
  };

  const getHtmlContent = (url) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #101010; display: flex; flex-direction: column; align-items: center; min-height: 100vh; overflow: auto; }
        #viewer-container { position: relative; display: inline-block; box-shadow: 0 4px 8px rgba(0,0,0,0.5); font-size: 0; line-height: 0; }
        canvas { display: block; width: 100vw; height: auto; }
        #overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .marker { position: absolute; width: 22px; height: 22px; border-radius: 11px; margin-left: -11px; margin-top: -11px; border: 2px solid white; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.4); transform-origin: center center; }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 15px rgba(233, 30, 99, 0.7); }
            50% { transform: scale(1.6); box-shadow: 0 0 30px rgba(233, 30, 99, 1); }
            100% { transform: scale(1); box-shadow: 0 0 15px rgba(233, 30, 99, 0.7); }
        }
      </style>
    </head>
    <body style="user-select: none; -webkit-user-select: none;">
      <div id="viewer-container">
        <canvas id="the-canvas"></canvas>
        <div id="overlay"></div>
      </div>

      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        let pdfDoc = null,
            pageNum = 1,
            pageRendering = false,
            pageNumPending = null,
            scale = 4.0, // Rendu très haute définition pour la WebView
            canvas = document.getElementById('the-canvas'),
            ctx = canvas.getContext('2d'),
            overlay = document.getElementById('overlay');
            
        let currentVisualScale = 1.0;
        
        function updateMarkerScales() {
            if (window.visualViewport) {
                currentVisualScale = window.visualViewport.scale;
                document.querySelectorAll('.marker').forEach(m => {
                    m.style.transform = 'scale(' + (1 / currentVisualScale) + ')';
                });
            }
        }
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateMarkerScales);
            window.visualViewport.addEventListener('scroll', updateMarkerScales);
        }

        function renderPage(num) {
          pageRendering = true;
          pdfDoc.getPage(num).then(function(page) {
            var viewport = page.getViewport({scale: scale});
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            var renderContext = {
              canvasContext: ctx,
              viewport: viewport
            };
            var renderTask = page.render(renderContext);

            renderTask.promise.then(function() {
              pageRendering = false;
              if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
              }
            });
          });

          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_CHANGED', pageIndex: num - 1 }));
        }

        function queueRenderPage(num) {
          if (pageRendering) {
            pageNumPending = num;
          } else {
            renderPage(num);
          }
        }

        window.changePage = function(num) {
           if (num !== pageNum && num >= 1 && num <= pdfDoc.numPages) {
              pageNum = num;
              queueRenderPage(pageNum);
           }
        };

        pdfjsLib.getDocument('${url}').promise.then(function(pdfDoc_) {
          pdfDoc = pdfDoc_;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY', totalPages: pdfDoc.numPages }));
          renderPage(pageNum);
        }).catch(err => console.error("PDF.js Load Error:", err));

        // Click handler logic for the canvas
        document.getElementById('the-canvas').addEventListener('click', function(e) {
          const rect = this.getBoundingClientRect();
          const xNorm = e.offsetX / this.offsetWidth;
          const yNorm = e.offsetY / this.offsetHeight;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'TAP',
            xNorm: xNorm,
            yNorm: yNorm,
            rawX: e.clientX,
            rawY: e.clientY
          }));
        });

        window.updateMarkers = function(hotspots, piles, mode, movingHotspotId, highlightPiles = []) {
          overlay.innerHTML = '';
          hotspots.forEach(h => {
             const pile = piles.find(p => p.id === h.pileId);
             const hasDepth = pile && pile.depthFt > 0;
             let rawX = h.xNorm !== undefined ? h.xNorm : h.x_norm !== undefined ? h.x_norm : h.xnorm || 0;
             let rawY = h.yNorm !== undefined ? h.yNorm : h.y_norm !== undefined ? h.y_norm : h.ynorm || 0;
             
             let bgColor = 'rgba(176,190,197,0.9)'; // Gris par défaut
             let borderColor = 'white'; // Contour blanc par default
             
             if (mode === 'DEL') {
                 bgColor = 'rgba(244,67,54,0.9)'; // Rouge Delete
             } else if (pile) {
                 if (pile.rebattage) {
                     bgColor = 'rgba(33,150,243,0.9)'; // Bleu
                     if (hasDepth) borderColor = 'rgba(76,175,80,1.0)'; // Contour Vert
                 } else if (pile.implanted) {
                     bgColor = 'rgba(255,213,79,0.9)'; // Jaune
                     if (hasDepth) borderColor = 'rgba(76,175,80,1.0)'; // Contour Vert
                 }
                 // Si ni rebattage ni implanté -> Reste Gris / Contour Blanc
             }

             const div = document.createElement('div');
             div.className = 'marker';
             div.style.left = (parseFloat(rawX) * 100) + '%';
             div.style.top = (parseFloat(rawY) * 100) + '%';
             div.style.backgroundColor = bgColor;
             div.style.borderColor = borderColor;
             div.style.borderWidth = borderColor === 'white' ? '2px' : '3px'; // Slightly thicker green border to make it pop
             
             // Special highlight styling
             const isHighlighted = pile && highlightPiles.includes(pile.id);
             
             if (mode === 'MOVE' && h.id === movingHotspotId) {
                 div.style.borderColor = '#FFEB3B';
                 div.style.borderWidth = '4px';
                 div.style.boxShadow = '0 0 10px #FFEB3B';
                 div.style.zIndex = '1000';
                 div.style.transform = 'scale(' + (1.2 / currentVisualScale) + ')';
             } else if (isHighlighted) {
                 div.style.borderColor = '#E91E63'; // Magenta
                 div.style.borderWidth = '5px';
                 div.style.boxShadow = '0 0 25px #E91E63';
                 div.style.zIndex = '999';
                 div.style.transform = 'scale(' + (1.5 / currentVisualScale) + ')';
                 // Appliquer une animation CSS clignotante via keyframes existante ou transition
                 div.style.animation = 'pulse 1.5s infinite';
             } else {
                 div.style.transform = 'scale(' + (1 / currentVisualScale) + ')';
             }
             
             overlay.appendChild(div);
          });
        };
      </script>
    </body>
    </html>
  `;

  if (loading) {
     return <View style={[styles.container, styles.centered]}><ActivityIndicator color={theme.colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeBar}>
        <Text style={{ ...styles.pageText, flex: 1 }}>{hotspots.length} pts</Text>
        {mode === 'PLACE' ? (
           <View style={[styles.modeBtn, styles.modeBtnActive, {flex: 3, backgroundColor: theme.colors.error}]}>
              <Text style={styles.modeBtnText}>TAPEZ SUR LE PLAN POUR PLACER LE PIEU ORPHELIN</Text>
           </View>
        ) : (
           <>
             <TouchableOpacity style={[styles.modeBtn, mode === 'NAV' && styles.modeBtnActive]} onPress={() => {setMode('NAV'); setMovingHotspotId(null);}}>
               <Text style={styles.modeBtnText}>NAV</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.modeBtn, mode === 'ADD' && styles.modeBtnActive]} onPress={() => {setMode('ADD'); setMovingHotspotId(null);}}>
               <Text style={styles.modeBtnText}>ADD</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.modeBtn, mode === 'MOVE' && styles.modeBtnActive]} onPress={() => {setMode('MOVE'); setMovingHotspotId(null);}}>
               <Text style={styles.modeBtnText}>MOVE</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.modeBtn, mode === 'DEL' && styles.modeBtnActive]} onPress={() => {setMode('DEL'); setMovingHotspotId(null);}}>
               <Text style={styles.modeBtnText}>DEL</Text>
             </TouchableOpacity>
           </>
        )}
      </View>

      <View style={styles.pageControlsBar}>
        <TouchableOpacity style={styles.pageBtn} onPress={() => {
            if (currentPage > 0) {
               const newPage = currentPage - 1;
               setCurrentPage(newPage);
               if (webViewRef.current) webViewRef.current.injectJavaScript(`if(window.changePage) window.changePage(${newPage + 1}); true;`);
            }
        }}>
          <Text style={styles.pageBtnText}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.pageIndicatorText}>{currentPage + 1} / {totalPages}</Text>
        <TouchableOpacity style={styles.pageBtn} onPress={() => {
            if (currentPage < totalPages - 1) {
               const newPage = currentPage + 1;
               setCurrentPage(newPage);
               if (webViewRef.current) webViewRef.current.injectJavaScript(`if(window.changePage) window.changePage(${newPage + 1}); true;`);
            }
        }}>
          <Text style={styles.pageBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pdfContainer}>
         {!pdfUrl ? (
            <Text style={{color: 'white', alignSelf:'center', marginTop: 20}}>Chargement du PDF...</Text>
         ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: getHtmlContent(pdfUrl) }}
              onMessage={handleMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              mixedContentMode="always"
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              style={{ backgroundColor: '#1E1E1E', flex: 1 }}
              containerStyle={{ backgroundColor: '#1E1E1E' }}
            />
         )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  modeBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, padding: 10, justifyContent: 'space-around', alignItems: 'center' },
  modeBtn: { padding: 10, borderRadius: 8, backgroundColor: theme.colors.background },
  modeBtnActive: { backgroundColor: theme.colors.primary },
  modeBtnText: { color: theme.colors.text, fontWeight: 'bold' },
  pageText: { color: theme.colors.textMuted, fontSize: 12 },
  pageControlsBar: { flexDirection: 'row', backgroundColor: '#1A1A1A', paddingVertical: 8, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  pageBtn: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 6 },
  pageBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  pageIndicatorText: { color: 'white', fontSize: 14, fontWeight: 'bold', minWidth: 50, textAlign: 'center' },
  pdfContainer: { flex: 1 }
});
