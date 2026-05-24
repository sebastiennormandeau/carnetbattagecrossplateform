const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

const { onCall, HttpsError } = require("firebase-functions/v2/https");

// ... (code existant pour setCompanyCustomClaim) ...

exports.setCompanyCustomClaim = onDocumentWritten("users/{userId}", async (event) => {
    const change = event.data;
    const userId = event.params.userId;

    // Si le document a ete supprime, on nettoie les claims
    if (!change.after.exists) {
        await admin.auth().setCustomUserClaims(userId, null);
        return null;
    }

    const newValue = change.after.data();
    const companyId = newValue.companyId;
    const role = newValue.role;

    // Preparation des Custom Claims
    const claims = {};
    if (companyId) claims.companyId = companyId;
    if (role) claims.role = role;

    try {
        // Injection magique dans Firebase Auth
        await admin.auth().setCustomUserClaims(userId, claims);
        console.log(`Claims a jour pour ${userId}:`, claims);
        return null;
    } catch (error) {
        console.error("Erreur mise a jour claims:", error);
        return null;
    }
});

/**
 * ARCHITECTURE DES DONNÉES (Payload API)
 * Ce payload est généré par l'application mobile et envoyé à cette Cloud Function.
 * 
 * Modèle JSON attendu par la fonction (apiPayload) :
 * {
 *   "companyId": "comp_abc",
 *   "payrollPeriod": { "start": "2026-05-15", "end": "2026-05-21" },
 *   "employeeProfile": {
 *     "id": "emp_123",
 *     "ccqTradeCode": "512", // Opérateur de pelle
 *     "ccqStatus": "compagnon",
 *     "unionCode": "791"
 *   },
 *   "timesheet": {
 *     "regularHours": 40.0,
 *     "timeAndHalfHours": 5.0,
 *     "doubleHours": 0.0
 *   },
 *   "allowances": {
 *     "travelKm": 120
 *   }
 * }
 */

// L'API GATEWAY (Cloud Function Firebase)
exports.syncPayrollData = onCall(async (request) => {
    const payload = request.data;
    const auth = request.auth;

    // 1. Validation de sécurité (vérifier que l'utilisateur est connecté et fait partie de la compagnie)
    if (!auth) {
        throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    
    // Le companyId du payload doit correspondre au tenant (Custom Claim) de l'utilisateur
    if (payload.companyId !== auth.token.companyId) {
        throw new HttpsError("permission-denied", "Accès refusé pour cette compagnie.");
    }

    try {
        console.log(`Envoi du payload à l'API de paie (Nethris/EmployeurD) pour ${payload.employeeProfile.id}...`);
        
        // 2. Appel POST simulé vers l'API de paie externe
        // ex: const response = await axios.post('https://api.nethris.com/v1/calculate', payload, { headers: { 'Authorization': `Bearer ${API_KEY}` } });
        // Pour cet exemple, nous retournons un objet mocké qui représente exactement la réponse de l'API.

        const baseRate = 45.50;
        const regPay = payload.timesheet.regularHours * baseRate;
        const timeHalfPay = payload.timesheet.timeAndHalfHours * (baseRate * 1.5);
        const doublePay = payload.timesheet.doubleHours * (baseRate * 2.0);
        const workedSubtotal = regPay + timeHalfPay + doublePay;

        const vacation13Percent = workedSubtotal * 0.13;
        
        const travelAllowance = payload.allowances.travelKm * 0.68;

        // Réponse formatée pour TransparentPaySlip.js
        const apiResponse = {
            period: payload.payrollPeriod,
            rates: { base: baseRate },
            hours: {
                regular: payload.timesheet.regularHours,
                timeAndHalf: payload.timesheet.timeAndHalfHours,
                double: payload.timesheet.doubleHours
            },
            grossPay: {
                regular: regPay,
                timeAndHalf: timeHalfPay,
                double: doublePay,
                workedSubtotal: workedSubtotal
            },
            ccq: {
                vacationAdded: vacation13Percent,
                vacationDeducted: vacation13Percent, // Retenu à 100%
                benefits: 185.50, // Calcul API
                unionDues: 32.15  // Calcul API
            },
            taxes: {
                federal: 310.20,
                provincial: 345.10,
                rrq: 110.55,
                rqap: 12.45,
                ei: 28.90,
                totalTaxes: 807.20 // Somme calculée par API
            },
            allowances: {
                kmCount: payload.allowances.travelKm,
                travel: travelAllowance,
                total: travelAllowance
            },
            // Le Net est calculé par l'API: (Brut + Vacances) - (Vacances + Taxes + CCQ) + Indemnités
            netPay: (workedSubtotal - 807.20 - 185.50 - 32.15) + travelAllowance
        };

        return apiResponse; // Retourné directement à l'app React Native
    } catch (error) {
        console.error("Erreur de l'API de paie externe:", error);
        throw new HttpsError("internal", "Erreur lors de la communication avec le moteur de paie.");
    }
});

const { onRequest } = require("firebase-functions/v2/https");

exports.migrateCompanyId = onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const companyId = "VibeCodingMind";
        const collections = ['hammers', 'projects', 'users', 'calendar_events', 'map_points', 'settings', 'shifts'];
        
        let totalUpdated = 0;
        let logs = [];

        // 1. Migrate regular collections for companyId
        for (const collName of collections) {
            const snapshot = await db.collection(collName).get();
            const batch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.companyId || data.companyId !== companyId) {
                    batch.set(doc.ref, { companyId: companyId }, { merge: true });
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                logs.push(`Migrated ${count} docs in ${collName}`);
                totalUpdated += count;
            }
        }

        // 2. Migrate admins collection to role: 'admin' in users collection
        const adminsSnapshot = await db.collection('admins').get();
        const adminBatch = db.batch();
        let adminsCount = 0;

        adminsSnapshot.forEach(doc => {
            if (doc.data().enabled === true) {
                // The doc.id is the user's UID
                const userRef = db.collection('users').doc(doc.id);
                adminBatch.set(userRef, { role: 'admin' }, { merge: true });
                adminsCount++;
            }
        });

        if (adminsCount > 0) {
            await adminBatch.commit();
            logs.push(`Migrated ${adminsCount} admins to role: 'admin'`);
        }

        res.send(`Migration terminée avec succès. ${totalUpdated} documents mis à jour avec le companyId: ${companyId}. ${adminsCount} admins migrés. \nLogs: \n${logs.join('\n')}`);
    } catch (error) {
        console.error("Erreur migration:", error);
        res.status(500).send("Erreur lors de la migration: " + error.message);
    }
});
