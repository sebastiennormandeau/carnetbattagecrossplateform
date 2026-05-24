import { create } from 'zustand';
import { collection, query, where, onSnapshot, getDoc, doc, deleteDoc, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { getTenantQuery, addTenantDoc } from '../utils/firestore-tenant';

const useProjectStore = create((set, get) => ({
    projects: [],
    calendarEvents: [],
    userRole: null, // 'admin' ou 'user'
    isLoading: false,
    error: null,

    // Initialisation et écoute temps réel du rôle et des données
    initializeData: async () => {
        set({ isLoading: true, error: null });
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Non authentifié");

            // Récupérer le rôle de l'utilisateur
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let role = 'user';
            if (userDocSnap.exists() && userDocSnap.data().role === 'admin') {
                role = 'admin';
            }
            
            set({ userRole: role });

            // S'abonner aux Projets
            let qProjects = getTenantQuery('projects');
            if (role !== 'admin') {
                qProjects = query(qProjects, where('assignedUsers', 'array-contains', currentUser.uid));
            }

            const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
                const fetchedProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                set({ projects: fetchedProjects });
            }, (error) => {
                console.error("Erreur de récupération des projets:", error);
                set({ error: error.message });
            });

            // S'abonner aux Événements Calendrier
            let qEvents = getTenantQuery('calendar_events');
            if (role !== 'admin') {
                qEvents = query(qEvents, where('assignedUsers', 'array-contains', currentUser.uid));
            }

            const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
                const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                set({ calendarEvents: fetchedEvents });
            }, (error) => {
                console.error("Erreur de récupération du calendrier:", error);
                set({ error: error.message });
            });

            // Sauvegarder les fonctions de désabonnement pour le nettoyage
            set({ 
                isLoading: false, 
                unsubscribeProjects, 
                unsubscribeEvents 
            });

        } catch (error) {
            console.error("Erreur d'initialisation du store projets:", error);
            set({ error: error.message, isLoading: false });
        }
    },

    createProject: async (projectData) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Non authentifié");

            const projectsRef = collection(db, 'projects');
            await addTenantDoc(projectsRef, {
                ...projectData,
                status: 'standby',
                assignedUsers: [],
                ownerUid: currentUser.uid,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erreur lors de la création du projet:", error);
            throw error;
        }
    },

    deleteProject: async (projectId) => {
        try {
            const eventsRef = collection(db, 'calendar_events');
            const q = query(eventsRef, where('projectId', '==', projectId));
            const querySnapshot = await getDocs(q);
            
            const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);

            const projectRef = doc(db, 'projects', projectId);
            await deleteDoc(projectRef);
        } catch (error) {
            console.error("Erreur lors de la suppression du projet:", error);
            throw error;
        }
    },

    cleanup: () => {
        const { unsubscribeProjects, unsubscribeEvents } = get();
        if (unsubscribeProjects) unsubscribeProjects();
        if (unsubscribeEvents) unsubscribeEvents();
        set({ projects: [], calendarEvents: [], userRole: null });
    }
}));

export default useProjectStore;
