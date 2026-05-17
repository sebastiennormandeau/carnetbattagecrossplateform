/**
 * Calcule les résultats de battage et déclenche les alertes de sécurité (Hiley, Euler, Compression Acier)
 */
export function calculatePilingData(data) {
    const { 
        targetRu, efficiency, hammerWeightKg, dropHeight, 
        lengthUnderHammer, exposedLength, areaMm2, inertiaMm4, 
        elasticModulusMPa, soilReboundC3, linearWeightKgPerMeter,
        capThicknessMm, capAreaMm2, capModulusMPa
    } = data;

    let alerts = [];

    // --- 2. Calcul de l'Énergie et Force Maximale d'Impact (Ru_max sur refus absolu) ---
    const length_m = lengthUnderHammer * 0.3048;
    const massPileKg = length_m * linearWeightKgPerMeter;
    const FIXED_HELMET_WEIGHT_KG = 136;
    const totalStruckMassKg = massPileKg + FIXED_HELMET_WEIGHT_KG;
    
    const impactRatio = (hammerWeightKg + (0.2 * totalStruckMassKg)) / (hammerWeightKg + totalStruckMassKg);
    const hammerWeightKn = (hammerWeightKg * 9.81) / 1000;
    const energyKnMm = hammerWeightKn * (dropHeight * 1000);
    const effRatio = efficiency / 100;
    
    const availableEnergy = energyKnMm * effRatio * impactRatio;
    
    // Ru_max: Force générée si s = 0 (refus absolu sur le roc)
    // a*Ru^2 + b*Ru - Energy = 0
    const l_mm = lengthUnderHammer * 304.8;
    const c3 = soilReboundC3;
    
    const K_acier = l_mm / (areaMm2 * elasticModulusMPa);
    const K_cap = capThicknessMm / (capAreaMm2 * capModulusMPa);
    const a_max = (K_acier + K_cap) * 1000 / 2; // *1000 pour N -> kN
    const b_max = c3 / 2;
    
    let ruMaxKn = 0;
    const discriminantMax = Math.pow(b_max, 2) - (4 * a_max * (-availableEnergy));
    if (discriminantMax > 0) {
        ruMaxKn = (-b_max + Math.sqrt(discriminantMax)) / (2 * a_max);
    }

    // --- 3. Alerte Limite d'Acier (Configurable) ---
    const STEEL_YIELD_MPA = data.steelGrade || 345;
    const maxStructuralCapacityKn = (areaMm2 * STEEL_YIELD_MPA) / 1000;
    
    if (targetRu > maxStructuralCapacityKn) {
        alerts.push({
            type: 'DANGER',
            message: `Alerte : La charge cible (${targetRu.toFixed(0)} kN) dépasse la limite structurelle de l'acier (${maxStructuralCapacityKn.toFixed(0)} kN).`
        });
    } else if (ruMaxKn > maxStructuralCapacityKn) {
        const maxEnergyKnMm = (a_max * Math.pow(maxStructuralCapacityKn, 2)) + (b_max * maxStructuralCapacityKn);
        const safeEnergyKnMm = maxEnergyKnMm / (effRatio * impactRatio);
        const safeDropHeightM = safeEnergyKnMm / (hammerWeightKn * 1000);

        const safeDropHeightFt = safeDropHeightM / 0.3048;

        alerts.push({
            type: 'WARNING',
            message: `Attention : Sur un refus strict, l'impact de ce marteau générera ${ruMaxKn.toFixed(0)} kN, ce qui écrasera l'acier (Limite: ${maxStructuralCapacityKn.toFixed(0)} kN). Hauteur de chute max suggérée : ${safeDropHeightFt.toFixed(1)}' (${safeDropHeightM.toFixed(2)} m).`
        });
    }

    // --- 4. Alerte Flambement (Euler sur Exposed Length) ---
    const exposedLengthMm = exposedLength * 304.8; 
    let pcrKn = Infinity;
    
    if (exposedLengthMm > 0) {
        // K = 1.0 : On assume que la tête du pieu est guidée (rotule) par le casque/marteau, 
        // et que l'encastrement partiel dans le sol agit comme une seconde rotule.
        const K = 1.0;
        const effectiveLength = K * exposedLengthMm; 
        const pcrN = (Math.pow(Math.PI, 2) * elasticModulusMPa * inertiaMm4) / Math.pow(effectiveLength, 2);
        pcrKn = pcrN / 1000;

        if (targetRu > pcrKn) {
            alerts.push({
                type: 'DANGER',
                message: `Danger critique ! La charge cible dépasse la limite de flambement d'Euler (${pcrKn.toFixed(0)} kN).`
            });
        } else if (ruMaxKn > pcrKn) {
            // Calculer la hauteur de chute sécuritaire maximale (MaxEnergy = a * Pcr^2 + b * Pcr)
            // EnergyKnMm = MaxEnergy / (effRatio * impactRatio)
            const maxEnergyKnMm = (a_max * Math.pow(pcrKn, 2)) + (b_max * pcrKn);
            const safeEnergyKnMm = maxEnergyKnMm / (effRatio * impactRatio);
            // DropHeight = EnergyKnMm / (hammerWeightKn * 1000)
            const safeDropHeightM = safeEnergyKnMm / (hammerWeightKn * 1000);
            
            const safeDropHeightFt = safeDropHeightM / 0.3048;
            
            alerts.push({
                type: 'WARNING',
                message: `Danger de flambement ! Sur un sol dur, l'impact générera jusqu'à ${ruMaxKn.toFixed(0)} kN (> ${pcrKn.toFixed(0)} kN). Hauteur de chute max suggérée : ${safeDropHeightFt.toFixed(1)}' (${safeDropHeightM.toFixed(2)} m).`
            });
        }
    }

    // --- 5. Calcul de Hiley ---
    // b. Compressions Élastiques (c)
    // c2 = (Ru * L) / (A * E) - On s'assure de convertir Ru (kN) en Newtons
    const c2_mm = ((targetRu * 1000) * l_mm) / (areaMm2 * elasticModulusMPa);
    const c1_mm = ((targetRu * 1000) * capThicknessMm) / (capAreaMm2 * capModulusMPa);
    
    const c = c1_mm + c2_mm + c3;

    // c. Calcul du Refus (s)
    let refusalMm = -1;
    if (targetRu > 0) {
        refusalMm = (availableEnergy / targetRu) - (c / 2);
    }
    
    // --- 4. Alerte Refus Absolu ---
    if (refusalMm <= 0) {
        alerts.push({
            type: 'DANGER',
            message: "Erreur : Énergie du marteau insuffisante (Refus absolu)."
        });
        refusalMm = 0; // Lock à zero pour éviter les mesures négatives dans l'UI
    }

    // --- 6. Interception pour les chaînes d'avertissement bloquantes ---
    // S'il y a des alertes de sécurité graves, on remplace la valeur par une chaîne
    const hasSteelYieldDanger = alerts.some(a => a.message.includes("dépasse la limite structurelle") || a.message.includes("écrasera l'acier"));
    const hasBucklingDanger = alerts.some(a => a.message.includes("limite de flambement") || a.message.includes("Danger de flambement"));

    let finalRefusal = refusalMm;
    if (hasSteelYieldDanger) {
        finalRefusal = "⚠️ Déformation Acier";
    } else if (hasBucklingDanger) {
        finalRefusal = "⚠️ Risque Flambement";
    }

    return {
        refusalTargetMm: finalRefusal,
        maxStructuralKn: maxStructuralCapacityKn,
        pcrKn: pcrKn,
        c1: c1_mm,
        c2: c2_mm,
        impactRatio: impactRatio,
        totalCompression: c,
        alerts: alerts
    };
}

