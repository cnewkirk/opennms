import { createTheme, type Theme } from '@mui/material/styles'

/**
 * Builds a Perses/MUI theme by reading Feather DS CSS custom properties
 * from the computed style of document.documentElement at call time.
 *
 * Dark mode is detected via the 'open-dark' class on <html> — Feather DS
 * does NOT set --feather-color-scheme; it toggles a class instead.
 *
 * Call this at React subtree mount time (and re-call when dark mode changes).
 */
export function buildPersesTheme(): Theme {
  if (typeof document === 'undefined') {
    return createTheme()
  }

  // Dark mode = 'open-dark' class on <html>
  const mode = document.documentElement.classList.contains('open-dark') ? 'dark' : 'light'

  const style = getComputedStyle(document.documentElement)
  const get = (prop: string) => style.getPropertyValue(prop).trim()

  // --feather-primary-text-on-surface: rgb(255,255,255) in dark, rgb(0,0,0) in light
  const textPrimary = get('--feather-primary-text-on-surface') ||
    (mode === 'dark' ? '#ffffff' : '#212121')

  const background = get('--feather-background') ||
    (mode === 'dark' ? '#0a0c1b' : '#ffffff')

  const surface = get('--feather-surface') ||
    (mode === 'dark' ? '#15182b' : '#f5f5f5')

  return createTheme({
    palette: {
      mode,
      background: {
        default: background,
        paper: surface
      },
      text: {
        primary: textPrimary
      }
    }
  })
}
