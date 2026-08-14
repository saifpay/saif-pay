// ========================================
// SAIF PAY - Firebase Configuration
// ========================================


// Firebase SDK
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";


// ========================================
// Firebase Authentication
// ========================================

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


// ========================================
// Firebase Firestore
// ========================================

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ========================================
// إعدادات Firebase
// ========================================

const firebaseConfig = {

  apiKey: "AIzaSyA4EEPO1xEAiMHF1f_TdYQ6zI5JbH7baVY",

  authDomain: "saif-pay.firebaseapp.com",

  projectId: "saif-pay",

  storageBucket: "saif-pay.firebasestorage.app",

  messagingSenderId: "671544583953",

  appId: "1:671544583953:web:db7a36b3f534c5a3fe8eb0",

  measurementId: "G-42DKG7Z3YD"

};


// ========================================
// تشغيل Firebase
// ========================================

const app = initializeApp(firebaseConfig);


// ========================================
// تشغيل Authentication
// ========================================

const auth = getAuth(app);


// ========================================
// تشغيل Firestore
// ========================================

const db = getFirestore(app);


// ========================================
// تصدير جميع الدوال
// ========================================

export {

  // Firebase
  auth,
  db,

  // Authentication
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,

  // تغيير كلمة المرور
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,

  // نسيت كلمة المرور
  sendPasswordResetEmail,

  // Firestore
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction

};