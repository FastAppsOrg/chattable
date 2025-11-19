import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreviewModeSelector } from './PreviewModeSelector'

describe('PreviewModeSelector', () => {
  it('renders current mode correctly', () => {
    const handleModeChange = vi.fn()

    render(
      <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
    )

    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('shows dropdown when clicked', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
    )

    // Click to open dropdown
    await user.click(screen.getByText('Preview'))

    // Check that mode options are visible (Code is now in separate toggle button)
    expect(screen.getByText('Agent Builder')).toBeInTheDocument()
    expect(screen.getByText('Task Builder')).toBeInTheDocument()
    expect(screen.queryByText('Code')).not.toBeInTheDocument() // Code removed from dropdown
  })

  it('calls onModeChange when selecting a new mode', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PreviewModeSelector currentMode="agent-builder" onModeChange={handleModeChange} />
    )

    // Open dropdown
    await user.click(screen.getByText('Agent Builder'))

    // Click on Preview mode (since other modes are disabled)
    const previewOption = screen.getByText('View your application')
    await user.click(previewOption)

    expect(handleModeChange).toHaveBeenCalledWith('preview')
  })

  it('shows "Coming soon" for disabled modes', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
    )

    // Open dropdown
    await user.click(screen.getByText('Preview'))

    // Check that disabled modes show "Coming soon"
    const comingSoonTexts = screen.getAllByText('Coming soon')
    expect(comingSoonTexts.length).toBeGreaterThan(0)
  })

  it('does not call onModeChange for disabled modes', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
    )

    // Open dropdown
    await user.click(screen.getByText('Preview'))

    // Try to click on disabled Agent Builder mode
    const agentBuilderOption = screen.getByText('Agent Builder')
    await user.click(agentBuilderOption)

    // Should not call the handler
    expect(handleModeChange).not.toHaveBeenCalled()
  })

  it('closes dropdown when clicking outside', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    const { container } = render(
      <div>
        <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
        <div data-testid="outside">Outside element</div>
      </div>
    )

    // Open dropdown
    await user.click(screen.getByText('Preview'))

    // Verify dropdown is open
    expect(screen.getByText('Agent Builder')).toBeInTheDocument()

    // Click outside
    await user.click(screen.getByTestId('outside'))

    // Dropdown should be closed
    expect(screen.queryByText('Agent Builder')).not.toBeInTheDocument()
  })

  it('displays active indicator for current mode', async () => {
    const handleModeChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PreviewModeSelector currentMode="preview" onModeChange={handleModeChange} />
    )

    // Open dropdown
    await user.click(screen.getByText('Preview'))

    // Check that active indicator (✓) is present
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    const handleModeChange = vi.fn()

    render(
      <PreviewModeSelector
        currentMode="preview"
        onModeChange={handleModeChange}
        disabled={true}
      />
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })
})
