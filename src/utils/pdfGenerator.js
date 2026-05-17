import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { calculatePilingData } from './engineeringMath';

const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Note de Calcul Technique - Smart Piling</title>
    <style>
        @page {
            margin: 20mm;
            size: A4 portrait;
        }
        body {
            font-family: 'Inter', 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            background: #fff;
            border-top: 5px solid #1976D2;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #eee;
            padding-top: 15px;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        .logo-img {
            max-height: 80px;
            width: auto;
            max-width: 250px;
        }
        .report-meta {
            text-align: right;
            font-size: 14px;
            color: #555;
        }
        .report-meta strong {
            color: #222;
        }
        h1 {
            text-align: center;
            font-size: 24px;
            text-transform: uppercase;
            color: #2c3e50;
            margin-bottom: 20px;
            letter-spacing: 1px;
        }
        h2 {
            font-size: 18px;
            color: #1976D2;
            border-bottom: 2px solid #eee;
            padding-bottom: 5px;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            font-size: 16px;
            color: #1976D2;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 14px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px 15px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #333;
            width: 50%;
        }
        .calculation-block {
            background: #fdfdfd;
            border: 1px solid #eee;
            border-left: 4px solid #1976D2;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 4px;
        }
        .calc-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 15px;
        }
        .formula {
            font-family: 'Courier New', Courier, monospace;
            background: #f4f6f8;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
            color: #d32f2f;
            font-weight: bold;
            text-align: center;
            font-size: 16px;
        }
        .substitution {
            font-family: 'Courier New', Courier, monospace;
            text-align: center;
            font-size: 15px;
            color: #555;
        }
        .results-box {
            background: #FFF9C4;
            border: 2px solid #FBC02D;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin-top: 30px;
        }
        .results-title {
            font-size: 20px;
            font-weight: bold;
            color: #F57F17;
            margin-bottom: 15px;
            text-transform: uppercase;
        }
        .result-value {
            font-size: 36px;
            font-weight: 900;
            color: #212121;
        }
        .result-unit {
            font-size: 18px;
            color: #616161;
        }
        .alerts {
            margin-top: 20px;
        }
        .alert {
            padding: 12px 15px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-weight: bold;
            font-size: 14px;
            border-left: 5px solid;
        }
        .alert-danger {
            background-color: #FFEBEE;
            border-left-color: #D32F2F;
            color: #b71c1c;
        }
        .alert-warning {
            background-color: #FFF3E0;
            border-left-color: #F57C00;
            color: #e65100;
        }
        .tech-note {
            margin-top: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #6c757d;
            font-size: 12px;
            color: #555;
            border-radius: 4px;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 15px;
        }
    </style>
