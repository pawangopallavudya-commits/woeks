

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, RecaptchaVerifier, signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, updateDoc, addDoc,
  onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const YOUR_FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const app = initializeApp(YOUR_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- 1. REAL PHONE OTP (replaces sendOtp / verifyOtp) ---------- */

let confirmationResult = null;

function ensureRecaptcha() {
  // Firebase needs an invisible reCAPTCHA container. Add
  // <div id="recaptcha-container"></div> once, anywhere in your HTML.
  if (!window._recaptchaVerifier) {
    window._recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }
  return window._recaptchaVerifier;
}

async function sendOtp() {
  const val = document.getElementById('phone-input').value.trim();
  if (val.length < 10) { showToast('Enter a valid 10-digit mobile number'); return; }
  state.phone = val;
  const fullNumber = "+91" + val; // adjust country code as needed

  try {
    const verifier = ensureRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, fullNumber, verifier);
    state.authStep = 'otp';
    renderAuth();
    showToast('OTP sent to your phone');
  } catch (err) {
    console.error(err);
    showToast('Could not send OTP — check the number and try again');
  }
}

async function verifyOtp() {
  const val = document.getElementById('otp-input').value.trim();
  if (val.length < 4) { showToast('Enter the OTP you received'); return; }
  try {
    const result = await confirmationResult.confirm(val);
    // result.user.uid is now your durable, verified account ID.
    state.authedUid = result.user.uid;

    if (state.role === 'worker') {
      const existing = await findWorkerByUid(result.user.uid);
      if (existing) {
        state.myId = existing.id;
        state.regType = existing.regType;
        state.editMode = true;
        showToast(`Welcome back, ${existing.name}`);
      } else {
        state.myId = null;
        state.editMode = false;
      }
      state.authStep = 'profile';
      renderAuth();
    } else {
      showToast('Number verified — welcome!');
      go('browse');
    }
  } catch (err) {
    console.error(err);
    showToast('Incorrect OTP — please try again');
  }
}

/* ---------- 2. SAVE / LOAD WORKER PROFILES (replaces the in-memory array) ---------- */

async function createProfile() {
  if (state.selectedAvatar === null) { showToast('Please choose a profile photo style'); return; }
  const name = document.getElementById('p-name').value.trim();
  if (!name) { showToast('Please enter a name'); return; }

  const profileData = {
    ownerUid: state.authedUid,
    name,
    category: document.getElementById('p-category').value,
    city: document.getElementById('p-city').value,
    rate: document.getElementById('p-rate').value.trim() || 'Ask for rate',
    availability: document.getElementById('p-availability').value,
    bio: document.getElementById('p-bio').value.trim() || 'Available for work.',
    exp: parseInt(document.getElementById(state.regType === 'business' ? 'p-teamsize' : 'p-exp').value) || 0,
    gender: state.regType === 'business' ? 'Team' : document.getElementById('p-gender').value,
    regType: state.regType,
    avatar: AVATAR_STYLES[state.selectedAvatar % AVATAR_STYLES.length],
    avatarColor: AVATAR_COLORS[state.selectedAvatar % AVATAR_COLORS.length],
    skills: state.regType === 'tech' ? [...state.selectedSkills] : null,
    verified: false,
    paused: false,
    views: 0, chats: 0, calls: 0,
    allowCalls: true,
    updatedAt: serverTimestamp(),
  };

  const docRef = state.myId
    ? doc(db, "workers", state.myId)
    : doc(collection(db, "workers")); // auto-generates an ID

  await setDoc(docRef, profileData, { merge: true });
  state.myId = docRef.id;
  go('dashboard');
  showToast(state.editMode ? 'Profile updated' : 'Your ticket is published!');
}

async function findWorkerByUid(uid) {
  // Simple version: query once. For frequent lookups, cache this.
  const q = query(collection(db, "workers"), where("ownerUid", "==", uid));
  return new Promise((resolve) => {
    const unsub = onSnapshot(q, (snap) => {
      unsub();
      if (snap.empty) return resolve(null);
      const d = snap.docs[0];
      resolve({ id: d.id, ...d.data() });
    });
  });
}

// Keeps a live, always-current copy of every non-paused worker.
// Call this once on app load; render from `workersCache` instead of the
// old hardcoded `workers` array.
let workersCache = [];
function subscribeToWorkers(onChange) {
  const q = query(collection(db, "workers"), where("paused", "==", false));
  return onSnapshot(q, (snap) => {
    workersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(workersCache);
  });
}

/* ---------- 3. REAL-TIME CHAT (replaces openChat / sendChat's setTimeout fake reply) ---------- */

function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join('_'); // stable id regardless of who opens first
}

async function openChatReal(workerOwnerUid) {
  const chatId = chatIdFor(state.authedUid, workerOwnerUid);
  const chatDocRef = doc(db, "chats", chatId);
  await setDoc(chatDocRef, { participants: [state.authedUid, workerOwnerUid] }, { merge: true });

  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));
  onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => d.data());
    renderChatMessages(messages); // write this to match your existing bubble markup
  });

  return chatId;
}

async function sendChatReal(chatId, text) {
  if (!text.trim()) return;
  await addDoc(collection(db, "chats", chatId, "messages"), {
    from: state.authedUid,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

/* ---------- Notes ---------- */
// - Masked calling isn't included here — it needs a server-side Cloud
//   Function calling Exotel/Twilio, since the provider API key can't
//   live in browser JS. See LAUNCH_GUIDE.md, step 3.
// - Reviews/feedback follow the same pattern as chat messages: a
//   subcollection under each worker doc, e.g. workers/{id}/feedback.