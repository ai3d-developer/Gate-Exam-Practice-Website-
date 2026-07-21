import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAr-VuJ9PILcYH45V6-YZcP5T8dNAgXkD4",
  authDomain: "gate-cd3f0.firebaseapp.com",
  projectId: "gate-cd3f0",
  storageBucket: "gate-cd3f0.firebasestorage.app",
  messagingSenderId: "410331262912",
  appId: "1:410331262912:web:a2e64924444c4fc9d0a225",
  measurementId: "G-K9DGENWG3J"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Clearing flat student_logs from Firebase...");
set(ref(db, 'student_logs'), null)
  .then(() => {
    console.log("Success! student_logs cleared.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error clearing logs:", err);
    process.exit(1);
  });
