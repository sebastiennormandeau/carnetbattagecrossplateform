/**
 * Calcule les résultats de battage et déclenche les alertes de sécurité (Hiley, Euler, Compression Acier)
 */
export function calculatePilingData(data) {
    const { 
        targetRu, efficiency, hammerWeightKg, dropHeight, 
        lengthUnderHammer, exposedLength, areaMm2, inertiaMm4, 
        elasticModulusMPa, soilReboundC3, linearWeightKgPerMeter 
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
    const c1 = 2.5; 
    const c3 = soilReboundC3;
    const a_max = l_mm / (2 * areaMm2 * elasticModulusMPa) * 1000; // *1000 pour N -> kN
    const b_max = (c1 + c3) / 2;
    
    let ruMaxKn = 0;
    const discriminantMax = Math.pow(b_max, 2) - (4 * a_max * (-availableEnergy));
    if (discriminantMax > 0) {
        ruMaxKn = (-b_max + Math.sqrt(discriminantMax)) / (2 * a_max);
    }

    // --- 3. Alerte Limite d'Acier (Grade 3 = 310 MPa) ---
    const STEEL_YIELD_MPA = 310;
    const maxStructuralCapacityKn = (areaMm2 * STEEL_YIELD_MPA) / 1000;
    
    if (targetRu > maxStructuralCapacityKn) {
        alerts.push({
            type: 'DANGER',
            message: `Alerte : La charge cible (${targetRu.toFixed(0)} kN) dépasse la limite structurelle de l'acier (${maxStructuralCapacityKn.toFixed(0)} kN).`
        });
    } else if (ruMaxKn > maxStructuralCapacityKn) {
        alerts.push({
            type: 'WARNING',
            message: `Attention : Sur un refus strict, l'impact de ce marteau générera ${ruMaxKn.toFixed(0)} kN, ce qui écrasera l'acier (Limite: ${maxStructuralCapacityKn.toFixed(0)} kN).`
        });
    }

    // --- 4. Alerte Flambement (Euler sur Exposed Length) ---
    const exposedLengthMm = exposedLength * 304.8; 
    let pcrKn = Infinity;
    
    if (exposedLengthMm > 0) {
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
            
            alerts.push({
                type: 'WARNING',
                message: `Danger de flambement ! Sur un sol dur, l'impact générera jusqu'à ${ruMaxKn.toFixed(0)} kN (> ${pcrKn.toFixed(0)} kN). Hauteur de chute max suggérée : ${safeDropHeightM.toFixed(2)} m.`
            });
        }
    }

    // --- 5. Calcul de Hiley ---
    // b. Compressions Élastiques (c)
    // c2 = (Ru * L) / (A * E) - On s'assure de convertir Ru (kN) en Newtons
    const c2_mm = ((targetRu * 1000) * l_mm) / (areaMm2 * elasticModulusMPa);
    
    const c = c1 + c2_mm + c3;

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

    return {
        refusalTargetMm: refusalMm,
        maxStructuralKn: maxStructuralCapacityKn,
        pcrKn: pcrKn,
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
        linearWeightKgPerMeter 
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
    // c = c1 + c3 + c2, où c2 = (Ru * L) / (A * E)
    // Donc: a*Ru^2 + b*Ru + c_eq = 0
    const c1 = 2.5;
    const c3 = soilReboundC3;
    const c_const = c1 + c3;
    const l_mm = lengthUnderHammer * 304.8;
    
    const K = l_mm / (areaMm2 * elasticModulusMPa) * 1000; // *1000 pour Ru en kN
    
    const a = K / 2;
    const b = measuredRefusal + (c_const / 2);
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
