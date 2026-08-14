import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB9h_P6RMAdfv5OjPGqeRJOBnQfU9-CbPo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zero2one-studcomp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "zero2one-studcomp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "zero2one-studcomp.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "827345021044",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:827345021044:web:a342847d1d58eee5944921"
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

export const ALLOWED_ADMIN_EMAILS = [
  'jampanarithesh74@gmail.com',
  'jampanapadmaja7474@gmail.com'
];

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  LIST = 'list'
}

export const handleFirestoreError = (error: any, operation: OperationType = OperationType.READ, collectionName?: string) => {
  console.error(`Firestore Error [${operation}]${collectionName ? ` on ${collectionName}` : ''}:`, error);
  if (error.code === 'permission-denied') {
    return 'You do not have permission to perform this action.';
  }
  return error.message || 'An unexpected error occurred.';
};

export default app;
