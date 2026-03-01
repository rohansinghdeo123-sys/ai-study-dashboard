import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZPsZcG32XZxAeCmg8A5V7P6vsou8U7k0",
  authDomain: "ai-study-dashboard-56c9e.firebaseapp.com",
  projectId: "ai-study-dashboard-56c9e",
  storageBucket: "ai-study-dashboard-56c9e.firebasestorage.app",
  messagingSenderId: "15263368937",
  appId: "1:15263368937:web:38a6207c32ac56f59b9278",
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);