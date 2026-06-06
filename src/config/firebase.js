import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// These values mirror what is in google-services.json for your Firebase project "smart-piling"
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "smart-piling-app.firebaseapp.com",
  projectId: "smart-piling-app",
  storageBucket: "smart-piling-app.firebasestorage.app",
  messagingSenderId: "523755259959",
  appId: "1:523755259959:web:b2deca231174d06e6917b2",
  measurementId: "G-KQ6QW6SL0Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const storage = getStorage(app);
const functions = getFunctions(app);

export { db, auth, storage, functions, app };
