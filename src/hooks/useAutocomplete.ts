import { useState, useCallback, useRef, useEffect } from 'react'
import type { FileItem, CommandItem } from '../types/chat'
import { ChatService } from '../services/api/chat'
import { ChatWebSocketService } from '../services/websocket/chat'
import { API_ENDPOINTS, API_BASE_URL } from '../constants/api'

export function useAutocomplete(
  workspaceId: string,
  wsService?: () => ChatWebSocketService | null,
) {
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteType, setAutocompleteType] = useState<'files' | 'commands' | null>(null)
  const [autocompleteItems, setAutocompleteItems] = useState<(FileItem | CommandItem)[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [triggerPosition, setTriggerPosition] = useState(0)

  // Debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  // Flatten file tree for autocomplete
  const flattenFileTree = useCallback((files: FileItem[], result: FileItem[] = []): FileItem[] => {
    for (const file of files) {
      result.push(file)
      if (file.children) {
        flattenFileTree(file.children, result)
      }
    }
    return result
  }, [])

  // Fetch files for autocomplete
  const fetchFiles = useCallback(
    async (query: string = '') => {
      try {
        // Use WebSocket if available and connected
        const ws = wsService?.()
        if (ws && ws.isConnected()) {
          // WebSocket will trigger onFileResults callback
          ws.searchFiles(query)
          return
        }

        // Fall back to REST API with query parameter
        const url = `${API_BASE_URL}${API_ENDPOINTS.projectFiles(workspaceId)}?recursive=true&query=${encodeURIComponent(query)}`
        const response = await fetch(url)
        const data = await response.json()

        if (data.error) {
          console.error('Failed to fetch files:', data.error)
          setAutocompleteItems([])
          setShowAutocomplete(false)
          return
        }

        if (data.files) {
          // Flatten the tree structure for autocomplete
          const flatFiles = flattenFileTree(data.files as FileItem[])

          // Sort by relevance and depth (same logic as WebSocket handler)
          flatFiles.sort((a, b) => {
            // If there's a query, prioritize exact matches
            if (query) {
              const aNameMatch = a.name.toLowerCase().includes(query.toLowerCase())
              const bNameMatch = b.name.toLowerCase().includes(query.toLowerCase())
              const aPathMatch = a.path.toLowerCase().includes(query.toLowerCase())
              const bPathMatch = b.path.toLowerCase().includes(query.toLowerCase())

              // Exact name matches first
              const aExact = a.name.toLowerCase() === query.toLowerCase()
              const bExact = b.name.toLowerCase() === query.toLowerCase()
              if (aExact && !bExact) return -1
              if (!aExact && bExact) return 1

              // Then name contains query
              if (aNameMatch && !bNameMatch) return -1
              if (!aNameMatch && bNameMatch) return 1

              // Then path contains query
              if (aPathMatch && !bPathMatch) return -1
              if (!aPathMatch && bPathMatch) return 1
            }

            // Files before directories
            if (a.is_directory !== b.is_directory) {
              return a.is_directory ? 1 : -1
            }

            // Sort by depth (deeper/more specific files first)
            const aDepth = a.path.split('/').length
            const bDepth = b.path.split('/').length
            if (aDepth !== bDepth) {
              return bDepth - aDepth
            }

            // Finally, alphabetically by path
            return a.path.localeCompare(b.path)
          })

          setAutocompleteItems(flatFiles.slice(0, 50)) // Show more items since backend filters
        }
      } catch (err) {
        console.error('Failed to fetch files:', err)
        setAutocompleteItems([]) // Clear items on error
        setShowAutocomplete(false)
      }
    },
    [workspaceId, flattenFileTree, wsService],
  )

  // Fetch commands for autocomplete
  const fetchCommands = useCallback(
    async (query: string = '') => {
      try {
        // Use WebSocket if available and connected
        const ws = wsService?.()
        if (ws && ws.isConnected()) {
          ws.searchCommands(query)
          return
        }

        // Fall back to REST API
        const commands = await ChatService.fetchCommands(workspaceId)

        let filteredCommands = commands

        // Filter by query if provided
        if (query && Array.isArray(commands)) {
          filteredCommands = commands.filter(
            (c) =>
              c.name.toLowerCase().includes(query.toLowerCase()) ||
              c.description.toLowerCase().includes(query.toLowerCase()),
          )
        }

        setAutocompleteItems(filteredCommands)
      } catch (err) {
        console.error('Failed to fetch commands:', err)
        // Commands already have fallback in service, but clear autocomplete on critical error
        if (err instanceof Error && err.message.includes('Network error')) {
          setAutocompleteItems([])
          setShowAutocomplete(false)
        }
      }
    },
    [workspaceId, wsService],
  )

  // Handle input change for autocomplete
  const handleInputChange = useCallback(
    (value: string, cursorPosition: number) => {
      // Early return if no triggers present - skip expensive operations
      if (!value.includes('@') && !value.includes('/')) {
        if (showAutocomplete) {
          setShowAutocomplete(false)
        }
        return
      }

      // Check for @ or / triggers
      const textBeforeCursor = value.substring(0, cursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')
      const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

      // Clear existing debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      // Check if we should show file autocomplete (@)
      if (lastAtIndex !== -1 && lastAtIndex > lastSlashIndex) {
        // Check if @ is still active (no space after it)
        const afterAt = textBeforeCursor.substring(lastAtIndex + 1)
        if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
          setShowAutocomplete(true)
          setAutocompleteType('files')
          setAutocompleteQuery(afterAt)
          setTriggerPosition(lastAtIndex)
          setSelectedIndex(0)

          // Debounce file search (100ms delay)
          debounceTimer.current = setTimeout(() => {
            fetchFiles(afterAt)
          }, 100)
        } else {
          setShowAutocomplete(false)
        }
      }
      // Check if we should show command autocomplete (/)
      else if (
        lastSlashIndex !== -1 &&
        (lastSlashIndex === 0 ||
          textBeforeCursor[lastSlashIndex - 1] === '\n' ||
          textBeforeCursor[lastSlashIndex - 1] === ' ')
      ) {
        const afterSlash = textBeforeCursor.substring(lastSlashIndex + 1)
        if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
          setShowAutocomplete(true)
          setAutocompleteType('commands')
          setAutocompleteQuery(afterSlash)
          setTriggerPosition(lastSlashIndex)
          setSelectedIndex(0)

          // Debounce command search (100ms delay)
          debounceTimer.current = setTimeout(() => {
            fetchCommands(afterSlash)
          }, 100)
        } else {
          setShowAutocomplete(false)
        }
      } else {
        setShowAutocomplete(false)
      }
    },
    [fetchFiles, fetchCommands, showAutocomplete],
  )

  // Handle autocomplete selection
  const selectAutocompleteItem = useCallback(
    (item: FileItem | CommandItem, currentInput: string) => {
      const beforeTrigger = currentInput.substring(0, triggerPosition)
      const afterCursor = currentInput.substring(triggerPosition + autocompleteQuery.length + 1)

      let insertion = ''
      if (autocompleteType === 'files') {
        const fileItem = item as FileItem
        insertion = `@${fileItem.path} `
      } else {
        const commandItem = item as CommandItem
        insertion = `${commandItem.name} `
      }

      const newInput = beforeTrigger + insertion + afterCursor
      setShowAutocomplete(false)

      return newInput
    },
    [autocompleteType, triggerPosition, autocompleteQuery],
  )

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentInput: string): { handled: boolean; newInput?: string } => {
      if (showAutocomplete && autocompleteItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % autocompleteItems.length)
          return { handled: true }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(
            (prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length,
          )
          return { handled: true }
        } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          const newInput = selectAutocompleteItem(autocompleteItems[selectedIndex], currentInput)
          return { handled: true, newInput }
        } else if (e.key === 'Escape') {
          setShowAutocomplete(false)
          return { handled: true }
        }
      }
      return { handled: false }
    },
    [showAutocomplete, autocompleteItems, selectedIndex, selectAutocompleteItem],
  )

  const hideAutocomplete = useCallback(() => {
    setShowAutocomplete(false)
  }, [])

  // Handle WebSocket file results
  const handleFileResults = useCallback(
    (files: FileItem[], query: string) => {
      // Always process file results when they arrive
      const flatFiles = flattenFileTree(files || [])

      // Sort by relevance and depth
      flatFiles.sort((a, b) => {
        // If there's a query, prioritize exact matches
        if (query) {
          const aNameMatch = a.name.toLowerCase().includes(query.toLowerCase())
          const bNameMatch = b.name.toLowerCase().includes(query.toLowerCase())
          const aPathMatch = a.path.toLowerCase().includes(query.toLowerCase())
          const bPathMatch = b.path.toLowerCase().includes(query.toLowerCase())

          // Exact name matches first
          const aExact = a.name.toLowerCase() === query.toLowerCase()
          const bExact = b.name.toLowerCase() === query.toLowerCase()
          if (aExact && !bExact) return -1
          if (!aExact && bExact) return 1

          // Then name contains query
          if (aNameMatch && !bNameMatch) return -1
          if (!aNameMatch && bNameMatch) return 1

          // Then path contains query
          if (aPathMatch && !bPathMatch) return -1
          if (!aPathMatch && bPathMatch) return 1
        }

        // Files before directories (for autocomplete, files are usually the target)
        if (a.is_directory !== b.is_directory) {
          return a.is_directory ? 1 : -1
        }

        // Sort by depth (deeper/more specific files first)
        const aDepth = a.path.split('/').length
        const bDepth = b.path.split('/').length
        if (aDepth !== bDepth) {
          return bDepth - aDepth // Higher depth first
        }

        // Finally, alphabetically by path
        return a.path.localeCompare(b.path)
      })

      const items = flatFiles.slice(0, 50)

      // Always set items and show dropdown when we get file results
      setAutocompleteItems(items)
      setAutocompleteType('files')
      setShowAutocomplete(true)
    },
    [flattenFileTree],
  )

  // Handle WebSocket command results
  const handleCommandResults = useCallback((commands: CommandItem[], _query: string) => {
    // Always set items and show dropdown when we get command results
    setAutocompleteItems(commands || [])
    setAutocompleteType('commands')
    setShowAutocomplete(true)
  }, [])

  return {
    showAutocomplete,
    autocompleteType,
    autocompleteItems,
    selectedIndex,
    handleInputChange,
    selectAutocompleteItem,
    handleKeyDown,
    hideAutocomplete,
    setSelectedIndex,
    handleFileResults,
    handleCommandResults,
  }
}
