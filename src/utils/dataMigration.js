import { collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { requireTenant } from './firestore-tenant';
import { Alert } from 'react-native';

export const migrateOldDataToVibeCodingMind = async () => {
    try {
        const tenantId = requireTenant();
        if (!tenantId) {
            Alert.alert("Erreur", "Aucun tenantId (compagnie) actif. Connectez-vous d'abord en tant que Vibe Coding Mind.");
            return;
        }

        let totalUpdated = 0;

        // Collections principales à vérifier
        const collectionsToMigrate = ['projects', 'users', 'map_points', 'calendar_events', 'shifts', 'timesheet_entries', 'hammers'];

        for (const collName of collectionsToMigrate) {
            const snapshot = await getDocs(collection(db, collName));
            let batch = writeBatch(db);
            let batchCount = 0;

            for (const document of snapshot.docs) {
                const data = document.data();
                // Si pas de companyId ou s'il est différent du tenant actuel (ex: 'vibecodingmind' au lieu de 'Vibe Coding Mind')
                if (!data.companyId || data.companyId !== tenantId) {
                    batch.update(doc(db, collName, document.id), { companyId: tenantId });
                    batchCount++;
                    totalUpdated++;

                    // Firestore limite les batch à 500 opérations
                    if (batchCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            console.log(`Migration de la collection ${collName} terminée.`);
        }

        Alert.alert("Succès", `Migration terminée. ${totalUpdated} documents ont été mis à jour avec la compagnie : ${tenantId}`);
    } catch (error) {
        console.error("Erreur lors de la migration :", error);
        Alert.alert("Erreur", "La migration a échoué. Vérifiez la console. " + error.message);
    }
};
