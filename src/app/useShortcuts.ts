import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { NAV } from './nav'
import { useUi } from '@/store/ui'
import { redo, undo } from '@/store/tracker'
import { saveNow } from '@/store/persistence'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Global keyboard shortcuts:
 *  Ctrl+K palette · / search · N new upgrade · G D/C/T/W go to · Ctrl+S save
 *  Ctrl+Z undo · Ctrl+Shift+Z (or Ctrl+Y) redo
 */
export function useShortcuts(): void {
  const navigate = useNavigate()

  useEffect(() => {
    let gPressedAt = 0

    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'k') {
        e.preventDefault()
        ui.setPaletteOpen(!ui.paletteOpen)
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        saveNow()
        return
      }
      const typing = isTyping(e.target)
      // inside text fields, leave Ctrl+Z to the browser's own text undo
      if (mod && !typing && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && !typing && key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (typing || mod || e.altKey) return
      // ignore while a dialog/palette is open
      if (ui.paletteOpen || ui.newUpgradeOpen || document.querySelector('[role="dialog"]')) return

      if (key === '/') {
        e.preventDefault()
        ui.openPalette()
        return
      }
      if (key === 'n') {
        e.preventDefault()
        ui.setNewUpgradeOpen(true)
        return
      }
      if (key === 'g') {
        gPressedAt = Date.now()
        return
      }
      if (gPressedAt && Date.now() - gPressedAt < 1200) {
        const target = NAV.find((n) => n.goKey === key)
        gPressedAt = 0
        if (target) {
          e.preventDefault()
          navigate(target.path)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
