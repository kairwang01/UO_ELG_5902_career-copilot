// Firebase app initialisation — single instance for the front end.
// Pull config from Firebase console → Project settings → Your apps → Web app.

import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey:            "AIzaSyB0q76kzuGIpitpWlu93U_1AkftBnk7fPM",
  authDomain:        "career-copilot-a3168.firebaseapp.com",
  projectId:         "career-copilot-a3168",
  storageBucket:     "career-copilot-a3168.firebasestorage.app",
  messagingSenderId: "81653592395",
  appId:             "1:81653592395:web:8262a42e8cf362f8b2b8ce",
};

export const app = initializeApp(firebaseConfig);