/**
 * Calcule la Capacité Ultime (Ru) à partir d'un refus mesuré (Mode Inversé)
 */
export function calculateInverseCapacity(data) {
    const { 
        measuredRefusal, efficiency, hammerWeightKg, dropHeight, 
        lengthUnderHammer, areaMm2, elasticModulusMPa, soilReboundC3, 
        linearWeightKgPerMeter,
        capThicknessMm, capAreaMm2, capModulusMPa
    } = data;

    // a. Ratio d'impact
    const length_m = lengthUnderHammer * 0.3048;
    const massPileKg = length_m * linearWeightKgPerMeter;
    const FIXED_HELMET_WEIGHT_KG = 136;
    const totalStruckMassKg = massPileKg + FIXED_HELMET_WEIGHT_KG;
    
    const impactRatio = (hammerWeightKg + (0.2 * totalStruckMassKg)) / (hammerWeightKg + totalStruckMassKg);

    // b. Paramètres d'énergie
    const hammerWeightKn = (hammerWeightKg * 9.81) / 1000;
    const energyKnMm = hammerWeightKn * (dropHeight * 1000);
    const effRatio = efficiency / 100;
    
    // c. Équation Quadratique pour Ru
    // Ru = (E * eff * ratio) / (s + c/2)
    // c = c1 + c3 + c2, où c2 = (Ru * L) / (A * E) et c1 = (Ru * t) / (A_cap * E_cap)
    // Donc: a*Ru^2 + b*Ru + c_eq = 0
    const c3 = soilReboundC3;
    const l_mm = lengthUnderHammer * 304.8;
    
    const K_acier = l_mm / (areaMm2 * elasticModulusMPa);
    const K_cap = capThicknessMm / (capAreaMm2 * capModulusMPa);

    const a = (K_acier + K_cap) * 1000 / 2; // *1000 pour Ru en kN
    const b = measuredRefusal + (c3 / 2);
    const c_eq = - (energyKnMm * effRatio * impactRatio);
    
    let targetRu = 0;
    const discriminant = Math.pow(b, 2) - (4 * a * c_eq);
    
    if (discriminant >= 0) {
        targetRu = (-b + Math.sqrt(discriminant)) / (2 * a);
    }
    
    // Limite Structurelle
    const STEEL_YIELD_MPA = 310;
    const maxStructuralCapacityKn = (areaMm2 * STEEL_YIELD_MPA) / 1000;
    
    let alerts = [];
    if (targetRu > maxStructuralCapacityKn) {
        alerts.push({
            type: 'DANGER',
            message: `La capacité calculée (${targetRu.toFixed(0)} kN) dépasse la limite de l'acier (${maxStructuralCapacityKn.toFixed(0)} kN).`
        });
    }

    return {
        targetRu: targetRu,
        admissibleCapacityKn: targetRu / 2, // F.S = 2.0 typique ou 2.25 selon le code
        maxStructuralKn: maxStructuralCapacityKn,
        alerts: alerts
    };
}

