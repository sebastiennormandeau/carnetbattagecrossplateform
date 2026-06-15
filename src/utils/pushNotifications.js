import { Platform, Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';

// Pour le web, on retourne de fausses implémentations pour éviter de casser l'application
const isWeb = Platform.OS === 'web';

let messaging = null;

if (!isWeb) {
  try {
    // Import dynamique pour éviter de crasher le web
    messaging = require('@react-native-firebase/messaging').default;
  } catch (error) {
    console.warn("Impossible de charger @react-native-firebase/messaging:", error);
  }
}

/**
 * Demande les permissions et récupère le jeton natif FCM
 */
export async function registerForPushNotificationsAsync() {
  if (isWeb || !messaging) {
    console.log("Les notifications push natives ne sont pas supportées sur le Web dans cette configuration.");
    return null;
  }

  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('Permission pour les notifications push non accordée!');
      return null;
    }

    // Récupérer le jeton FCM
    const token = await messaging().getToken();
    console.log("Firebase Cloud Messaging (FCM) Token obtenu:", token);

    return token;
  } catch (error) {
    console.error("Erreur lors de la récupération du token FCM:", error);
    return null;
  }
}

/**
 * Configure les écouteurs de notifications pour le premier plan
 * À appeler au démarrage de l'application (ex: dans un useEffect de App.js)
 * Retourne la fonction de nettoyage (unsubscribe)
 */
export function setupPushListeners() {
  if (isWeb || !messaging) {
    return () => {}; // No-op pour le web
  }

  // Écouteur pour les messages reçus lorsque l'application est ouverte et au premier plan
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('Message push reçu en premier plan:', remoteMessage);
    
    // Afficher une alerte native si on a un objet "notification"
    if (remoteMessage.notification) {
      Alert.alert(
        remoteMessage.notification.title || "Notification",
        remoteMessage.notification.body || "",
        [{ text: "OK" }]
      );
    }
  });

  return unsubscribe;
}

/**
 * Fonction pour envoyer une notification Push à un ou plusieurs jetons via Cloud Functions
 * @param {string|string[]} pushToken Jeton(s) FCM natifs
 * @param {string} title Titre de la notification
 * @param {string} body Message
 * @param {object} data Données optionnelles cachées
 */
export async function sendPushNotification(pushToken, title, body, data = {}) {
  const tokens = Array.isArray(pushToken) ? pushToken : [pushToken];
  
  // On filtre les jetons invalides (les anciens jetons Expo commençaient par ExponentPushToken)
  // On filtre ceux qui commencent par ça (pour éviter de les envoyer à FCM qui les rejettera)
  const validTokens = tokens.filter(t => t && !t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) {
    console.warn("Aucun jeton FCM valide fourni pour envoyer la notification.");
    return;
  }

  try {
    const functions = getFunctions(app);
    const sendNotification = httpsCallable(functions, 'sendAssignmentNotification');
    
    const result = await sendNotification({
      tokens: validTokens,
      title,
      body,
      data
    });
    
    console.log("Résultat de l'envoi Push (Firebase Cloud Function):", result.data);
  } catch (error) {
    console.error("Erreur lors de l'appel à la Cloud Function de notification:", error);
  }
}
