/**
 * "Save now" (Ctrl+S, the sync button) without importing the Firebase code:
 * the cloud sync engine registers its flush function here once it is running.
 */
let saver: (() => void) | null = null

export function registerSaver(fn: (() => void) | null): void {
  saver = fn
}

export function saveNow(): void {
  saver?.()
}
