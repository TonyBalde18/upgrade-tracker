import { fonts, themes, tones, toneNames } from './brand'

/** Builds the CSS variable sheet from brand.ts and injects it once into <head>. */
export function buildTokenCss(): string {
  const block = (palette: Record<string, string>) =>
    Object.entries(palette)
      .map(([k, v]) => `--ut-${k}:${v};`)
      .join('')
  const toneVars = (mode: 'dark' | 'light') =>
    toneNames
      .map((t) => {
        const [fg, bg] = tones[t][mode]
        return `--tone-${t}-fg:${fg};--tone-${t}-bg:${bg};--tone-${t}-solid:${tones[t].solid};`
      })
      .join('')
  const fontVars = `--ut-font-heading:${fonts.heading};--ut-font-body:${fonts.body};--ut-font-mono:${fonts.mono};`
  return [
    `:root{${fontVars}${block(themes.light)}${toneVars('light')}color-scheme:light;}`,
    `:root.dark{${block(themes.dark)}${toneVars('dark')}color-scheme:dark;}`,
  ].join('\n')
}

export function injectTokens(): void {
  if (typeof document === 'undefined') return
  const id = 'ut-tokens'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = buildTokenCss()
  document.head.prepend(style)
}
