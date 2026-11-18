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
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
}

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
