import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // In local mode, OAuth callback is not used
    // This component is kept for future Clerk integration
    // Just redirect to home for now
    navigate('/')
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
      </div>
    </div>
  )
}
