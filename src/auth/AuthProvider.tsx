import { useEffect, useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from '../hooks/useAuth'

// Local user for development/local-first mode
const LOCAL_USER: User = {
  id: 'local-user',
  email: 'john.doe@example.com',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // In local mode, user is always logged in
  const [user, setUser] = useState<User | null>(LOCAL_USER)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Set local user immediately
    setUser(LOCAL_USER)
    setLoading(false)
  }, [])


  const signInWithGitHub = async () => {
    // In local mode, GitHub OAuth is not implemented
    // This keeps the UI intact for future Clerk integration
    setUser(LOCAL_USER)
  }

  const signOut = async () => {
    // In local mode, we just reset to the local user
    setUser(LOCAL_USER)
  }

  const getAccessToken = async (): Promise<string | null> => {
    // Return local-token for local mode
    return 'local-token'
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGitHub,
      signOut,
      getAccessToken,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
