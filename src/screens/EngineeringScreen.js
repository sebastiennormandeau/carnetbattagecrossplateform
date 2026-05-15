import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MainCalculator from '../components/engineering/modules/MainCalculator';
import CapacityCalculator from '../components/engineering/modules/CapacityCalculator';
import usePilingStore from '../store/usePilingStore';
import { calculatePilingData } from '../utils/engineeringMath';

export default function EngineeringScreen() {
    const [activeTab, setActiveTab] = useState('MAIN'); // MAIN, INV_CAPACITY, INV_PDA
    const store = usePilingStore();
    const navigation = useNavigation();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('HammerConfig')}>
                    <Text style={{ color: '#1976D2', fontWeight: 'bold', fontSize: 16 }}>Config</Text>
                </TouchableOpacity>
            )
        });
    }, [navigation]);

    // Re-calculer rapidement le résultat pour l'afficher en Sticky Bottom
    // Ceci est léger donc on peut l'appeler pour récupérer le refusalTargetMm final
    const getFinalSet = () => {
        // Dictionnaire simplifié (les mêmes calibres que dans MainCalculator)
        const gauges = [
            { od: 4.5, t: 0.250, weight: 16.9 }, { od: 4.5, t: 0.290, weight: 19.36 },
            { od: 5.5, t: 0.304, weight: 24.96 }, { od: 5.5, t: 0.361, weight: 29.28 },
            { od: 5.5, t: 0.415, weight: 33.31 }, { od: 7.0, t: 0.317, weight: 33.72 },
            { od: 7.0, t: 0.362, weight: 38.25 }, { od: 7.0, t: 0.453, weight: 47.16 },
            { od: 9.625, t: 0.313, weight: 46.52 }, { od: 9.625, t: 0.352, weight: 52.0 },
            { od: 9.625, t: 0.395, weight: 58.07 }
        ];
        const hammers = store.availableHammers;
        
        const gauge = gauges[store.selectedGaugeIdx] || gauges[0];
        const ID = gauge.od - (2 * gauge.t);
        const areaMm2 = ((Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2))) * 645.16;
        const inertiaMm4 = ((Math.PI / 64) * (Math.pow(gauge.od, 4) - Math.pow(ID, 4))) * 416231.426;

        const activeHammer = hammers[store.selectedHammerIdx] || {};
        const capThicknessMm = (activeHammer.capThicknessIn || 7) * 25.4; 
        const capAreaMm2 = (activeHammer.capAreaSqIn || 240.25) * 645.16; 
        const capModulusMPa = activeHammer.capModulusMPa || 900;

        const dataPayload = {
            targetRu: parseFloat(store.targetRu) || 0,
            efficiency: parseFloat(store.efficiency) || 55,
            hammerWeightKg: activeHammer.weightKg || 1500,
            dropHeight: parseFloat(store.dropHeight) || 0,
            lengthUnderHammer: parseFloat(store.lengthUnderHammer) || 0,
            exposedLength: parseFloat(store.exposedLength) || 0,
            soilReboundC3: parseFloat(store.soilReboundC3) || 2.5,
            areaMm2, inertiaMm4, elasticModulusMPa: 200000, 
            linearWeightKgPerMeter: gauge.weight,
            capThicknessMm,
            capAreaMm2,
            capModulusMPa
        };

        const res = calculatePilingData(dataPayload);
        const totalSetForBatch = res.refusalTargetMm * store.blowsPerBatch;
        return totalSetForBatch > 0 ? totalSetForBatch.toFixed(1) : "0.0";
    };

    const finalResult = getFinalSet();

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                
                {/* HEADER TABS - High Contrast */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'MAIN' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('MAIN')}
                    >
                        <Text style={[styles.tabText, activeTab === 'MAIN' && styles.tabTextActive]}>M1: Cible Refus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'INV_CAPACITY' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('INV_CAPACITY')}
                    >
                        <Text style={[styles.tabText, activeTab === 'INV_CAPACITY' && styles.tabTextActive]}>M2: Capacité</Text>
                    </TouchableOpacity>
                </View>

                {/* CONTENT AREA */}
                <View style={styles.contentArea}>
                    {activeTab === 'MAIN' && <MainCalculator />}
                    {activeTab === 'INV_CAPACITY' && <CapacityCalculator />}
                </View>

                {/* STICKY BOTTOM RESULT FORMAT (Zone C) */}
                {activeTab === 'MAIN' && (
                    <View style={styles.stickyResultContainer}>
                        <Text style={styles.resultLabel}>CRITÈRE DE REFUS (HILEY)</Text>
                        <Text style={styles.resultValue}>{finalResult} mm <Text style={styles.resultSuffix}>pour {store.blowsPerBatch} coup(s)</Text></Text>
                    </View>
                )}

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#EEEEEE'
    },
    container: {
        flex: 1
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#E0E0E0',
        padding: 4
    },
    tabButton: {
        flex: 1,
        height: 64, // Touchable height for gloves
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E0E0E0',
        marginHorizontal: 2,
        borderRadius: 8
    },
    tabButtonActive: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 4,
        borderBottomColor: '#1976D2' // Action blue
    },
    tabText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#616161'
    },
    tabTextActive: {
        color: '#1976D2',
        fontSize: 15
    },
    contentArea: {
        flex: 1
    },
    constructionCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    constructionText: {
        fontSize: 18,
        color: '#9E9E9E',
        fontWeight: 'bold'
    },
    stickyResultContainer: {
        backgroundColor: '#FFEB3B', // High contrast vivid yellow for the result
        paddingTop: 16,
        paddingBottom: Platform.OS === 'android' ? 36 : 24, // Extra padding for Android nav bar
        paddingHorizontal: 20,
        borderTopWidth: 4,
        borderTopColor: '#F57F17',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    resultLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: '#424242',
        marginBottom: 4,
        letterSpacing: 1
    },
    resultValue: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#212121'
    },
    resultSuffix: {
        fontSize: 20,
        fontWeight: '600',
        color: '#424242'
    }
});
