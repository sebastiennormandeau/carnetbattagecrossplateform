import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// Initialiser le gestionnaire de notifications en arrière-plan pour Android/iOS (Firebase)
if (Platform.OS !== 'web') {
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message push reçu en arrière-plan!', remoteMessage);
    });
  } catch (e) {
    console.log("Ignoré: module messaging non disponible sur le web");
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
