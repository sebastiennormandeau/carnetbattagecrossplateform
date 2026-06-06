import { create } from 'zustand';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTenantQuery, requireTenant } from '../utils/firestore-tenant';

const useUserStore = create((set, get) => ({
    users: [],
    isLoading: false,
    error: null,

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
    
    // Note: La création réelle d'utilisateur dans Firebase Auth doit généralement
    // se faire via une Cloud Function pour les admins. 
    // Ici on crée le profil Firestore si besoin, mais l'Auth Firebase nécessite un workflow.
    // L'option la plus simple est d'appeler updateUserProfile pour créer/mettre à jour le doc de config.
    createUserProfile: async (uid, profileData) => {
        return await get().updateUserProfile(uid, profileData);
    }
}));

export default useUserStore;