</head>
<body>

    <!-- ENTÊTE -->
    <div class="header">
        <img class="logo-img" src="{{LOGO_BASE64}}" alt="Logo" />
        <div class="report-meta">
            <div><strong>Date :</strong> {{DATE}}</div>
            <div><strong>Projet :</strong> {{PROJECT_NAME}}</div>
            <div><strong>Opérateur :</strong> {{OPERATOR_NAME}}</div>
        </div>
    </div>

    <h1>{{REPORT_TITLE}}</h1>
    {{REPORT_TYPE_BANNER}}

    <!-- DONNÉES D'ENTRÉE -->
    <h2>1. Paramètres de Battage (Données d'entrée)</h2>
    <table>
        <tr>
            <th>Calibre du pieu</th>
            <td>{{GAUGE_LABEL}}</td>
        </tr>
        <tr>
            <th>Limite d'élasticité de l'acier (fy)</th>
            <td>{{STEEL_GRADE}} MPa</td>
        </tr>
        <tr>
            <th>Longueur initiale sous le marteau</th>
            <td>{{LENGTH_UNDER_HAMMER}} pi</td>
        </tr>
{{PDA_ROW}}
        <tr>
            <th>Longueur hors sol (Exposed)</th>
            <td>{{EXPOSED_LENGTH}} pi</td>
        </tr>
        <tr>
            <th>Marteau utilisé</th>
            <td>{{HAMMER_NAME}} ({{HAMMER_WEIGHT}} kg)</td>
        </tr>
        <tr>
            <th>Efficacité du marteau (&eta;)</th>
            <td>{{EFFICIENCY}} %</td>
        </tr>
        <tr>
            <th>Hauteur de chute standard (H)</th>
            <td>{{STANDARD_DROP_HEIGHT}} m</td>
        </tr>
{{PDA_DROP_ROW}}
        <tr>
            <th>Rebond élastique du sol (c3)</th>
            <td>{{SOIL_REBOUND}} mm</td>
        </tr>
        <tr>
            <th>Cible Géotechnique / Charge ultime (Ru)</th>
            <td>{{TARGET_RU}} kN</td>
        </tr>
    </table>

    <!-- DÉTAILS DES CALCULS -->
    <h2>2. Preuve d'Ingénierie (Détails des calculs)</h2>

    <div class="calculation-block">
        <div class="calc-title">A. Énergie d'impact (Eh)</div>
        <div class="formula">Eh = W &middot; H &middot; &eta;</div>
        <div class="substitution">Eh = {{HAMMER_WEIGHT}} kg &times; 9.81 &times; {{ACTIVE_DROP_HEIGHT}} m &times; {{EFF_RATIO}} = <strong>{{ENERGY_KNM}} kN&middot;m</strong></div>
    </div>

    <div class="calculation-block">
        <div class="calc-title">B. Ratio d'impact (n)</div>
        <div class="formula">n = [W + (e&sup2; &middot; P)] / (W + P)</div>
        <div class="substitution">n = [{{HAMMER_WEIGHT}} + (0.2 &middot; {{PILE_WEIGHT}})] / ({{HAMMER_WEIGHT}} + {{PILE_WEIGHT}}) = <strong>{{IMPACT_RATIO}}</strong></div>
    </div>

    <div class="calculation-block">
        <div class="calc-title">C. Compression élastique de l'acier (c2)</div>
        <div class="formula">c2 = (Ru &middot; L) / (A &middot; E)</div>
        <div class="substitution">c2 = ({{TARGET_RU}} kN &middot; {{LENGTH_MM}} mm) / ({{AREA_MM2}} mm&sup2; &middot; 200000 MPa) = <strong>{{C2_MM}} mm</strong></div>
    </div>

    <div class="calculation-block">
        <div class="calc-title">D. Critère de refus de Hiley (s)</div>
        <div class="formula">s = (Eh &middot; n) / Ru - (c1 + c2 + c3) / 2</div>
        <div class="substitution">s = ({{ENERGY_KNM}} &times; 1000 &middot; {{IMPACT_RATIO}}) / {{TARGET_RU}} - ({{C1_MM}} + {{C2_MM}} + {{SOIL_REBOUND}}) / 2 = <strong>{{REFUSAL_MM}} mm/coup</strong></div>
    </div>

    <!-- RÉSULTATS ET ALERTES -->
    <h2>3. Résultats Finaux & Sécurité</h2>
    
    <div class="results-box">
        <div class="results-title">Critère de Refus Cible</div>
        <div class="result-value">{{REFUSAL_BATCH}} <span class="result-unit">mm / {{BLOWS_PER_BATCH}} coups</span></div>
        <div style="margin-top: 10px; color: #555;">(Équivalent à {{REFUSAL_MM}} mm par coup)</div>
    </div>

    <h3>Sécurité et Conformité</h3>
    <table>
        <tr>
            <th>Limite de flambement (Euler)</th>
            <td>{{EULER_LIMIT}}</td>
        </tr>
        <tr>
            <th>Contrainte d'écrasement max. tolérée</th>
            <td>{{MAX_STRUCTURAL}}</td>
        </tr>
    </table>

    <div class="alerts">
        <!-- Rendu conditionnel des alertes -->
        {{ALERTS_BLOCK}}
    </div>

    <div class="tech-note">
        <strong>Note technique :</strong> Les calculs sont basés sur la formule de Hiley modifiée. En mode PDA, une augmentation du critère de refus est physiquement normale suite à la réduction de la masse du pieu et de la compression élastique de l'acier (c2).
    </div>

    <div class="footer">
        Note de Calcul Technique - Smart Piling | Développé par Vibe Coding Mind | Le {{TIMESTAMP}}
    </div>

</body>
</html>`;

const chartHtmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Abaque de Refus - Smart Piling</title>
    <style>
        @page { margin: 20mm; size: A4 landscape; }
        body { font-family: 'Inter', 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; }
        .page { page-break-after: always; padding-top: 10px; border-top: 5px solid #1976D2; }
        .page:last-child { page-break-after: avoid; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 30px; }
        .logo-img { max-height: 80px; width: auto; max-width: 250px; }
        .report-meta { text-align: right; font-size: 14px; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 20px; text-transform: uppercase; }
        .summary-box { background: #f4f6f8; padding: 15px; border-left: 4px solid #1976D2; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .alert-row { background-color: #FFEBEE; color: #D32F2F; font-size: 11px; text-align: left; }
        .warn-row { background-color: #FFF3E0; color: #E65100; font-size: 11px; text-align: left; }
        .safe-row { color: #2E7D32; font-size: 11px; text-align: left; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
    </style>
</head>
<body>
    {{PAGES}}
</body>
</html>`;

const pageTemplate = `
    <div class="page">
        <div class="header">
            <img class="logo-img" src="{{LOGO_BASE64}}" alt="Logo" />
            <div class="report-meta">
                <div><strong>Date :</strong> {{DATE}}</div>
                <div><strong>Projet :</strong> {{PROJECT_NAME}}</div>
            </div>
        </div>
        
        <h1>Abaque de Refus - Plage de Hauteur de Chute</h1>
        
        <div class="summary-box">
            <strong>Marteau :</strong> {{HAMMER_NAME}} ({{HAMMER_WEIGHT}} kg)<br/>
            <strong>Calibre :</strong> {{GAUGE_LABEL}}" | <strong>Efficacité :</strong> {{EFFICIENCY}} % | <strong>Rebond du sol :</strong> {{SOIL_REBOUND}} mm<br/>
            <strong>Longueur sous marteau :</strong> {{LENGTH_UNDER_HAMMER}} pi | <strong>Longueur exposée :</strong> {{EXPOSED_LENGTH}} pi<br/>
            <strong style="color:#d32f2f;">Capacité Ultime (Ru) Cible : {{TARGET_RU}} kN</strong> | <strong>Casque {{CAP_MATERIAL}} (c1) :</strong> {{C1_MM}} mm<br/>
            <strong>Limite d'élasticité de l'acier (fy) :</strong> {{STEEL_GRADE}} MPa
        </div>

        <table>
            <thead>
                <tr>
                    <th>Hauteur de chute<br/>({{UNIT}})</th>
                    <th>C2 élastique<br/>(mm)</th>
                    <th>Ratio<br/>d'Impact</th>
                    <th>Cible Refus<br/>(mm / coup)</th>
                    <th style="background:#FFF9C4; color:#F57F17;">Refus / Volée<br/>(mm / {{BLOWS_PER_BATCH}} c)</th>
                    <th>Remarques de Sécurité / Hauteur Max</th>
                </tr>
            </thead>
            <tbody>
                {{ROWS}}
            </tbody>
        </table>
        
        {{CHART_ALERTS}}
        
        <div class="footer">
            Note de Calcul Technique - Smart Piling | Développé par Vibe Coding Mind | Le {{TIMESTAMP}}
        </div>
    </div>
`;

export async function generatePilingReport(storeState, resultData) {
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

    const gauge = gauges[storeState.selectedGaugeIdx] || gauges[0];
    const hammer = storeState.availableHammers && storeState.availableHammers.length > 0 ? storeState.availableHammers[storeState.selectedHammerIdx] || { name: 'Inconnu', weightKg: 1500 } : { name: 'Inconnu', weightKg: 1500 };
    const date = new Date().toLocaleDateString('fr-CA');
    const timestamp = new Date().toLocaleString('fr-CA');

    const length_m = storeState.isPdaMode ? storeState.pdaLength * 0.3048 : storeState.lengthUnderHammer * 0.3048;
    const eff_ratio = storeState.efficiency / 100;
    const drop_height = storeState.isPdaMode ? storeState.pdaDropHeight * 0.3048 : storeState.dropHeight;
    const energy_knm = ((hammer.weightKg * 9.81) / 1000) * drop_height;
    
    const ID = gauge.od - (2 * gauge.t);
    const areaIn2 = (Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2));
    const areaMm2 = areaIn2 * 645.16;

    const massPileKg = length_m * gauge.weight;

    const reportTitle = 'Note de Calcul Technique - Smart Piling';
    const reportTypeBanner = storeState.isPdaMode 
        ? `<div style="text-align: center; background-color: #E0F7FA; color: #006064; padding: 10px; font-weight: bold; font-size: 16px; margin-bottom: 20px; border-radius: 4px;">Type de rapport : Essai de chargement dynamique (PDA / Re-strike)</div>` 
        : '';
        
    const pdaRowHtml = storeState.isPdaMode ? `        <tr>
            <th style="background-color: #E0F7FA; color: #006064;">Longueur après coupe (PDA)</th>
            <td style="background-color: #E0F7FA; color: #006064; font-weight: bold;">${storeState.pdaLength} pi</td>
        </tr>` : '';

    const pdaDropRowHtml = storeState.isPdaMode ? `        <tr>
            <th style="background-color: #E0F7FA; color: #006064;">Hauteur de chute PDA</th>
            <td style="background-color: #E0F7FA; color: #006064; font-weight: bold;">${storeState.pdaDropHeight} pi (${(storeState.pdaDropHeight * 0.3048).toFixed(2)} m)</td>
        </tr>` : '';

    let alertsHtml = '';
    
    if (hammer.capMaterial === 'Pruche') {
        alertsHtml += `<div class="alert alert-warning">&#9888; ℹ️ Note d'ingénierie : L'élasticité du bois varie en s'écrasant. Le calcul utilise une valeur moyenne densifiée (650 MPa) pour assurer la sécurité lors de la lecture du refus final.</div>`;
    }

    if (resultData.alerts && resultData.alerts.length > 0) {
        alertsHtml += resultData.alerts.map(alert => {
            const cssClass = alert.type === 'DANGER' ? 'alert-danger' : 'alert-warning';
            return `<div class="alert ${cssClass}">&#9888; ${alert.message}</div>`;
        }).join('');
    } else if (hammer.capMaterial !== 'Pruche') {
        alertsHtml += `<div class="alert" style="background-color: #E8F5E9; border-left-color: #2E7D32; color: #1B5E20;">
                &#10004; Aucune alerte structurelle. Le pieu opérera dans les limites sécuritaires.
            </div>`;
    }

    const eulerLimitStr = resultData.pcrKn && resultData.pcrKn !== Infinity 
        ? `${resultData.pcrKn.toFixed(0)} kN` 
        : 'N/A (Pieu non exposé)';
        
    const maxStructuralStr = resultData.maxStructuralKn 
        ? `${resultData.maxStructuralKn.toFixed(0)} kN` 
        : 'N/A';

    const htmlContent = htmlTemplate
        .replace(/{{DATE}}/g, date)
        .replace(/{{REPORT_TITLE}}/g, reportTitle)
        .replace(/{{REPORT_TYPE_BANNER}}/g, reportTypeBanner)
        .replace(/{{PDA_ROW}}/g, pdaRowHtml)
        .replace(/{{PDA_DROP_ROW}}/g, pdaDropRowHtml)
        .replace(/{{PROJECT_NAME}}/g, storeState.projectName || 'Projet Actuel')
        .replace(/{{OPERATOR_NAME}}/g, storeState.operatorName || 'Opérateur')
        .replace(/{{GAUGE_LABEL}}/g, gauge.label)
        .replace(/{{STEEL_GRADE}}/g, storeState.steelGrade || 345)
        .replace(/{{LENGTH_UNDER_HAMMER}}/g, storeState.lengthUnderHammer)
        .replace(/{{LENGTH_M}}/g, (storeState.lengthUnderHammer * 0.3048).toFixed(2))
        .replace(/{{EXPOSED_LENGTH}}/g, storeState.isPdaMode ? resultData.dynamicExposedLength : storeState.exposedLength)
        .replace(/{{HAMMER_NAME}}/g, hammer.name || hammer.label || 'Inconnu')
        .replace(/{{HAMMER_WEIGHT}}/g, hammer.weightKg)
        .replace(/{{EFFICIENCY}}/g, storeState.efficiency)
        .replace(/{{STANDARD_DROP_HEIGHT}}/g, storeState.dropHeight)
        .replace(/{{ACTIVE_DROP_HEIGHT}}/g, drop_height)
        .replace(/{{SOIL_REBOUND}}/g, storeState.soilReboundC3)
        .replace(/{{TARGET_RU}}/g, storeState.targetRu)
        .replace(/{{EFF_RATIO}}/g, eff_ratio.toFixed(2))
        .replace(/{{ENERGY_KNM}}/g, energy_knm.toFixed(1))
        .replace(/{{PILE_WEIGHT}}/g, massPileKg.toFixed(1))
        .replace(/{{IMPACT_RATIO}}/g, resultData.impactRatio ? resultData.impactRatio.toFixed(3) : '0.000')
        .replace(/{{LENGTH_MM}}/g, (length_m * 1000).toFixed(1))
        .replace(/{{AREA_MM2}}/g, areaMm2.toFixed(1))
        .replace(/{{C1_MM}}/g, resultData.c1 ? resultData.c1.toFixed(2) : '0.00')
        .replace(/{{C2_MM}}/g, resultData.c2 ? resultData.c2.toFixed(2) : '0.00')
        .replace(/{{REFUSAL_MM}}/g, resultData.refusalTargetMm > 0 ? resultData.refusalTargetMm.toFixed(2) : '0.00')
        .replace(/{{REFUSAL_BATCH}}/g, resultData.refusalTargetMm > 0 ? (resultData.refusalTargetMm * storeState.blowsPerBatch).toFixed(1) : '0.0')
        .replace(/{{BLOWS_PER_BATCH}}/g, storeState.blowsPerBatch)
        .replace(/{{ALERTS_BLOCK}}/g, alertsHtml)
        .replace(/{{EULER_LIMIT}}/g, eulerLimitStr)
        .replace(/{{MAX_STRUCTURAL}}/g, maxStructuralStr)
        .replace(/{{LOGO_BASE64}}/g, storeState.reportLogo || '')
        .replace(/{{TIMESTAMP}}/g, timestamp);

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // Création d'un nom de fichier personnalisé
    const safeProjectName = (storeState.projectName || 'SansTitre').replace(/[^a-zA-Z0-9_\\-]/g, '_').substring(0, 30);
    const dateStamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
    const newPath = `${FileSystem.cacheDirectory}NoteCalcul_${safeProjectName}_${dateStamp}.pdf`;
    
    await FileSystem.moveAsync({
        from: uri,
        to: newPath
    });

    await Sharing.shareAsync(newPath, { 
        UTI: '.pdf', 
        mimeType: 'application/pdf', 
        dialogTitle: 'Partager la note de calcul' 
    });
}

