import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfigu = {
  apiKey: "AIzaSyB-lh_VYhkOksmr_4PeaeLv2qE75Sr1AU0",
  authDomain: "video-chat-aa104.firebaseapp.com",
  projectId: "video-chat-aa104",
  storageBucket: "video-chat-aa104.firebasestorage.app",
  messagingSenderId: "941197649827",
  appId: "1:941197649827:web:b5469a8154df2d2c9d9c16",
  measurementId: "G-3M4S6RW4G6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfigu);
export const auth = getAuth(app);
export const db = getFirestore(app);

