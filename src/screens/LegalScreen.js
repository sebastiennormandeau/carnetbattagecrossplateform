import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme/Theme';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LEGAL_SECTIONS = [
  {
    id: '1',
    title: "1. CLAUSE DE NON-RESPONSABILITÉ TECHNIQUE",
    content: "AVERTISSEMENT CRITIQUE À L'ATTENTION DE L'UTILISATEUR\n\nATTENTION : ABSENCE D'OPINION D'INGÉNIERIE\nLe logiciel Smart Piling est un outil informatique d'aide à la saisie de données, de documentation de chantier et d'assistance aux calculs géotechniques indicatifs. Les formules intégrées (incluant notamment la formule de Hiley et les critères de refus associés) ne constituent en aucun cas une opinion d'ingénierie, une validation structurelle ou une attestation de capacité portante officielle.\n\n1.1 Validation et responsabilité professionnelle\nL'utilisation de cette application sur un chantier de construction ou de fondations profondes ne dispense aucunement l'utilisateur de l'obligation de faire valider les méthodes, calculs, hauteurs de chute suggérées et critères de refus par un ingénieur qualifié, membre en règle de l'Ordre des Ingénieurs du Québec (OIQ) ou de l'organisme de réglementation professionnelle compétent dans la juridiction d'exécution des travaux.\n\n1.2 Exactitude des données de saisie\nL'exactitude des résultats générés par l'application dépend entièrement de la précision et de la véracité des données techniques saisies sur le terrain par l'opérateur ou l'administrateur (poids du marteau, caractéristiques du coussin de battage, masse du casque, dimensions du pieu, rebonds élastiques c1, c2, c3, etc.). L'éditeur Vibe Coding Mind ne peut être tenu responsable des erreurs de calcul, des pannes de structure ou des anomalies de battage découlant d'une saisie de données erronée, incomplète ou mal interprétée.\n\n1.3 Exclusion de responsabilité pour dommages et retards\nEn aucun cas l'éditeur ne pourra être tenu responsable envers l'utilisateur ou des tiers pour tout dommage direct, indirect, accessoire ou consécutif, incluant sans limitation :\n- Les pertes financières, hausses de coûts ou retards opérationnels sur les chantiers;\n- Les défaillances structurelles des pieux ou des fondations;\n- Les bris mécaniques ou l'usure prématurée des équipements de battage (marteaux, piling rigs, câbles) causés par l'interprétation des seuils d'énergie suggérés par l'application."
  },
  {
    id: '2',
    title: "2. CONDITIONS GÉNÉRALES D'UTILISATION (CGU)",
    content: "Dernière mise à jour : Mai 2026\nLes présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de l'application Smart Piling, développée par Vibe Coding Mind.\n\n2.1 Objet du service et licence d'accès\nSmart Piling est une solution de gestion d'entreprise (ERP vertical) et de carnet de battage numérique exploitée en mode SaaS (Software as a Service). Vibe Coding Mind concède à l'entreprise cliente une licence d'utilisation limitée, non exclusive, non transférable et révocable, permettant à ses employés autorisés d'accéder à la plateforme via l'application mobile et l'interface de gestion cloud.\n\n2.2 Architecture Multi-Tenant et étanchéité des comptes\nL'application utilise une architecture multi-tenant stricte. L'entreprise cliente s'engage à maintenir la confidentialité de ses identifiants de connexion. Chaque document créé (chantiers, rapports, feuilles de temps) est cloisonné par un identifiant unique d'entreprise. Toute tentative d'accès non autorisé aux données d'un tiers ou d'exploitation d'une faille de sécurité entraînera la résiliation immédiate du service et des poursuites judiciaires.\n\n2.3 Propriété intellectuelle et propriété des données\nPropriété du Logiciel : Vibe Coding Mind conserve la propriété exclusive et intégrale du code source, de l'interface graphique, des algorithmes de calcul (inversion de Hiley, etc.), des marques de commerce et des droits d'auteur associés à l'application Smart Piling. L'utilisateur s'interdit toute tentative de décompilation, de rétro-ingénierie (reverse engineering) ou de copie de l'application.\n\nPropriété des Données Clients : L'entreprise cliente demeure propriétaire exclusive de toutes les données opérationnelles saisies dans l'application (données de chantiers, carnets de battage, feuilles de temps). En cas de résiliation de l'abonnement, l'éditeur s'engage à fournir un export des données brutes (format CSV ou JSON) sur demande formelle formulée dans les trente (30) jours suivant la fin du service.\n\n2.4 Continuité du service et maintenance (SLA)\nL'application reposant sur une infrastructure cloud (Firebase), l'éditeur déploie ses meilleurs efforts pour assurer une disponibilité élevée du service. Toutefois, l'éditeur ne garantit pas un accès ininterrompu. L'application intègre des fonctionnalités de stockage local temporaire (mode hors-ligne) pour pallier l'absence temporaire de réseau sur les chantiers, mais la synchronisation finale demeure dépendante de la connectivité réseau de l'appareil de l'utilisateur."
  },
  {
    id: '3',
    title: "3. POLITIQUE DE CONFIDENTIALITÉ (LOI 25)",
    content: "CONFORMITÉ À LA LOI 25 (QUÉBEC)\nVibe Coding Mind prend la protection des renseignements personnels très au sérieux. Cette politique détaille la manière dont nous collectons, utilisons, stockons et protégeons les données dans le cadre de l'utilisation de Smart Piling.\n\n3.1 Renseignements personnels collectés\nDans le cadre de l'exploitation des modules administratifs et opérationnels (punch, calendrier, profils), l'application est amenée à collecter et traiter les données suivantes :\n- Profils des utilisateurs : Nom, prénom, adresse courriel, numéro de téléphone, rôle au sein de l'entreprise (Admin / Opérateur / Employé).\n- Données d'horodateur (Punch) : Heures précises de début et de fin de quart de travail, identifiant de l'appareil mobile, géolocalisation au moment du punch (uniquement si requise et autorisée pour validation des zones de chantier).\n- Données de chantier : Localisation géographique des projets, noms des clients de l'entreprise utilisatrice, et notes de terrain.\n\n3.2 Finalités du traitement des données\nLes données collectées ont pour uniques objectifs :\n- Le calcul et la compilation des heures de travail pour la préparation de la paie par les administrateurs de l'entreprise cliente;\n- La planification et l'affichage des équipes sur le calendrier interactif de l'application;\n- La génération automatique des rapports techniques et des carnets de battage pour les clients finaux et ingénieurs de projet.\n\n3.3 Hébergement, sécurité et chiffrement\nToutes les données sont stockées et centralisées sur des serveurs cloud sécurisés (Google Firebase). Les communications entre l'application React Native et les serveurs sont sécurisées via le protocole HTTPS / TLS. Les données au repos sont chiffrées par l'infrastructure d'hébergement. L'accès aux données de production est régi par des règles de sécurité Firebase strictes (Firestore Security Rules), interdisant toute fuite interentreprise.\n\n3.4 Droits des utilisateurs (Accès et Rectification)\nConformément aux exigences de la Loi 25 au Québec, chaque travailleur ou utilisateur conserve un droit d'accès, de rectification et d'effacement de ses renseignements personnels (« droit à l'oubli ») :\n- Toute demande d'effacement de données d'un employé doit être validée par l'administrateur de son entreprise (pour des raisons de conformité avec les obligations légales de conservation des registres de paie et de chantiers).\n- Pour toute question relative à la protection des renseignements personnels ou pour exercer vos droits, vous pouvez contacter le responsable de la protection des données de Vibe Coding Mind à votre adresse courriel personnelle désignée pour l'administration de l'application."
  }
];

const AccordionItem = ({ title, content }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <MaterialIcons
          name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={24}
          color={theme.colors.primary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.accordionContent}>
          <Text style={styles.paragraph}>{content}</Text>
        </View>
      )}
    </View>
  );
};

export default function LegalScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.mainTitle}>Cadre de Conformité Légale - Smart Piling</Text>

      {LEGAL_SECTIONS.map((section) => (
        <AccordionItem
          key={section.id}
          title={section.title}
          content={section.content}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 30,
    textAlign: 'center',
  },
  accordionContainer: {
    marginBottom: 15,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
    marginRight: 10,
  },
  accordionContent: {
    padding: 15,
    paddingTop: 0,
    backgroundColor: theme.colors.surface,
  },
  paragraph: {
    fontSize: 15,
    color: theme.colors.textMuted || '#a1a1aa',
    lineHeight: 22,
    textAlign: 'justify',
  }
});
