import { create } from 'zustand';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { addTenantDoc, getTenantQuery } from '../utils/firestore-tenant';

const useTimesheetStore = create((set, get) => ({
    isLoading: false,
    error: null,
    
    submitTimesheetEntry: async (entryData) => {
        set({ isLoading: true, error: null });
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Non authentifié");

            const timesheetRef = collection(db, 'timesheet_entries');
            await addTenantDoc(timesheetRef, {
                ...entryData,
                employeeId: currentUser.uid,
                createdAt: new Date().toISOString(),
                status: 'pending' // pending, approved, exported
            });

            set({ isLoading: false });
        } catch (error) {
            console.error("Erreur lors de la soumission de la feuille de temps:", error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    fetchTimesheetEntries: async (startDate, endDate) => {
        set({ isLoading: true, error: null });
        try {
            const q = getTenantQuery('timesheet_entries');
            const querySnapshot = await getDocs(q);
            
            const entries = [];
            querySnapshot.forEach((docRef) => {
                const data = docRef.data();
                // Filtrage basique côté client
                if ((!startDate || data.date >= startDate) && (!endDate || data.date <= endDate)) {
                    entries.push({ id: docRef.id, ...data });
                }
            });

            // Trier par date descendante
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));

            set({ isLoading: false });
            return entries;
        } catch (error) {
            console.error("Erreur lors de la récupération des feuilles de temps:", error);
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },

    updateEntryStatus: async (entryId, status) => {
        try {
            const entryRef = doc(db, 'timesheet_entries', entryId);
            await updateDoc(entryRef, {
                status: status,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erreur lors de la mise à jour du statut:", error);
            throw error;
        }
    }
}));

export default useTimesheetStore;
