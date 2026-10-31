const prefix = 'careerforge:draft:';
const keyFor = (userId, resource) => prefix + encodeURIComponent(userId || '') + ':' + resource;
export function readDraft(userId, resource) {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const key = keyFor(userId, resource), value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value && value.expiresAt > Date.now()) return value;
    localStorage.removeItem(key);
  } catch { /* A corrupt or inaccessible browser cache must not block editing. */ }
  return null;
}
export function writeDraft(userId, resource, value, baseRevision, baseValue) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    localStorage.setItem(keyFor(userId, resource), JSON.stringify({ value, baseRevision, baseValue, updatedAt: Date.now(), expiresAt: Date.now() + 86400000 }));
    return true;
  } catch { return false; }
}
export function removeDraft(userId, resource) {
  try { localStorage.removeItem(keyFor(userId, resource)); } catch { /* Storage can be disabled. */ }
}
export function clearUserDrafts(userId) {
  if (!userId || typeof window === 'undefined') return;
  const scope = prefix + encodeURIComponent(userId) + ':';
  try { for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index); if (key?.startsWith(scope)) localStorage.removeItem(key);
  } } catch { /* Logging out still clears application state. */ }
}
