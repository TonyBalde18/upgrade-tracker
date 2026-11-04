import { format } from 'date-fns'
import { parseDocText } from '@/lib/migrations'
import type { TrackerDoc } from '@/lib/model/types'

/** Download the whole document as a JSON file. */
export function exportJson(doc: TrackerDoc): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `upgrade-tracker-export-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ask the user for a JSON file and parse/validate/migrate it. Resolves null if cancelled. */
export function pickJsonFile(): Promise<TrackerDoc | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        resolve(parseDocText(await file.text()))
      } catch (e) {
        reject(e)
      }
    }
    input.click()
  })
}
