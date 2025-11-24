import { ReactNode, memo } from 'react'
import { Monitor } from 'lucide-react'
import { useResponsive } from '../../hooks/useResponsive'
import type { Project } from '../../types/project'

interface ResponsiveProjectContentProps {
  desktopContent: ReactNode // Original desktop content from ProjectContent
  // Unused props kept for backwards compatibility
  project?: Project | null
  onBack?: () => void
  selectedElementInput?: string
  selectedElements?: any[]
  onElementSelected?: (elementInfo: any) => void
  onExternalInputConsumed?: () => void
  onRemoveElement?: (index: number) => void
  onClearElements?: () => void
}

export const ResponsiveProjectContent = memo(function ResponsiveProjectContent({
  desktopContent,
}: ResponsiveProjectContentProps) {
  const { isMobile } = useResponsive()

  // Desktop view - use original content
  if (!isMobile) {
    return <>{desktopContent}</>
  }

  // Mobile view - Show "not supported yet" message
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '40px 20px',
        textAlign: 'center',
        background: 'var(--color-bg-primary)',
      }}
    >
      <Monitor
        size={64}
        style={{
          color: 'var(--color-text-tertiary)',
          marginBottom: '24px',
          opacity: 0.5,
        }}
      />
      <h2
        style={{
          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          margin: '0 0 12px 0',
        }}
      >
        Mobile View Not Supported Yet
      </h2>
      <p
        style={{
          fontSize: '1rem',
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6,
          maxWidth: '400px',
          margin: 0,
        }}
      >
        Please use a desktop or tablet device to access the project workspace. Mobile support is coming soon!
      </p>
    </div>
  )
})
