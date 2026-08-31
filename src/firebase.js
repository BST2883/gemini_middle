import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhya-TAgar0CHpJsvaeBMpXKl4ZJBNa6A",
  authDomain: "business-card-55112.firebaseapp.com",
  projectId: "business-card-55112",
  storageBucket: "business-card-55112.firebasestorage.app",
  messagingSenderId: "420152915420",
  appId: "1:420152915420:web:79401b537f005b26190b19",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
