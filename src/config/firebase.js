import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// These values mirror what is in google-services.json for your Firebase project "fondabecbattage"
const firebaseConfig = {
  apiKey: "AIzaSyDQXUUrG6615_RdHkr07ZqoyAI2o4E-2h8",
  authDomain: "fondabecbattage.firebaseapp.com", // Usually project_id.firebaseapp.com
  projectId: "fondabecbattage",
  storageBucket: "fondabecbattage.firebasestorage.app",
  messagingSenderId: "498873991138",
  appId: "1:498873991138:web:a14f43a3db2350c65ec3bb", // Note: This might be slightly different for Web vs Android in the Firebase Console, but standard web init works with projectId + apiKey most of the time.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };
