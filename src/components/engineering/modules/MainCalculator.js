import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import TooltipIcon from '../tooltip/TooltipIcon';
import usePilingStore from '../../../store/usePilingStore';
import { calculatePilingData, getC3FromSPT } from '../../../utils/engineeringMath';
import { generatePilingReport, generateRefusalChartPdf } from '../../../utils/pdfGenerator';

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
    const [soilInputMode, setSoilInputMode] = useState('manual');
    const [sptN, setSptN] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isGeneratingChart, setIsGeneratingChart] = useState(false);

    const hammers = store.availableHammers;

    const safeParse = (val) => parseFloat(String(val).replace(',', '.')) || 0;

    // Data Engine : Runs the math dynamically when state changes
    const resultData = useMemo(() => {
        const gauge = gauges[store.selectedGaugeIdx] || gauges[0];
        const ID = gauge.od - (2 * gauge.t);
        const areaIn2 = (Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2));
        const areaMm2 = areaIn2 * 645.16;
        const inertiaIn4 = (Math.PI / 64) * (Math.pow(gauge.od, 4) - Math.pow(ID, 4));
        const inertiaMm4 = inertiaIn4 * 416231.426;

        const activeHammer = hammers[store.selectedHammerIdx] || {};
        const capThicknessMm = (activeHammer.capThicknessIn || 7) * 25.4; 
        const capAreaMm2 = (activeHammer.capAreaSqIn || 240.25) * 645.16; 
        const capModulusMPa = activeHammer.capModulusMPa || 900;

        const standardLength = safeParse(store.lengthUnderHammer);
        const standardExposed = safeParse(store.exposedLength);
        const pdaLength = safeParse(store.pdaLength);
        
        let finalExposedLength = standardExposed;
        let pdaCutError = false;

        if (store.isPdaMode && pdaLength > 0 && standardLength > 0) {
            const buriedLength = standardLength - standardExposed;
            finalExposedLength = pdaLength - buriedLength;
            if (finalExposedLength < 0) {
                pdaCutError = true;
                finalExposedLength = 0;
            }
        }

        const dataPayload = {
            targetRu: safeParse(store.targetRu),
            efficiency: safeParse(store.efficiency) || 55,
            hammerWeightKg: activeHammer.weightKg || 1500,
            dropHeight: store.isPdaMode ? safeParse(store.pdaDropHeight) : safeParse(store.dropHeight),
            lengthUnderHammer: store.isPdaMode ? safeParse(store.pdaLength) : safeParse(store.lengthUnderHammer),
            exposedLength: finalExposedLength,
            soilReboundC3: safeParse(store.soilReboundC3) || 2.5,
            areaMm2,
            inertiaMm4,
            elasticModulusMPa: 200000, 
            linearWeightKgPerMeter: gauge.weight,
            steelGrade: store.steelGrade || 345,
            capThicknessMm,
            capAreaMm2,
            capModulusMPa
        };

        const res = calculatePilingData(dataPayload);
        
        if (pdaCutError) {
            res.alerts.unshift({
                type: 'DANGER',
                message: "Erreur : Coupe sous le niveau du sol. La nouvelle longueur totale est plus courte que la partie enfouie."
            });
            res.refusalTargetMm = 0;
        }
        res.dynamicExposedLength = finalExposedLength;
        return res;
    }, [
        store.targetRu, store.efficiency, store.selectedHammerIdx, store.dropHeight,
        store.lengthUnderHammer, store.exposedLength, store.soilReboundC3, store.selectedGaugeIdx,
        store.isPdaMode, store.pdaLength, store.pdaDropHeight, store.steelGrade
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

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        try {
            await generatePilingReport(store, resultData);
        } catch (error) {
            console.error("PDF Generation Error: ", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleGenerateChart = async () => {
        setIsGeneratingChart(true);
        try {
            await generateRefusalChartPdf(store);
        } catch (error) {
            console.error("Chart PDF Generation Error: ", error);
        } finally {
            setIsGeneratingChart(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            
            {/* PDA TOGGLE */}
            <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: store.isPdaMode ? '#00BCD4' : 'transparent', borderWidth: 2 }]}>
                <View>
                    <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>Mode PDA (Re-strike)</Text>
                    <Text style={styles.label}>Essai de chargement dynamique</Text>
                </View>
                <Switch 
                    value={store.isPdaMode} 
                    onValueChange={(val) => store.updateField('isPdaMode', val)} 
                    trackColor={{ false: "#767577", true: "#00BCD4" }}
                    thumbColor={store.isPdaMode ? "#ffffff" : "#f4f3f4"}
                />
            </View>

            {/* PDA INPUTS */}
            {store.isPdaMode && (
                <View style={[styles.card, { backgroundColor: 'rgba(0, 188, 212, 0.05)', borderColor: '#00BCD4', borderWidth: 1 }]}>
                    <Text style={[styles.sectionTitle, { color: '#008BA3' }]}>Paramètres du Pieu Coupé</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nouvelle longueur totale après coupe (pi)</Text>
                        <TextInput 
                            style={styles.highInput} 
                            keyboardType="numeric" 
                            value={store.pdaLength.toString()} 
                            onChangeText={(v) => store.updateField('pdaLength', v)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hauteur de chute pour le test PDA (m)</Text>
                        <TextInput 
                            style={styles.highInput} 
                            keyboardType="numeric" 
                            value={store.pdaDropHeight.toString()} 
                            onChangeText={(v) => store.updateField('pdaDropHeight', v)}
                        />
                    </View>
                </View>
            )}

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
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Grade de l'Acier (Limite d'élasticité)</Text>
                        <TooltipIcon 
                            title="Grade de l'acier" 
                            text="ASTM A252 Grade 3 (Pieux tubulaires standard) = 310 MPa. CSA G40.21 350W ou A500 Gr C (Acier structural) = 345 MPa." 
                        />
                    </View>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={store.steelGrade}
                            onValueChange={(val) => store.updateField('steelGrade', Number(val))}
                            style={{ color: '#000' }}
                            dropdownIconColor="#000"
                        >
                            <Picker.Item label="345 MPa (50 ksi - Structural / 350W)" value={345} />
                            <Picker.Item label="310 MPa (45 ksi - ASTM A252 Grade 3)" value={310} />
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
                    {store.isPdaMode ? (
                        <View style={[styles.highInput, { backgroundColor: '#E0E0E0', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 18, color: '#757575', fontWeight: 'bold' }}>
                                🔒 {resultData.dynamicExposedLength > 0 ? resultData.dynamicExposedLength.toFixed(1) : "0.0"} (Déduit de la coupe)
                            </Text>
                        </View>
                    ) : (
                        <TextInput 
                            style={styles.highInput} 
                            keyboardType="numeric" 
                            value={store.exposedLength.toString()} 
                            onChangeText={(v) => store.updateField('exposedLength', v)}
                        />
                    )}
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
                    <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text style={styles.label}>Rebond du Sol (c3)</Text>
                            <TooltipIcon 
                                title="Rebond du Sol" 
                                text="La compression élastique (l'effet trampoline) du sol sous la pointe du pieu. Références : Till très dense = 2.5 mm | Roc rigide = 2.0 mm | Roc massif pur = 1.5 mm." 
                            />
                        </View>
                        <TouchableOpacity 
                            onPress={() => setSoilInputMode(prev => prev === 'manual' ? 'spt' : 'manual')} 
                            style={styles.unitToggleBtn}
                        >
                            <Text style={styles.unitToggleText}>{soilInputMode === 'manual' ? "🔄 SPT" : "🔄 Manuel"}</Text>
                        </TouchableOpacity>
                    </View>

                    {soilInputMode === 'manual' ? (
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
                    ) : (
                        <View>
                            <TextInput 
                                style={[styles.highInput, { borderColor: '#1976D2', borderWidth: 2 }]} 
                                keyboardType="numeric" 
                                placeholder="Indice N (ex: 50)"
                                placeholderTextColor="#9e9e9e"
                                value={sptN} 
                                onChangeText={(v) => {
                                    setSptN(v);
                                    const c3Val = getC3FromSPT(v);
                                    store.updateField('soilReboundC3', c3Val);
                                }}
                            />
                            <Text style={{marginTop: 8, fontSize: 16, fontWeight: 'bold', color: '#1976D2'}}>
                                Rebond généré : {store.soilReboundC3} mm
                            </Text>
                        </View>
                    )}
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

            {/* PDA EXPLANATORY NOTE */}
            {store.isPdaMode && (
                <View style={[styles.alertBox, { backgroundColor: '#E0F7FA', borderLeftColor: '#00BCD4', marginBottom: 20 }]}>
                    <Text style={{ fontSize: 15, color: '#006064', fontWeight: '500', lineHeight: 22 }}>
                        <Text style={{ fontWeight: 'bold' }}>Note : </Text>
                        Un refus plus grand lors du test PDA est normal. Il est dû à la réduction de la masse du pieu et de la compression élastique (c2) suite à la coupe, et non à un relâchement du sol.
                    </Text>
                </View>
            )}

            {/* ZONE C: Action PDF */}
            <View style={styles.pdfActionContainer}>
                <TouchableOpacity 
                    style={styles.pdfButton} 
                    onPress={handleGeneratePdf}
                    disabled={isGeneratingPdf || isGeneratingChart}
                >
                    {isGeneratingPdf ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.pdfButtonText}>📄 Générer Note de Calcul PDF</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.chartButton} 
                    onPress={handleGenerateChart}
                    disabled={isGeneratingPdf || isGeneratingChart}
                >
                    {isGeneratingChart ? (
                        <ActivityIndicator color="#1976D2" />
                    ) : (
                        <Text style={styles.chartButtonText}>📊 Générer Abaque de Refus (Tous Calibres)</Text>
                    )}
                </TouchableOpacity>
            </View>

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
    },
    pdfActionContainer: {
        marginTop: 10,
        marginBottom: 20,
        alignItems: 'center'
    },
    pdfButton: {
        backgroundColor: '#1976D2',
        width: '100%',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        marginBottom: 10
    },
    pdfButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    chartButton: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        borderWidth: 2,
        borderColor: '#1976D2'
    },
    chartButtonText: {
        color: '#1976D2',
        fontSize: 16,
        fontWeight: 'bold'
    }
});
