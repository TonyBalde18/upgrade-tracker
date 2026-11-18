/**
 * Your Firebase web app settings (Firebase console > Project settings > Your apps).
 *
 * These values are NOT secrets: every Firebase web app ships them to the browser.
 * The data is protected by Google sign-in plus the Firestore security rules,
 * which only let your own Google account read or write (see README).
 *
 * While apiKey is empty the app shows a "Firebase is not set up yet" screen.
 * This file is also read by vite.config.ts to build the Content-Security-Policy.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAWqcSToBuFlQhe1dB9jTYSz2TtB82neKI',
  authDomain: 'upgrade-tracker-87b5d.firebaseapp.com',
  projectId: 'upgrade-tracker-87b5d',
  appId: '1:853685597330:web:6d2b7c4fbbc2da9a92e24b',
}

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
