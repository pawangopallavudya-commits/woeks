# Woex

Woex is a responsive web prototype that helps people discover, contact, and hire nearby skilled workers without exposing phone numbers. Workers can create a service "ticket" while hirers can browse profiles by city, trade, distance, and verification status.

> **Project status:** The checked-in app is a front-end demo. OTP verification, masked calling, and location matching are simulated; no real phone numbers are sent by the demo.

## Features

- Browse local workers across skilled trades, labour, businesses, and tech/freelance services
- Search and filter profiles by category, city, worker type, verified status, and saved profiles
- Worker registration flow with a simulated phone OTP
- Worker tickets with rates, experience, availability, profile details, and feedback
- In-app demo chat, call-request simulation, worker dashboard, and profile statistics
- Responsive layout for desktop and mobile devices

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript
- Optional Firebase Web SDK integration for Authentication and Cloud Firestore

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Application markup and the current demo JavaScript logic. |
| `profile.css` | Application styles, responsive rules, and accessibility-focused visual refinements. |
| `profile.js` *(optional)* | Suggested location for the supplied Firebase integration module. This file is not included in the current demo. |

## Run locally

No package installation or build step is required.

1. Open `index.html` in a modern browser.
2. Or, serve the folder through a local web server. For example:

   ```bash
   python3 -m http.server 8000
   ```

3. Visit `http://localhost:8000`.

Using a local server is recommended before enabling Firebase Phone Authentication, because the browser origin must be authorized in Firebase.

## Firebase integration

The supplied JavaScript module is designed to replace the demo-only parts of the app with:

- Firebase Phone Authentication with invisible reCAPTCHA
- Firestore-backed worker profiles in `workers`
- Live worker-list updates
- Real-time chat in `chats/{chatId}/messages`

### Setup

1. Create a Firebase project and register a Web app.
2. Enable **Phone** as a Firebase Authentication sign-in provider.
3. Create a Cloud Firestore database.
4. Add your local and production domains under Firebase Authentication's authorized domains.
5. Put the supplied Firebase code in `profile.js` and replace every `REPLACE_ME` value in `YOUR_FIREBASE_CONFIG` with your Firebase web-app configuration.
6. Add a reCAPTCHA host element to `index.html`:

   ```html
   <div id="recaptcha-container"></div>
   ```

7. Load the module before the app calls its Firebase-backed functions:

   ```html
   <script type="module" src="profile.js"></script>
   ```

8. Connect the existing UI rendering functions to `subscribeToWorkers`, `openChatReal`, and `sendChatReal` as indicated in the supplied integration code.

Do not place private server credentials in browser code. Firebase's public web configuration is intended for client use, but Firestore Security Rules must restrict reads and writes to the appropriate authenticated users.

## Notes for production

- The provided Firebase module supports phone OTP, profiles, and chat; it does **not** implement masked calling.
- Implement masked calling through a trusted backend or Firebase Cloud Function that securely calls a provider such as Twilio or Exotel. Never expose a provider API secret in client-side JavaScript.
- Add Firestore Security Rules, input validation, moderation/reporting workflows, privacy policy, and error handling before production release.

## License

No license has been specified for this project. Add a license file before distributing or reusing the code.
