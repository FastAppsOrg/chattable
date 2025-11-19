import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import styles from './FloatingNavbar.module.css'

export interface FloatingNavbarProps {
  title?: string
  onBack?: () => void
  status?: {
    connected: boolean
    connecting?: boolean
    label?: string
  }
}

export const FloatingNavbar: React.FC<FloatingNavbarProps> = ({ title, onBack, status }) => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 10) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const handleSecretsClick = () => {
    navigate('/secrets')
    setIsUserMenuOpen(false)
  }

  const handleProjectsClick = () => {
    navigate('/projects')
    setIsUserMenuOpen(false)
  }

  if (!user) return null

  const getStatusText = () => {
    if (!status) return ''
    if (status.label) return status.label
    if (status.connecting) return 'Connecting...'
    return status.connected ? 'Connected' : 'Disconnected'
  }

  const getStatusClass = () => {
    if (!status) return ''
    if (status.connecting) return styles.statusConnecting
    return status.connected ? styles.statusConnected : styles.statusDisconnected
  }

  return (
    <nav className={`${styles.floatingNavbar} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.navbarContent}>
        <div className={styles.navbarLeft}>
          {onBack && (
            <button className={styles.backButton} onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 12L6 8l4-4"
                />
              </svg>
            </button>
          )}
          <div className={styles.navbarBrand}>
            <h1>{title || 'AppKit'}</h1>
          </div>
        </div>

        <div className={styles.navbarActions}>
          {status && (
            <span className={`${styles.status} ${getStatusClass()}`}>
              <span className={styles.statusDot}></span>
              {getStatusText()}
            </span>
          )}
          <div className={styles.userMenu}>
            <button
              className={styles.userMenuTrigger}
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="User menu"
            >
              <div className={styles.userAvatar}>{user.email?.charAt(0).toUpperCase() || 'U'}</div>
              {/* <span className={styles.userEmail}>{user.email}</span> */}
              <svg
                className={`${styles.dropdownIcon} ${isUserMenuOpen ? styles.dropdownIconOpen : ''}`}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                style={{ scale: '0.5' }}
              >
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>

            {isUserMenuOpen && (
              <div className={styles.userDropdown}>
                <div className={styles.dropdownHeader}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatarLarge}>
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className={styles.userDetails}>
                      <div className={styles.userName}>{user.email?.split('@')[0]}</div>
                      <div className={styles.userEmailSmall}>{user.email}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <button
                  className={styles.dropdownItem}
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                  {theme === 'dark' ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                </button>

                <button className={styles.dropdownItem} onClick={handleProjectsClick}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M2 4h12v8H2z" stroke="currentColor" fill="none" />
                  </svg>
                  Projects
                </button>

                <button className={styles.dropdownItem} onClick={handleSecretsClick}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M8 1L3 6v6h10V6L8 1z" stroke="currentColor" fill="none" />
                  </svg>
                  Secrets
                </button>

                <div className={styles.dropdownDivider} />

                <button
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={handleLogout}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M6 2H3v12h3M11 8l3-3-3-3M6 8h8" stroke="currentColor" fill="none" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
