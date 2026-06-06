import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const exportToPayrollCSV = async (timesheetEntries) => {
    try {
        // En-têtes CSV avec séparateur ';' (Idéal pour Excel francophone)
        const headers = [
            "Date",
            "Employe",
            "Projet",
            "Est_CCQ",
            "Metier",
            "Secteur",
            "Heures_Regulieres",
            "Temps_Demi_1_5",
            "Temps_Double_2_0",
            "Primes_Deplacement"
        ];

        let csvContent = headers.join(';') + '\n';

        timesheetEntries.forEach(entry => {
            // Forcer les valeurs pour les projets non-CCQ au cas où
            const isCCQ = entry.isCCQ !== false;
            const trade = isCCQ ? (entry.trade || '') : 'SHOP';
            const sector = isCCQ ? (entry.sector || '') : 'HORS-DECRET';

            const row = [
                entry.date || '',
                entry.employeeId || '',
                entry.projectId || '',
                isCCQ ? 'OUI' : 'NON',
                trade,
                sector,
                entry.regularHours || 0,
                entry.overtime15Hours || 0,
                entry.overtime20Hours || 0,
                entry.travelPremiums || 0
            ];

            // Échapper les guillemets ou points-virgules potentiels dans les champs textes
            const formattedRow = row.map(item => {
                const strItem = String(item);
                if (strItem.includes(';') || strItem.includes('"')) {
                    return `"${strItem.replace(/"/g, '""')}"`;
                }
                return strItem;
            });

            csvContent += formattedRow.join(';') + '\n';
        });

        // Créer un nom de fichier unique
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `Export_Paie_Externe_${timestamp}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;

        // Écrire le fichier localement
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

        // Partager le fichier (ce qui permet de l'enregistrer dans les Fichiers ou de l'envoyer par email)
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Exporter les données de paie'
            });
            return { success: true, fileUri };
        } else {
            console.warn("Le partage n'est pas disponible sur cet appareil.");
            return { success: false, error: "Partage non supporté" };
        }
    } catch (error) {
        console.error("Erreur lors de l'exportation CSV:", error);
        return { success: false, error: error.message };
    }
};
