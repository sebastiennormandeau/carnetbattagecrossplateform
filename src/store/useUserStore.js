import { create } from 'zustand';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, app as primaryApp } from '../config/firebase';
import { requireTenant } from '../utils/firestore-tenant';

const useUserStore = create((set, get) => ({
    users: [],
    currentUserProfile: null,
    isLoading: false,
    error: null,

    fetchCurrentUserProfile: async (uid) => {
        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                // Auto-promotion du Super-Admin (SebastienNormandeau@gmail.com)
                if (userData.email && userData.email.toLowerCase() === 'sebastiennormandeau@gmail.com' && !userData.isSuperAdmin) {
                    await setDoc(userRef, { isSuperAdmin: true }, { merge: true });
                    userData.isSuperAdmin = true;
                }
                
                set({ currentUserProfile: { id: userSnap.id, ...userData } });
            } else {
                set({ currentUserProfile: null });
            }
        } catch (error) {
            console.error("Erreur récupération profil courant:", error);
        }
    },

    fetchUsers: async () => {
        set({ isLoading: true, error: null });
        try {
            const companyId = requireTenant();
            // Récupère tous les utilisateurs associés au tenant (companyId)
            const q = query(collection(db, 'users'), where('companyId', '==', companyId));
            const querySnapshot = await getDocs(q);
            
            const usersList = [];
            querySnapshot.forEach((docRef) => {
                usersList.push({ id: docRef.id, ...docRef.data() });
            });

            // Trier alphabétiquement par nom
            usersList.sort((a, b) => {
                const nameA = a.name || a.email || '';
                const nameB = b.name || b.email || '';
                return nameA.localeCompare(nameB);
            });

            set({ users: usersList, isLoading: false });
            return usersList;
        } catch (error) {
            console.error("Erreur lors de la récupération des utilisateurs:", error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateUserProfile: async (uid, profileData) => {
        set({ isLoading: true, error: null });
        try {
            const companyId = requireTenant();
            const userRef = doc(db, 'users', uid);
            
            // Assure que le companyId est maintenu
            const dataToUpdate = { ...profileData, companyId };
            
            await setDoc(userRef, dataToUpdate, { merge: true });

            // Mettre à jour l'état local
            const currentUsers = get().users;
            const updatedUsers = currentUsers.map(u => 
                u.id === uid ? { ...u, ...dataToUpdate } : u
            );
            
            set({ users: updatedUsers, isLoading: false });
        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil:", error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    createUserProfile: async (profileData, password) => {
        set({ isLoading: true, error: null });
        try {
            const companyId = requireTenant();
            
            // 1. Initialiser une application Firebase secondaire
            // Cela permet de créer un utilisateur Auth sans déconnecter l'administrateur actuel
            const secondaryApp = initializeApp(primaryApp.options, 'SecondaryApp');
            const secondaryAuth = getAuth(secondaryApp);
            
            // 2. Créer l'utilisateur dans Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, profileData.email, password);
            const uid = userCredential.user.uid;
            
            // 3. Supprimer l'application secondaire pour nettoyer
            await deleteApp(secondaryApp);
            
            // 4. Créer le profil Firestore avec le VRAI UID
            const userRef = doc(db, 'users', uid);
            const dataToCreate = { ...profileData, companyId };
            await setDoc(userRef, dataToCreate);
            
            // 5. Mettre à jour l'état local
            const currentUsers = get().users;
            const updatedUsers = [...currentUsers, { id: uid, ...dataToCreate }];
            
            updatedUsers.sort((a, b) => {
                const nameA = a.name || a.email || '';
                const nameB = b.name || b.email || '';
                return nameA.localeCompare(nameB);
            });
            
            set({ users: updatedUsers, isLoading: false });
            return uid;
        } catch (error) {
            console.error("Erreur lors de la création de l'utilisateur:", error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    }
}));

export default useUserStore;
