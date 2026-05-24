import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function TransparentPaySlip({ paySlipData }) {
  if (!paySlipData) return null;

  // L'objet paySlipData provient directement de l'API Enterprise (via Cloud Function)
  // Il contient toutes les mathématiques exactes déjà calculées.

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Bulletin de Paie CCQ</Text>
      <Text style={styles.periodText}>Période : {paySlipData.period.start} au {paySlipData.period.end}</Text>

      {/* A. Le salaire gagné (Brut) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>A. Heures Travaillées (Gains bruts)</Text>
        <View style={styles.row}>
          <Text>Heures régulières ({paySlipData.hours.regular}h x {paySlipData.rates.base}$)</Text>
          <Text>{paySlipData.grossPay.regular.toFixed(2)}$</Text>
        </View>
        {paySlipData.hours.timeAndHalf > 0 && (
          <View style={styles.row}>
            <Text>Temps supplémentaire ({paySlipData.hours.timeAndHalf}h)</Text>
            <Text>{paySlipData.grossPay.timeAndHalf.toFixed(2)}$</Text>
          </View>
        )}
        {paySlipData.hours.double > 0 && (
          <View style={styles.row}>
            <Text>Temps double ({paySlipData.hours.double}h)</Text>
            <Text>{paySlipData.grossPay.double.toFixed(2)}$</Text>
          </View>
        )}
        <View style={[styles.row, styles.highlight]}>
          <Text>Sous-total gagné</Text>
          <Text>{paySlipData.grossPay.workedSubtotal.toFixed(2)}$</Text>
        </View>
      </View>

      {/* B. Le 13% CCQ (Congés et fériés) */}
      <View style={[styles.card, styles.ccqCard]}>
        <Text style={styles.cardTitle}>B. Banque CCQ - Vacances et Fériés (13%)</Text>
        <Text style={styles.infoText}>
          Ce montant de 13% est calculé sur vos gains bruts. Il est ajouté à votre paie, 
          puis déduit à 100% pour être envoyé directement à la CCQ (votre chèque de vacances).
        </Text>
        <View style={styles.row}>
          <Text style={styles.positive}>+ Ajout de 13%</Text>
          <Text style={styles.positive}>+ {paySlipData.ccq.vacationAdded.toFixed(2)}$</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.negative}>- Retenue CCQ (100%)</Text>
          <Text style={styles.negative}>- {paySlipData.ccq.vacationDeducted.toFixed(2)}$</Text>
        </View>
      </View>

      {/* C. Retenues gouvernementales exactes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>C. Retenues Gouvernementales</Text>
        <View style={styles.row}><Text>Impôt Fédéral</Text><Text style={styles.negative}>- {paySlipData.taxes.federal.toFixed(2)}$</Text></View>
        <View style={styles.row}><Text>Impôt Provincial</Text><Text style={styles.negative}>- {paySlipData.taxes.provincial.toFixed(2)}$</Text></View>
        <View style={styles.row}><Text>RRQ (Rentes)</Text><Text style={styles.negative}>- {paySlipData.taxes.rrq.toFixed(2)}$</Text></View>
        <View style={styles.row}><Text>RQAP (Parental)</Text><Text style={styles.negative}>- {paySlipData.taxes.rqap.toFixed(2)}$</Text></View>
        <View style={styles.row}><Text>Assurance Emploi (AE)</Text><Text style={styles.negative}>- {paySlipData.taxes.ei.toFixed(2)}$</Text></View>
        <View style={[styles.row, styles.totalRow]}>
          <Text>Total Taxes</Text>
          <Text style={styles.negative}>- {paySlipData.taxes.totalTaxes.toFixed(2)}$</Text>
        </View>
      </View>

      {/* D. Retenues syndicales et avantages sociaux */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>D. Cotisations CCQ & Syndicat</Text>
        <View style={styles.row}><Text>Avantages sociaux (Pension/Assurances)</Text><Text style={styles.negative}>- {paySlipData.ccq.benefits.toFixed(2)}$</Text></View>
        <View style={styles.row}><Text>Prélèvement syndical</Text><Text style={styles.negative}>- {paySlipData.ccq.unionDues.toFixed(2)}$</Text></View>
      </View>

      {/* E. Indemnités de déplacement (Non-imposables) */}
      {paySlipData.allowances.total > 0 && (
        <View style={[styles.card, styles.allowanceCard]}>
          <Text style={styles.cardTitle}>E. Indemnités (Non-imposables)</Text>
          <View style={styles.row}>
            <Text>Frais de déplacement ({paySlipData.allowances.kmCount} km)</Text>
            <Text style={styles.positive}>+ {paySlipData.allowances.travel.toFixed(2)}$</Text>
          </View>
        </View>
      )}

      {/* F. Le dépôt Net exact */}
      <View style={styles.netCard}>
        <Text style={styles.netTitle}>F. DÉPÔT NET</Text>
        <Text style={styles.netAmount}>{paySlipData.netPay.toFixed(2)} $</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F7FA',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  periodText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ccqCard: {
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  allowanceCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  highlight: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    fontWeight: 'bold',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    fontWeight: 'bold',
  },
  positive: {
    color: '#16A34A',
    fontWeight: '500',
  },
  negative: {
    color: '#DC2626',
    fontWeight: '500',
  },
  netCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    padding: 20,
    marginTop: 8,
    marginBottom: 40,
    alignItems: 'center',
  },
  netTitle: {
    color: '#DBEAFE',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  netAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
});
