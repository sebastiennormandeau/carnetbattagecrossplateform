import { create } from 'zustand';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SMART_PILING_LOGO_BASE64 } from '../config/smartPilingLogoBase64';

const usePilingStore = create((set, get) => ({
    // Paramètres du Pieu
    selectedGaugeIdx: 0, // Idx dans la liste des calibres
    steelGrade: 345,     // Limite d'élasticité (MPa)
    lengthUnderHammer: "", // Longueur totale sous le marteau (pi)
    exposedLength: "",     // Longueur hors sol (pi)
    
    // Paramètres Marteau & Sol
    selectedHammerIdx: 0, // Idx du marteau
    efficiency: 55,       // Efficacité (%)
    dropHeight: 1.524,    // Hauteur de chute (m)
    soilReboundC3: 2.5,   // Till = 2.5, Roc = 2.0 (mm)
    blowsPerBatch: 10,    // Coups par volée (ex: 1, 4, 10)
    
    // Base de données Firebase
    availableHammers: [], // Liste des marteaux provenant exclusivement de Firestore
    
    // Cible (Module 1)
    targetRu: "",          // kN
    
    // Cibles et Mesures (Module 2)
    measuredRefusal: "",   // mm (Outil A Inversé)
    cutLength: "",         // pi (Outil B PDA)
    targetPDA: "",         // kN (Outil B PDA)
    isPdaMode: false,
    pdaLength: "",         // pi
    pdaDropHeight: 1.524,  // m

    // Identité Visuelle
    reportLogo: SMART_PILING_LOGO_BASE64,

    // Actions
    setReportLogo: (base64String) => set({ reportLogo: base64String }),
    updateField: (field, value) => set((state) => ({ ...state, [field]: value })),
    resetFields: () => set({
        steelGrade: 345,
        lengthUnderHammer: "",
        exposedLength: "",
        targetRu: "",
        measuredRefusal: "",
        cutLength: "",
        targetPDA: "",
        isPdaMode: false,
        pdaLength: "",
        pdaDropHeight: 1.524
    }),

    // --- Actions Asynchrones Firebase ---
    fetchHammers: async () => {
        try {
            const snapshot = await getDocs(collection(db, 'hammers'));
            const hammersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            set({ availableHammers: hammersData });
        } catch (error) {
            console.error("Erreur lors de la récupération des marteaux:", error);
        }
    },

    addHammer: async (newHammer) => {
        try {
            const docRef = await addDoc(collection(db, 'hammers'), newHammer);
            const hammerWithId = { id: docRef.id, ...newHammer };
            set((state) => ({
                availableHammers: [...state.availableHammers, hammerWithId]
            }));
            return hammerWithId;
        } catch (error) {
            console.error("Erreur lors de l'ajout du marteau:", error);
            throw error;
        }
    },

    updateHammer: async (id, updatedData) => {
        try {
            const hammerRef = doc(db, 'hammers', id);
            await updateDoc(hammerRef, updatedData);
            set((state) => ({
                availableHammers: state.availableHammers.map(h => h.id === id ? { ...h, ...updatedData } : h)
            }));
        } catch (error) {
            console.error("Erreur lors de la mise à jour du marteau:", error);
            throw error;
        }
    },

    deleteHammer: async (id) => {
        try {
            const hammerRef = doc(db, 'hammers', id);
            await deleteDoc(hammerRef);
            set((state) => {
                const newHammers = state.availableHammers.filter(h => h.id !== id);
                // Si l'index sélectionné devient invalide, on le ramène à 0
                const newSelectedIdx = state.selectedHammerIdx >= newHammers.length ? 0 : state.selectedHammerIdx;
                return {
                    availableHammers: newHammers,
                    selectedHammerIdx: newSelectedIdx
                };
            });
        } catch (error) {
            console.error("Erreur lors de la suppression du marteau:", error);
            throw error;
        }
    }
}));

export default usePilingStore;
