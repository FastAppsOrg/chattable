import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectContent } from './ProjectContent'
import { BrowserRouter } from 'react-router-dom'

// Mock dependencies
vi.mock('../../hooks/useContainerHealth', () => ({
  useContainerHealth: () => ({
    health: {
      container_status: 'running',
      preview_status: 'running',
      dev_running: true,
      preview_url: 'http://localhost:3000',
      is_ready: true,
      message: null,
      setup_progress: null,
    },
    isRestarting: false,
    isChecking: false,
  }),
}))

vi.mock('../../services/api/project', () => ({
  ProjectService: {
    waitForProjectReady: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    loading: false,
    messagesEndRef: { current: null },
    addMessage: vi.fn(),
    sendMessage: vi.fn(),
    setLoading: vi.fn(),
  }),
}))

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    connected: true,
    isProcessing: false,
    sendMessage: vi.fn(),
    sendAbort: vi.fn(),
    wsService: null,
  }),
}))

vi.mock('@/hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    showAutocomplete: false,
    autocompleteType: null,
    autocompleteItems: [],
    selectedIndex: 0,
    handleInputChange: vi.fn(),
    selectAutocompleteItem: vi.fn(),
    handleKeyDown: vi.fn(() => ({ handled: false })),
    setSelectedIndex: vi.fn(),
    handleFileResults: vi.fn(),
    handleCommandResults: vi.fn(),
  }),
}))

const mockProject = {
  project_id: 'test-project-id',
  name: 'Test Project',
  git_branch: 'main',
  git_url: 'https://github.com/test/repo',
  is_scaffold: false,
  status: 'ready' as const,
  created_at: '2024-01-01T00:00:00Z',
  default_branch: 'main',
}

describe('ProjectContent - Chat Floating Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders docked layout by default', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    await waitFor(() => {
      // Should have horizontal panel group for docked layout
      const panelGroups = document.querySelectorAll('.project-content-panels')
      expect(panelGroups.length).toBeGreaterThan(0)
    })

    // Floating chat panel should not exist
    const floatingPanel = document.querySelector('.floating-chat-panel')
    expect(floatingPanel).toBeNull()
  })

  it('toggles to floating layout when toggle button is clicked', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    // Initially in docked mode
    let floatingPanel = document.querySelector('.floating-chat-panel')
    expect(floatingPanel).toBeNull()

    // Click toggle button
    const toggleButton = await screen.findByTitle('Float Chat Panel')
    await userEvent.click(toggleButton)

    // Should now show floating panel
    await waitFor(() => {
      floatingPanel = document.querySelector('.floating-chat-panel')
      expect(floatingPanel).toBeInTheDocument()
    })

    // Should have specific floating styles
    expect(floatingPanel).toHaveStyle({
      position: 'fixed',
      bottom: '24px',
      left: '24px',
    })
  })

  it('toggles back to docked layout when clicking toggle again', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    // Toggle to floating
    const toggleButton = await screen.findByTitle('Float Chat Panel')
    await userEvent.click(toggleButton)

    await waitFor(() => {
      const floatingPanel = document.querySelector('.floating-chat-panel')
      expect(floatingPanel).toBeInTheDocument()
    })

    // Toggle back to docked
    const dockButton = await screen.findByTitle('Dock Chat Panel')
    await userEvent.click(dockButton)

    await waitFor(() => {
      const floatingPanel = document.querySelector('.floating-chat-panel')
      expect(floatingPanel).toBeNull()
    })

    // Should show horizontal panel layout again
    const panelGroups = document.querySelectorAll('.project-content-panels')
    expect(panelGroups.length).toBeGreaterThan(0)
  })

  it('expands preview area in floating mode', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    // Toggle to floating mode
    const toggleButton = await screen.findByTitle('Float Chat Panel')
    await userEvent.click(toggleButton)

    await waitFor(() => {
      // In floating mode, should only have vertical panel group (no horizontal split)
      const rightPanelGroup = document.querySelector('.right-panel-group')
      expect(rightPanelGroup).toBeInTheDocument()

      // Should NOT have horizontal project-content-panels
      const horizontalPanels = document.querySelector('.project-content-panels')
      expect(horizontalPanels).toBeNull()
    })
  })

  it('renders floating panel with correct dimensions', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    const toggleButton = await screen.findByTitle('Float Chat Panel')
    await userEvent.click(toggleButton)

    await waitFor(() => {
      const floatingPanel = document.querySelector('.floating-chat-panel')
      expect(floatingPanel).toHaveStyle({
        width: '400px',
        height: '600px',
        maxHeight: 'calc(100vh - 100px)',
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        zIndex: '1000',
      })
    })
  })

  it('maintains chat panel content across layout changes', async () => {
    render(
      <BrowserRouter>
        <ProjectContent project={mockProject} />
      </BrowserRouter>
    )

    // Toggle to floating
    const toggleButton = await screen.findByTitle('Float Chat Panel')
    await userEvent.click(toggleButton)

    await waitFor(() => {
      // Chat panel should still be present
      const chatPanels = document.querySelectorAll('.chat-panel')
      expect(chatPanels.length).toBeGreaterThan(0)
    })
  })
})
