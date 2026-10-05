/**
 * localStorage helpers with key migration.
 *
 * Keys use the `of.` prefix (OffshoreForge). Values saved under the old
 * `bw.` prefix are moved to the new key on first read, so a rename never
 * loses a user's settings. Every access is guarded: private mode or blocked
 * storage throws, and the app must keep working with in-memory state.
 */

const LEGACY_PREFIX = "bw.";
const PREFIX = "of.";

/** Read `key`; if absent, migrate the value stored under the legacy `bw.` key. */
export function readStored(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null || !key.startsWith(PREFIX)) return value;
    const legacyKey = LEGACY_PREFIX + key.slice(PREFIX.length);
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
    }
    return legacy;
  } catch {
    return null;
  }
}

/** Write `key`; returns false when storage is unavailable. */
export function writeStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
