import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { theme } from '../theme/Theme';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getTenantQuery } from '../utils/firestore-tenant';
import useUserStore from '../store/useUserStore';
import useProjectStore from '../store/useProjectStore';
import useTimesheetStore from '../store/useTimesheetStore';
import { exportToPayrollCSV } from '../services/payrollExportService';
import { Ionicons } from '@expo/vector-icons';

export default function AdminPayrollDashboard() {
    const { users, fetchUsers } = useUserStore();
    const { projects } = useProjectStore();
    const { submitTimesheetEntry, fetchTimesheetEntries } = useTimesheetStore();
    
    const [loading, setLoading] = useState(true);
    const [shifts, setShifts] = useState([]);
    const [approvedEntries, setApprovedEntries] = useState([]);
    const [groupedData, setGroupedData] = useState([]);
    
    const [weeklyOvertimeThreshold, setWeeklyOvertimeThreshold] = useState('40');

    const loadData = async () => {
        setLoading(true);
        try {
            await fetchUsers();
            const approved = await fetchTimesheetEntries();
            setApprovedEntries(approved);

            // Charger les Punches (shifts terminés)
            const q = getTenantQuery('shifts');
            const snap = await getDocs(q);
            const allShifts = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.punchOutTime !== null && s.durationH > 0);
            
            setShifts(allShifts);
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (shifts.length > 0 && users.length > 0) {
            groupShiftsByEmployee();
        }
    }, [shifts, users, weeklyOvertimeThreshold, approvedEntries]);

    const groupShiftsByEmployee = () => {
        const threshold = parseFloat(weeklyOvertimeThreshold) || 40;
        const employeeMap = {};

        // Grouper par employé
        shifts.forEach(shift => {
            const empId = shift.userId;
            if (!employeeMap[empId]) {
                const user = users.find(u => u.id === empId);
                employeeMap[empId] = {
                    employeeId: empId,
                    name: user ? user.name : shift.userEmail,
                    totalHours: 0,
                    shifts: [],
                    trade: shift.trade || (user ? user.trade : ''),
                    sector: shift.sector || (user ? user.sector : ''),
                    isCCQ: shift.isCCQ !== false
                };
            }
            employeeMap[empId].totalHours += (shift.durationH || 0);
            employeeMap[empId].shifts.push(shift);
            // On peut peaufiner si l'employé a des shifts mixtes CCQ/non-CCQ, mais pour l'instant on garde le flag du dernier shift ou on gère globalement.
            // S'il a un mix, l'export forcera HORS-DECRET / SHOP sur isCCQ: false.
            if (shift.isCCQ === false) {
                employeeMap[empId].isCCQ = false;
            }
        });

        // Calcul des suggestions
        const grouped = Object.values(employeeMap).map(emp => {
            // Vérifier si déjà approuvé (simpliste: si une entrée existe pour cet employé récemment, on pourrait la masquer. Pour ce POC on affiche tout).
            const isApproved = approvedEntries.some(a => a.employeeId === emp.employeeId && a.status === 'approved');
            
            let suggestedReg = emp.totalHours;
            let suggestedOt15 = 0;
            
            if (emp.totalHours > threshold) {
                suggestedReg = threshold;
                suggestedOt15 = emp.totalHours - threshold;
            }

            return {
                ...emp,
                isApproved,
                regularHours: suggestedReg.toFixed(2),
                overtime15Hours: suggestedOt15.toFixed(2),
                overtime20Hours: '0',
                travelPremiums: '0'
            };
        });

        // Trier par nom
        grouped.sort((a,b) => a.name.localeCompare(b.name));
        setGroupedData(grouped);
    };

    const handleInputChange = (empId, field, value) => {
        setGroupedData(prev => prev.map(emp => 
            emp.employeeId === empId ? { ...emp, [field]: value } : emp
        ));
    };

    const handleApprove = async (emp) => {
        try {
            await submitTimesheetEntry({
                date: new Date().toISOString().split('T')[0], // Date d'approbation
                projectId: emp.shifts.length > 0 ? emp.shifts[0].projectId : '', // Optionnel, prendre le premier
                isCCQ: emp.isCCQ,
                trade: emp.trade,
                sector: emp.sector,
                regularHours: parseFloat(emp.regularHours) || 0,
                overtime15Hours: parseFloat(emp.overtime15Hours) || 0,
                overtime20Hours: parseFloat(emp.overtime20Hours) || 0,
                travelPremiums: parseFloat(emp.travelPremiums) || 0,
                employeeId: emp.employeeId, // Redondant mais sûr
                status: 'approved'
            });
            Alert.alert("Succès", `Heures approuvées pour ${emp.name}`);
            loadData(); // Rafraichir pour marquer comme approuvé
        } catch (e) {
            Alert.alert("Erreur", "Impossible d'approuver.");
        }
    };

    const handleExport = async () => {
        if (approvedEntries.length === 0) {
            Alert.alert("Info", "Aucune donnée approuvée à exporter.");
            return;
        }

        const enrichedEntries = approvedEntries.map(entry => {
             const user = users.find(u => u.id === entry.employeeId);
             const project = projects.find(p => p.id === entry.projectId);
             return {
                 ...entry,
                 employeeName: user ? user.name : entry.employeeId,
                 projectName: project ? project.name : entry.projectId
             };
        });

        const result = await exportToPayrollCSV(enrichedEntries);
        if (result.success) {
            Alert.alert("Succès", "Exportation CSV réussie.");
        } else {
            Alert.alert("Erreur", result.error || "L'exportation a échoué.");
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Paie Administrateur</Text>
                    <Text style={styles.subtitle}>Ventilation des Punches</Text>
                </View>
                <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                    <Ionicons name="document-text" size={20} color="white" />
                    <Text style={styles.exportButtonText}>Exporter CSV</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.settingsPanel}>
                <Text style={styles.label}>Seuil d'heures supplémentaires (Hebdo) :</Text>
                <TextInput 
                    style={styles.thresholdInput}
                    keyboardType="numeric"
                    value={weeklyOvertimeThreshold}
                    onChangeText={setWeeklyOvertimeThreshold}
                />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : groupedData.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>Aucun punch trouvé pour la période.</Text>
                </View>
            ) : (
                <ScrollView style={styles.list}>
                    {groupedData.map((emp) => (
                        <View key={emp.employeeId} style={[styles.card, emp.isApproved && styles.cardApproved]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.userName}>{emp.name}</Text>
                                <View style={styles.badgeContainer}>
                                    {emp.isApproved && <Text style={styles.approvedBadge}>APPROUVÉ</Text>}
                                    <Text style={[styles.ccqBadge, !emp.isCCQ && styles.nonCcqBadge]}>
                                        {emp.isCCQ ? `CCQ (${emp.trade})` : 'HORS-DÉCRET'}
                                    </Text>
                                </View>
                            </View>
                            
                            <View style={styles.totalRow}>
                                <Text style={styles.totalText}>Total Punches bruts :</Text>
                                <Text style={styles.totalValue}>{emp.totalHours.toFixed(2)} h</Text>
                            </View>

                            <View style={styles.inputsGrid}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Régulières</Text>
                                    <TextInput 
                                        style={styles.hourInput}
                                        value={emp.regularHours}
                                        onChangeText={(v) => handleInputChange(emp.employeeId, 'regularHours', v)}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>1.5x</Text>
                                    <TextInput 
                                        style={styles.hourInput}
                                        value={emp.overtime15Hours}
                                        onChangeText={(v) => handleInputChange(emp.employeeId, 'overtime15Hours', v)}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>2.0x</Text>
                                    <TextInput 
                                        style={styles.hourInput}
                                        value={emp.overtime20Hours}
                                        onChangeText={(v) => handleInputChange(emp.employeeId, 'overtime20Hours', v)}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Primes $</Text>
                                    <TextInput 
                                        style={styles.hourInput}
                                        value={emp.travelPremiums}
                                        onChangeText={(v) => handleInputChange(emp.employeeId, 'travelPremiums', v)}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {!emp.isApproved && (
                                <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(emp)}>
                                    <Text style={styles.approveButtonText}>Valider et Approuver</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        padding: 20,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    subtitle: {
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#27ae60', // Vert Excel
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    exportButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    settingsPanel: {
        padding: 15,
        backgroundColor: '#1a1a1a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    label: {
        color: 'white',
        fontSize: 14,
    },
    thresholdInput: {
        backgroundColor: theme.colors.surface,
        color: 'white',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        width: 60,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    list: {
        padding: 15,
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardApproved: {
        borderColor: '#27ae60',
        opacity: 0.8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 5,
    },
    approvedBadge: {
        backgroundColor: '#27ae60',
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    ccqBadge: {
        backgroundColor: '#2980b9',
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    nonCcqBadge: {
        backgroundColor: '#e67e22',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#111',
        padding: 10,
        borderRadius: 5,
        marginBottom: 15,
    },
    totalText: {
        color: theme.colors.textMuted,
    },
    totalValue: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    inputsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 5,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        marginBottom: 5,
        textAlign: 'center',
    },
    hourInput: {
        backgroundColor: '#111',
        color: 'white',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 5,
        padding: 8,
        textAlign: 'center',
        fontSize: 14,
    },
    approveButton: {
        backgroundColor: theme.colors.primary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 15,
    },
    approveButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
