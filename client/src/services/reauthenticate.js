export async function googleProof() {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const app = getApps()[0] || initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(getAuth(app), provider);
  return { idToken: await result.user.getIdToken(true) };
}
