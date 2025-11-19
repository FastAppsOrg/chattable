import { useState, useEffect, useCallback } from 'react'
import { BREAKPOINTS } from './useResponsive'

export type TabId = 'workspace' | 'chat' | 'preview' | 'terminal'

interface MobileNavigationState {
  activeTab: TabId
  previousTab: TabId | null
  drawerOpen: boolean
  tabHistory: TabId[]
}

interface UseMobileNavigationOptions {
  defaultTab?: TabId
  persistState?: boolean
}

const STORAGE_KEY = 'mobile-navigation-state'

export function useMobileNavigation(options: UseMobileNavigationOptions = {}) {
  const { defaultTab = 'chat', persistState = true } = options

  // Initialize state from sessionStorage if available
  const [state, setState] = useState<MobileNavigationState>(() => {
    if (persistState && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          return {
            activeTab: parsed.activeTab || defaultTab,
            previousTab: parsed.previousTab || null,
            drawerOpen: false, // Always start with drawer closed
            tabHistory: parsed.tabHistory || [defaultTab],
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }

    return {
      activeTab: defaultTab,
      previousTab: null,
      drawerOpen: false,
      tabHistory: [defaultTab],
    }
  })

  // Persist state to sessionStorage
  useEffect(() => {
    if (persistState && typeof window !== 'undefined') {
      const { drawerOpen, ...stateToPersist } = state
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist))
    }
  }, [state, persistState])

  // Switch to a specific tab
  const switchToTab = useCallback((tabId: TabId) => {
    setState((prev) => {
      // Don't update if already on the same tab
      if (prev.activeTab === tabId) {
        return prev
      }

      // Add to history, limiting to last 10 tabs
      const newHistory = [...prev.tabHistory.slice(-9), tabId]

      return {
        activeTab: tabId,
        previousTab: prev.activeTab,
        drawerOpen: false, // Close drawer when switching tabs
        tabHistory: newHistory,
      }
    })
  }, [])

  // Go back to previous tab
  const goToPreviousTab = useCallback(() => {
    setState((prev) => {
      if (!prev.previousTab) {
        return prev
      }

      return {
        ...prev,
        activeTab: prev.previousTab,
        previousTab: prev.activeTab,
        drawerOpen: false,
      }
    })
  }, [])

  // Toggle workspace drawer
  const toggleDrawer = useCallback((open?: boolean) => {
    setState((prev) => ({
      ...prev,
      drawerOpen: open !== undefined ? open : !prev.drawerOpen,
    }))
  }, [])

  // Open drawer
  const openDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, drawerOpen: true }))
  }, [])

  // Close drawer
  const closeDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, drawerOpen: false }))
  }, [])

  // Check if a tab is active
  const isTabActive = useCallback(
    (tabId: TabId) => {
      return state.activeTab === tabId
    },
    [state.activeTab],
  )

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle in mobile view
      if (window.innerWidth > BREAKPOINTS.mobile) return

      // Alt/Cmd + number to switch tabs
      if ((e.altKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        const tabIndex = parseInt(e.key) - 1
        const tabs: TabId[] = ['workspace', 'chat', 'preview', 'terminal']
        if (tabs[tabIndex]) {
          switchToTab(tabs[tabIndex])
        }
      }

      // Escape to close drawer
      if (e.key === 'Escape' && state.drawerOpen) {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.drawerOpen, switchToTab, closeDrawer])

  // Swipe gesture support for tab switching (optional enhancement)
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth > BREAKPOINTS.mobile) return

    let touchStartX = 0
    let touchEndX = 0
    const threshold = 50 // Minimum swipe distance

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
      handleSwipe()
    }

    const handleSwipe = () => {
      const swipeDistance = touchEndX - touchStartX

      if (Math.abs(swipeDistance) < threshold) return

      const tabs: TabId[] = ['workspace', 'chat', 'preview', 'terminal']
      const currentIndex = tabs.indexOf(state.activeTab)

      if (swipeDistance > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        switchToTab(tabs[currentIndex - 1])
      } else if (swipeDistance < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        switchToTab(tabs[currentIndex + 1])
      }
    }

    // Only add listeners for the content area, not the tab bar
    const contentArea = document.querySelector('.tab-content-area')
    if (contentArea) {
      contentArea.addEventListener('touchstart', handleTouchStart as EventListener)
      contentArea.addEventListener('touchend', handleTouchEnd as EventListener)

      return () => {
        contentArea.removeEventListener('touchstart', handleTouchStart as EventListener)
        contentArea.removeEventListener('touchend', handleTouchEnd as EventListener)
      }
    }
  }, [state.activeTab, switchToTab])

  return {
    activeTab: state.activeTab,
    previousTab: state.previousTab,
    drawerOpen: state.drawerOpen,
    tabHistory: state.tabHistory,
    switchToTab,
    goToPreviousTab,
    toggleDrawer,
    openDrawer,
    closeDrawer,
    isTabActive,
  }
}
