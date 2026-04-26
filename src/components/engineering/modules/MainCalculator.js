import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import TooltipIcon from '../tooltip/TooltipIcon';
import usePilingStore from '../../../store/usePilingStore';
import { calculatePilingData } from '../../../utils/engineeringMath';

export default function MainCalculator() {
    const store = usePilingStore();

    // Dictionnaire des Calibres (Gauges)
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

    // Data Engine : Runs the math dynamically when state changes
    const resultData = useMemo(() => {
        const gauge = gauges[store.selectedGaugeIdx] || gauges[0];
        const ID = gauge.od - (2 * gauge.t);
        const areaIn2 = (Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2));
        const areaMm2 = areaIn2 * 645.16;
        const inertiaIn4 = (Math.PI / 64) * (Math.pow(gauge.od, 4) - Math.pow(ID, 4));
        const inertiaMm4 = inertiaIn4 * 416231.426;

        const dataPayload = {
            targetRu: parseFloat(store.targetRu) || 0,
            efficiency: parseFloat(store.efficiency) || 55,
            hammerWeightKg: hammers[store.selectedHammerIdx]?.weightKg || 1500,
            dropHeight: parseFloat(store.dropHeight) || 0,
            lengthUnderHammer: parseFloat(store.lengthUnderHammer) || 0,
            exposedLength: parseFloat(store.exposedLength) || 0,
            soilReboundC3: parseFloat(store.soilReboundC3) || 2.5,
            areaMm2,
            inertiaMm4,
            elasticModulusMPa: 200000, 
            linearWeightKgPerMeter: gauge.weight
        };

        return calculatePilingData(dataPayload);
    }, [
        store.targetRu, store.efficiency, store.selectedHammerIdx, store.dropHeight,
        store.lengthUnderHammer, store.exposedLength, store.soilReboundC3, store.selectedGaugeIdx
    ]);

    // Handle blows per batch conversion
    const setPerBatchRaw = resultData.refusalTargetMm * store.blowsPerBatch;
    const finalSetDisplay = setPerBatchRaw > 0 ? setPerBatchRaw.toFixed(1) : "0.0";

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
            
            {/* ZONE A: Paramètres */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Propriétés du Pieu</Text>
                
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Calibre de l'Acier</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={store.selectedGaugeIdx}
                            onValueChange={(val) => store.updateField('selectedGaugeIdx', Number(val))}
                            style={{ color: '#000' }}
                            dropdownIconColor="#000"
                        >
                            {gauges.map((g, i) => <Picker.Item key={i} label={g.label} value={i} />)}
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Longueur sous le marteau (pi)</Text>
                    <TextInput 
                        style={styles.highInput} 
                        keyboardType="numeric" 
                        value={store.lengthUnderHammer.toString()} 
                        onChangeText={(v) => store.updateField('lengthUnderHammer', v)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Longueur hors sol (pi)</Text>
                        <TooltipIcon 
                            title="Longueur hors sol" 
                            text="La portion du tuyau qui dépasse dans les airs. Sert à calculer la limite de flambement (Euler). Plus le tuyau est long hors de terre, plus le risque qu'il plie sous un grand coup est élevé." 
                        />
                    </View>
                    <TextInput 
                        style={styles.highInput} 
                        keyboardType="numeric" 
                        value={store.exposedLength.toString()} 
                        onChangeText={(v) => store.updateField('exposedLength', v)}
                    />
                </View>

            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Données de Frappe & Sol</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Cible Géotechnique / Charge ultime (kN)</Text>
                    <TextInput 
                        style={[styles.highInput, { borderColor: '#1976D2', borderWidth: 2 }]} 
                        keyboardType="numeric" 
                        value={store.targetRu.toString()} 
                        onChangeText={(v) => store.updateField('targetRu', v)}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Marteau utilisé</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={store.selectedHammerIdx}
                            onValueChange={(val) => {
                                const idx = Number(val);
                                store.updateField('selectedHammerIdx', idx);
                                if (hammers[idx] && hammers[idx].defaultEfficiency) {
                                    store.updateField('efficiency', hammers[idx].defaultEfficiency);
                                }
                            }}
                            style={{ color: '#000' }}
                            dropdownIconColor="#000"
                        >
                            {hammers.map((h, i) => <Picker.Item key={i} label={h.name || h.label} value={i} />)}
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Efficacité du Marteau (%)</Text>
                        <TooltipIcon 
                            title="Efficacité (%)" 
                            text="Représente la perte d'énergie dans les câbles et le treuil de la grue. Un marteau à chute libre (drop hammer) standard tourne autour de 55 % à 60 %." 
                        />
                    </View>
                    <TextInput 
                        style={styles.highInput} 
                        keyboardType="numeric" 
                        value={store.efficiency.toString()} 
                        onChangeText={(v) => store.updateField('efficiency', v)}
                    />
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

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Rebond du Sol (c3 - mm)</Text>
                        <TooltipIcon 
                            title="Rebond du Sol" 
                            text="La compression élastique (l'effet trampoline) du sol sous la pointe du pieu. Références : Till très dense = 2.5 mm | Roc rigide = 2.0 mm | Roc massif pur = 1.5 mm." 
                        />
                    </View>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={store.soilReboundC3}
                            onValueChange={(val) => store.updateField('soilReboundC3', Number(val))}
                            style={{ color: '#000' }}
                            dropdownIconColor="#000"
                        >
                            <Picker.Item label="Till très dense (2.5 mm)" value={2.5} />
                            <Picker.Item label="Roc rigide (2.0 mm)" value={2.0} />
                            <Picker.Item label="Roc massif pur (1.5 mm)" value={1.5} />
                            <Picker.Item label="Sable (3.0 mm)" value={3.0} />
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Coups par volée (Préférence)</Text>
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

            </View>

            {/* ZONE B: Alertes Dynamiques */}
            {resultData.alerts.length > 0 && (
                <View style={styles.alertsContainer}>
                    {resultData.alerts.map((alert, idx) => (
                        <View key={idx} style={[styles.alertBox, alert.type === 'DANGER' ? styles.alertDanger : styles.alertWarning]}>
                            <Text style={styles.alertText}>{alert.message}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* SPACER FOR STICKY BOTTOM */}
            <View style={{height: 120}}></View>

            {/* ZONE C: Le Résultat (Sticky Overlay simulates a heavy bottom sheet) */}
        </ScrollView>
    );
}

// L'export séparé permet de l'envelopper ou de le réutiliser. 
// Le résultat est mis dans un overlay fixe hors ScrollView depuis le parent EngineeringScreen pour être "Sticky Bottom".

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5' // High contrast light background
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
        color: '#212121', // Very dark grey/black
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
        height: 60, // Minimum height for gloves
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 18,
        color: '#000'
    },
    pickerContainer: {
        height: 60,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        backgroundColor: '#FAFAFA',
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
        backgroundColor: '#1976D2' // High contrast action blue
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
    }
});
