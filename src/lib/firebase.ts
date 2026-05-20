import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB9h_P6RMAdfv5OjPGqeRJOBnQfU9-CbPo",
  authDomain: "zero2one-studcomp.firebaseapp.com",
  projectId: "zero2one-studcomp",
  storageBucket: "zero2one-studcomp.firebasestorage.app",
  messagingSenderId: "827345021044",
  appId: "1:827345021044:web:a342847d1d58eee5944921"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ALLOWED_ADMIN_EMAILS = [
  'jampanarithesh74@gmail.com',
  'jampanapadmaja7474@gmail.com',
  '25eg112c49@anurag.edu.in',
  'ritheshj899@gmail.com'
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
