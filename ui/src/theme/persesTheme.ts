import { createTheme, type Theme } from '@mui/material/styles'

/**
 * Builds a Perses/MUI theme by reading Feather DS CSS custom properties
 * from the computed style of document.body at call time.
 *
 * Call this at React subtree mount time (and re-call when dark mode changes).
 */
export function buildPersesTheme(): Theme {
  const style = getComputedStyle(document.body)
  const get = (prop: string) => style.getPropertyValue(prop).trim()

  const mode = get('--feather-color-scheme') === 'dark' ? 'dark' : 'light'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: get('--feather-primary-interactive-default') || '#1976d2'
      },
      background: {
        default: get('--feather-background') || (mode === 'dark' ? '#121212' : '#ffffff'),
        paper:   get('--feather-surface-fill') || (mode === 'dark' ? '#1e1e1e' : '#f5f5f5')
      },
      text: {
        primary: get('--feather-text-color') || (mode === 'dark' ? '#ffffff' : '#212121')
      }
    }
  })
}
