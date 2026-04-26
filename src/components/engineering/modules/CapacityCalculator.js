import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import TooltipIcon from '../tooltip/TooltipIcon';
import usePilingStore from '../../../store/usePilingStore';
import { calculateInverseCapacity } from '../../../utils/engineeringMath';

export default function CapacityCalculator() {
    const store = usePilingStore();

    // Dictionnaire des Calibres (Gauges) - Doit correspondre à celui de MainCalculator pour les index
    const gauges = [
        { label: "4 1/2 0.250", od: 4.5, t: 0.250, weight: 16.9 }, 
        { label: "4 1/2 0.290", od: 4.5, t: 0.290, weight: 19.36 },
        { label: "5 1/2 0.304", od: 5.5, t: 0.304, weight: 24.96 },
        { label: "5 1/2 0.361", od: 5.5, t: 0.361, weight: 29.28 },
        { label: "5 1/2 0.415", od: 5.5, t: 0.415, weight: 33.31 },
        { label: "7 0.317", od: 7.0, t: 0.317, weight: 33.72 },
        { label: "7 0.362", od: 7.0, t: 0.362, weight: 38.25 },
        { label: "7 0.453", od: 7.0, t: 0.453, weight: 47.16 },
        { label: "9 5/8 0.313", od: 9.625, t: 0.313, weight: 46.52 },
        { label: "9 5/8 0.352", od: 9.625, t: 0.352, weight: 52.0 },
        { label: "9 5/8 0.395", od: 9.625, t: 0.395, weight: 58.07 }
    ];

    const [isMetric, setIsMetric] = useState(false);

    const hammers = store.availableHammers;

    const resultData = useMemo(() => {
        const gauge = gauges[store.selectedGaugeIdx] || gauges[0];
        const ID = gauge.od - (2 * gauge.t);
        const areaIn2 = (Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2));
        const areaMm2 = areaIn2 * 645.16;

        const refusalPerBlow = store.blowsPerBatch > 0 
            ? (parseFloat(store.measuredRefusal) || 0) / store.blowsPerBatch 
            : 0;

        const dataPayload = {
            measuredRefusal: refusalPerBlow,
            efficiency: parseFloat(store.efficiency) || 55,
            hammerWeightKg: hammers[store.selectedHammerIdx]?.weightKg || 1500,
            dropHeight: parseFloat(store.dropHeight) || 0,
            lengthUnderHammer: parseFloat(store.lengthUnderHammer) || 0,
            soilReboundC3: parseFloat(store.soilReboundC3) || 2.5,
            areaMm2,
            elasticModulusMPa: 200000, 
            linearWeightKgPerMeter: gauge.weight
        };

        return calculateInverseCapacity(dataPayload);
    }, [
        store.measuredRefusal, store.blowsPerBatch, store.efficiency, 
        store.selectedHammerIdx, store.dropHeight, store.lengthUnderHammer, 
        store.soilReboundC3, store.selectedGaugeIdx, store.availableHammers
    ]);

    const quickButtons = isMetric 
        ? [ { label: "1.0m", val: 1.0 }, { label: "1.2m", val: 1.2 }, { label: "1.5m", val: 1.5 }, { label: "2.0m", val: 2.0 } ]
        : [ { label: "3'", val: 0.9144 }, { label: "4'6\"", val: 1.3716 }, { label: "5'", val: 1.524 }, { label: "6'", val: 1.8288 } ];

    const handleStep = (direction) => {
        const currentMeters = parseFloat(store.dropHeight) || 0;
        if (isMetric) {
            store.updateField('dropHeight', Math.max(0, currentMeters + (direction * 0.1)).toFixed(2));
        } else {
            // Step by 3 inches (0.25 ft = 0.0762m)
            store.updateField('dropHeight', Math.max(0, currentMeters + (direction * 0.0762)).toFixed(3));
        }
    };

    const [isFocused, setIsFocused] = useState(false);
    const [localDropHeight, setLocalDropHeight] = useState("");

    // Sync local input with store, except when user is typing
    React.useEffect(() => {
        if (!isFocused) {
            const dh = parseFloat(store.dropHeight) || 0;
            setLocalDropHeight(isMetric ? dh.toFixed(2) : (dh * 3.28084).toFixed(2));
        }
    }, [store.dropHeight, isMetric, isFocused]);

    const handleManualInput = (val) => {
        setLocalDropHeight(val);
        const num = parseFloat(val.replace(',', '.')); // Accept commas for French keyboards
        if (!isNaN(num)) {
            store.updateField('dropHeight', isMetric ? num : num / 3.28084);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Relevé de Chantier</Text>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Refus mesuré (mm)</Text>
                        <TooltipIcon 
                            title="Refus Mesuré" 
                            text="La distance exacte d'enfoncement du pieu observée sur la dernière volée de coups." 
                        />
                    </View>
                    <TextInput 
                        style={[styles.highInput, { borderColor: '#1976D2', borderWidth: 2 }]} 
                        keyboardType="numeric" 
                        value={store.measuredRefusal.toString()} 
                        onChangeText={(v) => store.updateField('measuredRefusal', v)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nombre de coups de la volée</Text>
                    <View style={styles.quickLaunchRow}>
                        {[1, 4, 10].map((num) => (
                            <TouchableOpacity 
                                key={num}
                                style={[styles.quickButton, store.blowsPerBatch === num && styles.quickButtonActive]}
                                onPress={() => store.updateField('blowsPerBatch', num)}
                            >
                                <Text style={[styles.quickButtonText, store.blowsPerBatch === num && {color: 'white'}]}>{num} coup{num > 1 && 's'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                        <Text style={styles.label}>Hauteur de chute</Text>
                        <TouchableOpacity onPress={() => setIsMetric(!isMetric)} style={styles.unitToggleBtn}>
                            <Text style={styles.unitToggleText}>{isMetric ? "📏 Mètres" : "📏 Pieds/Pouces"}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.quickLaunchRow}>
                        {quickButtons.map((btn, idx) => (
                            <TouchableOpacity 
                                key={idx}
                                style={[styles.quickButton, Math.abs(store.dropHeight - btn.val) < 0.01 && styles.quickButtonActive]}
                                onPress={() => store.updateField('dropHeight', btn.val)}
                            >
                                <Text style={[styles.quickButtonText, Math.abs(store.dropHeight - btn.val) < 0.01 && {color: 'white'}]}>{btn.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={[styles.quickLaunchRow, {marginTop: 10}]}>
                        <TouchableOpacity style={styles.stepButton} onPress={() => handleStep(-1)}>
                            <Text style={styles.stepButtonText}>{isMetric ? "-10 cm" : "-3 po"}</Text>
                        </TouchableOpacity>
                        
                        <View style={[styles.highInput, {flex: 2, marginHorizontal: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0}]}>
                            <TextInput 
                                style={{flex: 1, fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#000', height: '100%'}} 
                                keyboardType="numeric" 
                                value={localDropHeight} 
                                onChangeText={handleManualInput}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />
                            <Text style={{fontSize: 16, color: '#757575', fontWeight: 'bold', marginRight: 15}}>{isMetric ? 'm' : 'pi'}</Text>
                        </View>

                        <TouchableOpacity style={styles.stepButton} onPress={() => handleStep(1)}>
                            <Text style={styles.stepButtonText}>{isMetric ? "+10 cm" : "+3 po"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ZONE B: Alertes Dynamiques */}
            {resultData.alerts && resultData.alerts.length > 0 && (
                <View style={styles.alertsContainer}>
                    {resultData.alerts.map((alert, idx) => (
                        <View key={idx} style={[styles.alertBox, alert.type === 'DANGER' ? styles.alertDanger : styles.alertWarning]}>
                            <Text style={styles.alertText}>{alert.message}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* ZONE C: RÉSULTATS */}
            <View style={styles.resultCard}>
                <Text style={styles.resultSubLabel}>Capacité Ultime Estimée (Ru)</Text>
                <Text style={styles.resultSmallValue}>{resultData.targetRu > 0 ? resultData.targetRu.toFixed(0) : 0} kN</Text>
                
                <View style={styles.divider} />
                
                <Text style={styles.resultLabel}>CAPACITÉ ADMISSIBLE</Text>
                <Text style={styles.resultGiantValue}>{resultData.admissibleCapacityKn > 0 ? resultData.admissibleCapacityKn.toFixed(0) : 0} <Text style={styles.resultGiantSuffix}>kN</Text></Text>
                <Text style={styles.resultFsText}>(Facteur de Sécurité: 2.0)</Text>
            </View>

            <View style={{height: 40}}></View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5' 
    },
    scrollContent: {
        padding: 16
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#212121',
        marginBottom: 16,
        textTransform: 'uppercase'
    },
    inputGroup: {
        marginBottom: 20
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#424242',
        marginBottom: 8
    },
    highInput: {
        height: 60,
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 18,
        color: '#000'
    },
    quickLaunchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    quickButton: {
        flex: 1,
        height: 56,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 4,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    quickButtonActive: {
        backgroundColor: '#1976D2' 
    },
    quickButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
    },
    alertsContainer: {
        marginBottom: 20
    },
    alertBox: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 6
    },
    alertDanger: {
        backgroundColor: '#FFEBEE',
        borderLeftColor: '#D32F2F'
    },
    alertWarning: {
        backgroundColor: '#FFF3E0',
        borderLeftColor: '#F57C00'
    },
    alertText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#212121'
    },
    stepButton: {
        flex: 1,
        height: 60,
        backgroundColor: '#424242',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    stepButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF'
    },
    unitToggleBtn: {
        backgroundColor: '#E0E0E0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16
    },
    unitToggleText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1976D2'
    },
    resultCard: {
        backgroundColor: '#FFEB3B', // High contrast vivid yellow
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        borderTopWidth: 6,
        borderTopColor: '#F57F17',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    resultSubLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#616161',
        marginBottom: 4
    },
    resultSmallValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#424242',
    },
    divider: {
        height: 2,
        backgroundColor: '#F57F17',
        width: '50%',
        marginVertical: 16
    },
    resultLabel: {
        fontSize: 18,
        fontWeight: '900',
        color: '#424242',
        marginBottom: 8,
        letterSpacing: 1
    },
    resultGiantValue: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#212121'
    },
    resultGiantSuffix: {
        fontSize: 24,
        fontWeight: '600',
        color: '#424242'
    },
    resultFsText: {
        fontSize: 14,
        color: '#616161',
        marginTop: 8,
        fontStyle: 'italic'
    }
});
