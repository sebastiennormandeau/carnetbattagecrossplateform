import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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
                entry.employeeName || entry.employeeId || '',
                entry.projectName || entry.projectId || '',
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

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `Export_Paie_Externe_${timestamp}.csv`;

        if (Platform.OS === 'web') {
            // Web: Create a Blob and trigger a download via <a> tag
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return { success: true, message: "Fichier téléchargé" };
        } else {
            // Mobile: Write to local file and use expo-sharing
            const file = new File(Paths.document, fileName);

            // Écrire le fichier localement
            file.write(csvContent);
            console.log("CSV de paie sauvegardé dans :", file.uri);

            // Partager le fichier
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(file.uri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Exporter les données de paie'
                });
                return { success: true, fileUri: file.uri };
            } else {
                console.warn("Le partage n'est pas disponible sur cet appareil.");
                return { success: false, error: "Partage non supporté" };
            }
        }
    } catch (error) {
        console.error("Erreur lors de l'exportation CSV:", error);
        return { success: false, error: error.message };
    }
};
