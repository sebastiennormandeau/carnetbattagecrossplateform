import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configuration du comportement quand l'application est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande les permissions et récupère le jeton push Expo
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permission pour les notifications push non accordée!');
      return null;
    }

    try {
      // EAS ou projet Expo standard
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log("Expo Push Token:", token);
    } catch (e) {
      console.warn("Could not fetch Expo Push Token:", e);
      token = null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Fonction pour envoyer une notification Push à un ou plusieurs jetons
 * @param {string|string[]} expoPushToken Jeton(s) Expo Push
 * @param {string} title Titre de la notification
 * @param {string} body Message
 * @param {object} data Données optionnelles cachées
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  // Si c'est un tableau de jetons, on envoie à tous
  const tokens = Array.isArray(expoPushToken) ? expoPushToken : [expoPushToken];
  
  // On filtre les jetons invalides
  const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));

  if (validTokens.length === 0) return;

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de la notification push:", error);
  }
}
