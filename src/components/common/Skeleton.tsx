interface SkeletonProps {
  width?: string
  height?: string
  borderRadius?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '4px', style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--color-bg-tertiary)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent, var(--color-bg-secondary), transparent)',
          animation: 'skeleton-loading 1.5s ease-in-out infinite',
        }}
      />
      <style>
        {`
          @keyframes skeleton-loading {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}
      </style>
    </div>
  )
}

interface WidgetCardSkeletonProps {
  count?: number
}

export function WidgetCardSkeleton({ count = 3 }: WidgetCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: '0 0 220px',
            padding: '16px',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Skeleton height="24px" width="60%" style={{ marginBottom: '12px' }} />
          <Skeleton height="16px" width="100%" style={{ marginBottom: '8px' }} />
          <Skeleton height="16px" width="80%" style={{ marginBottom: '16px' }} />
          <Skeleton height="32px" width="100%" borderRadius="6px" />
        </div>
      ))}
    </>
  )
}

export function WidgetPreviewSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        height: '100%',
      }}
    >
      <Skeleton height="40px" width="200px" />
      <Skeleton height="300px" width="100%" borderRadius="8px" />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Skeleton height="120px" width="48%" borderRadius="8px" />
        <Skeleton height="120px" width="48%" borderRadius="8px" />
      </div>
    </div>
  )
}

export function ToolCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: '0 0 280px',
            padding: '20px',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <Skeleton height="28px" width="70%" style={{ marginBottom: '12px' }} />
          <Skeleton height="18px" width="100%" style={{ marginBottom: '8px' }} />
          <Skeleton height="18px" width="90%" style={{ marginBottom: '16px' }} />
          <div style={{ marginBottom: '12px' }}>
            <Skeleton height="14px" width="50%" style={{ marginBottom: '8px' }} />
            <Skeleton height="36px" width="100%" borderRadius="6px" />
          </div>
          <Skeleton height="40px" width="100%" borderRadius="6px" />
        </div>
      ))}
    </>
  )
}