export function getC3FromSPT(nValue) {
    const N = parseFloat(String(nValue).replace(',', '.'));
    if (isNaN(N) || N <= 0) return 2.5; 
    if (N >= 100) return 1.5; 
    if (N < 10) return 4.0;   
    if (N >= 50 && N < 100) return Number((2.0 - ((N - 50) * 0.01)).toFixed(3));
    if (N >= 30 && N < 50) return Number((2.5 - ((N - 30) * 0.025)).toFixed(3));
    if (N >= 10 && N < 30) return Number((3.0 - ((N - 10) * 0.025)).toFixed(3));
    return 2.5;
}

/**
 * Calcule la hauteur de chute optimale pour un test PDA
 * L'enfoncement cible est fixé à 2.5 mm pour mobiliser le sol
 */
export function calculateOptimalPdaHeight(data) {
    const { 
        targetRu, efficiency, hammerWeightKg, 
        lengthUnderHammer, exposedLength, soilReboundC3, 
        areaMm2, inertiaMm4, elasticModulusMPa, linearWeightKgPerMeter,
        steelGrade, capThicknessMm, capAreaMm2, capModulusMPa
    } = data;

    if (!targetRu || targetRu <= 0) return null;

    const OPTIMAL_SET_MM = 2.5;
    
    // a. Impact Ratio
    const length_m = lengthUnderHammer * 0.3048;
    const massPileKg = length_m * linearWeightKgPerMeter;
    const FIXED_HELMET_WEIGHT_KG = 136;
    const totalStruckMassKg = massPileKg + FIXED_HELMET_WEIGHT_KG;
    
    const impactRatio = (hammerWeightKg + (0.2 * totalStruckMassKg)) / (hammerWeightKg + totalStruckMassKg);
    const effRatio = efficiency / 100;
    const hammerWeightKn = (hammerWeightKg * 9.81) / 1000;

    // b. Elastic compressions (c) for targetRu
    const l_mm = lengthUnderHammer * 304.8;
    const c3 = soilReboundC3 || 2.5;
    
    const K_acier = l_mm / (areaMm2 * elasticModulusMPa);
    const K_cap = capThicknessMm / (capAreaMm2 * capModulusMPa);
    
    // c2 = (Ru * L) / (A * E), Ru in N (targetRu * 1000)
    const c2_mm = ((targetRu * 1000) * l_mm) / (areaMm2 * elasticModulusMPa);
    const c1_mm = ((targetRu * 1000) * capThicknessMm) / (capAreaMm2 * capModulusMPa);
    const c = c1_mm + c2_mm + c3;

    // c. Hiley inversion to find Optimal Energy
    // Ru = E_avail / (s + c/2) => E_avail = Ru * (s + c/2)
    const requiredAvailableEnergyKnMm = targetRu * (OPTIMAL_SET_MM + c / 2);
    // E_avail = Energy * eff * n => Energy = E_avail / (eff * n)
    const requiredEnergyKnMm = requiredAvailableEnergyKnMm / (effRatio * impactRatio);
    
    // Energy = W * H => H = Energy / W
    let optimalHeightM = requiredEnergyKnMm / (hammerWeightKn * 1000);

    // d. Safety Check (Maximum Safe Height)
    const a_max = (K_acier + K_cap) * 1000 / 2; // *1000 pour N -> kN
    const b_max = c3 / 2;
    
    const STEEL_YIELD_MPA = steelGrade || 345;
    const maxStructuralCapacityKn = (areaMm2 * STEEL_YIELD_MPA) / 1000;
    
    const maxEnergyKnMm_steel = (a_max * Math.pow(maxStructuralCapacityKn, 2)) + (b_max * maxStructuralCapacityKn);
    const safeHeightM_steel = maxEnergyKnMm_steel / (effRatio * impactRatio) / (hammerWeightKn * 1000);

    let maxSafeHeightM = safeHeightM_steel;
    
    const exposedLengthMm = exposedLength * 304.8; 
    if (exposedLengthMm > 0) {
        const K = 1.0;
        const effectiveLength = K * exposedLengthMm; 
        const pcrN = (Math.pow(Math.PI, 2) * elasticModulusMPa * inertiaMm4) / Math.pow(effectiveLength, 2);
        const pcrKn = pcrN / 1000;
        
        const maxEnergyKnMm_euler = (a_max * Math.pow(pcrKn, 2)) + (b_max * pcrKn);
        const safeHeightM_euler = maxEnergyKnMm_euler / (effRatio * impactRatio) / (hammerWeightKn * 1000);
        
        maxSafeHeightM = Math.min(maxSafeHeightM, safeHeightM_euler);
    }
    
    let isCappedBySafety = false;
    let finalHeightM = optimalHeightM;
    // We cap it down, if it exceeds the max safe height
    if (optimalHeightM > maxSafeHeightM) {
        finalHeightM = maxSafeHeightM;
        isCappedBySafety = true;
    }

    return {
        optimalHeightM: optimalHeightM,
        optimalHeightFt: optimalHeightM / 0.3048,
        finalHeightM: finalHeightM,
        finalHeightFt: finalHeightM / 0.3048,
        isCappedBySafety: isCappedBySafety
    };
}
