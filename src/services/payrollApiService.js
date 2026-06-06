import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const syncTimesheetWithPayrollAPI = async (timesheetData, companyId) => {
    console.log(`[Payroll API] Préparation de la synchronisation pour la compagnie ${companyId}`);
    
    try {
        const calculatePayroll = httpsCallable(functions, 'calculatePayroll');
        
        // Construction du payload attendu par la Cloud Function
        const payload = {
            userId: timesheetData.userId || 'current_user_id',
            companyId: companyId,
            dateRange: { start: new Date().toISOString(), end: new Date().toISOString() }, // À dynamiser plus tard
            timesheetEntries: timesheetData.entries || [],
            payrollProvider: 'mock',
            nonTaxableAllowances: timesheetData.nonTaxableAllowances || 0
        };

        const response = await calculatePayroll(payload);
        console.log("[Payroll API] Données de paie reçues de la Cloud Function");
        
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error("[Payroll API] Erreur lors de l'appel de calculatePayroll:", error);
        return {
            success: false,
            error: error.message
        };
    }
};
