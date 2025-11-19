import { useEffect } from 'react'
import { useTheme } from './useTheme'

export const useThemeVariables = () => {
  const { theme } = useTheme()

  useEffect(() => {
    // Set data-theme attribute for CSS theming
    // Note: ThemeProvider already handles this, but keeping this
    // hook for backward compatibility and explicit control if needed
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
}
