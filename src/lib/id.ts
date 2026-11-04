/** Short, URL-safe random id with a readable prefix, e.g. "upg_k3f9x2a1q8". */
export function newId(prefix: string): string {
  let rand: string
  try {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    rand = Array.from(bytes, (b) => (b % 36).toString(36)).join('')
  } catch {
    rand = Math.random().toString(36).slice(2, 10)
  }
  return `${prefix}_${rand}${Date.now().toString(36).slice(-3)}`
}
