import { useThemeVariables } from '@/hooks/useThemeVariables'

export const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  useThemeVariables()
  return <>{children}</>
}