export async function generateRefusalChartPdf(storeState) {
    const configs = storeState.compiledAbaques && storeState.compiledAbaques.length > 0 
        ? storeState.compiledAbaques 
        : [];

    if (configs.length === 0) {
        throw new Error("L'abaque compilé est vide.");
    }

    const date = new Date().toLocaleDateString('fr-CA');
    const timestamp = new Date().toLocaleString('fr-CA');
    const chartUnit = storeState.chartUnit || 'ft';
    const dropHeightsFt = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

    let pagesHtml = '';

    for (let cIdx = 0; cIdx < configs.length; cIdx++) {
        const config = configs[cIdx];
        const { gauge, hammer, targetRu, steelGrade, isPdaMode, pdaLength, pdaDropHeight, standardLength } = config;
        
        const ID = gauge.od - (2 * gauge.t);
        const areaMm2 = ((Math.PI / 4) * (Math.pow(gauge.od, 2) - Math.pow(ID, 2))) * 645.16;
        const inertiaMm4 = ((Math.PI / 64) * (Math.pow(gauge.od, 4) - Math.pow(ID, 4))) * 416231.426;

        let rowsHtml = '';
        let c1ForChart = '0.00';
        let hasPruche = hammer.capMaterial === 'Pruche';

        for (let i = 0; i < dropHeightsFt.length; i++) {
            const h_ft = dropHeightsFt[i];
            const h_m = h_ft * 0.3048;

            const dataPayload = {
                targetRu: parseFloat(targetRu) || 0,
                efficiency: parseFloat(storeState.efficiency) || 55,
                hammerWeightKg: hammer.weightKg || 1500,
                dropHeight: h_m,
                lengthUnderHammer: isPdaMode ? parseFloat(pdaLength) || 0 : parseFloat(standardLength) || 0,
                exposedLength: parseFloat(storeState.exposedLength) || 0,
                soilReboundC3: parseFloat(storeState.soilReboundC3) || 2.5,
                areaMm2, inertiaMm4, elasticModulusMPa: 200000, 
                linearWeightKgPerMeter: gauge.weight,
                steelGrade: steelGrade || 345,
                capThicknessMm: (hammer.capThicknessIn || 7) * 25.4,
                capAreaMm2: (hammer.capAreaSqIn || 240.25) * 645.16,
                capModulusMPa: hammer.capModulusMPa || 900
            };

            const res = calculatePilingData(dataPayload);
            if (i === 0) {
                c1ForChart = res.c1 ? res.c1.toFixed(2) : '0.00';
            }
            
            const batchRefusal = typeof res.refusalTargetMm === 'number' && res.refusalTargetMm > 0 ? (res.refusalTargetMm * storeState.blowsPerBatch).toFixed(1) : (res.refusalTargetMm === 0 ? 'N/A' : res.refusalTargetMm);
            const singleRefusal = typeof res.refusalTargetMm === 'number' && res.refusalTargetMm > 0 ? res.refusalTargetMm.toFixed(2) : (res.refusalTargetMm === 0 ? 'N/A' : res.refusalTargetMm);

            let remarks = '<span class="safe-row">&#10004; Sécuritaire</span>';
            if (res.alerts.length > 0) {
                const worstAlert = res.alerts.find(a => a.type === 'DANGER') || res.alerts[0];
                const cssClass = worstAlert.type === 'DANGER' ? 'alert-row' : 'warn-row';
                remarks = `<span class="${cssClass}">&#9888; ${worstAlert.message}</span>`;
            }

            const displayHeight = chartUnit === 'ft' ? `${h_ft.toFixed(1)}'` : `${h_m.toFixed(2)} m`;

            rowsHtml += `
                <tr>
                    <td><strong>${displayHeight}</strong></td>
                    <td>${res.c2.toFixed(2)}</td>
                    <td>${res.impactRatio.toFixed(3)}</td>
                    <td><strong>${singleRefusal}</strong></td>
                    <td style="font-weight:900; font-size:15px; color:#F57F17;">${batchRefusal}</td>
                    <td>${remarks}</td>
                </tr>
            `;
        }

        let chartAlertsHtml = '';
        if (hasPruche) {
            chartAlertsHtml = `<div class="summary-box" style="background-color: #FFF3E0; border-left: 4px solid #FF9800; margin-top: 15px;">
                <strong style="color: #E65100;">ℹ️ Note d'ingénierie (Casque en Bois) :</strong> L'élasticité du bois varie en s'écrasant. Le calcul utilise une valeur moyenne densifiée (650 MPa) pour assurer la sécurité lors de la lecture du refus final.
            </div>`;
        }

        const pageHtml = pageTemplate
            .replace(/{{DATE}}/g, date)
            .replace(/{{PROJECT_NAME}}/g, storeState.projectName || 'Projet Actuel')
            .replace(/{{HAMMER_NAME}}/g, hammer.name || hammer.label || 'Inconnu')
            .replace(/{{HAMMER_WEIGHT}}/g, hammer.weightKg || 1500)
            .replace(/{{EFFICIENCY}}/g, storeState.efficiency)
            .replace(/{{GAUGE_LABEL}}/g, gauge.label)
            .replace(/{{UNIT}}/g, chartUnit === 'ft' ? 'Pieds' : 'Mètres')
            .replace(/{{SOIL_REBOUND}}/g, storeState.soilReboundC3)
            .replace(/{{TARGET_RU}}/g, targetRu)
            .replace(/{{LENGTH_UNDER_HAMMER}}/g, isPdaMode ? pdaLength : standardLength)
            .replace(/{{EXPOSED_LENGTH}}/g, storeState.exposedLength)
            .replace(/{{BLOWS_PER_BATCH}}/g, storeState.blowsPerBatch)
            .replace(/{{STEEL_GRADE}}/g, steelGrade || 345)
            .replace(/{{C1_MM}}/g, c1ForChart)
            .replace(/{{CAP_MATERIAL}}/g, hammer.capMaterial || 'UHMW')
            .replace(/{{ROWS}}/g, rowsHtml)
            .replace(/{{CHART_ALERTS}}/g, chartAlertsHtml)
            .replace(/{{LOGO_BASE64}}/g, storeState.reportLogo || '')
            .replace(/{{TIMESTAMP}}/g, timestamp);
        
        pagesHtml += pageHtml;
    }

    const htmlContent = chartHtmlTemplate.replace(/{{PAGES}}/g, pagesHtml);

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    const safeProjectName = (storeState.projectName || 'SansTitre').replace(/[^a-zA-Z0-9_\\-]/g, '_').substring(0, 30);
    const dateStamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
    const newPath = `${FileSystem.cacheDirectory}AbaqueRefus_${safeProjectName}_${dateStamp}.pdf`;
    
    await FileSystem.moveAsync({ from: uri, to: newPath });

    return { uri: newPath };
}
