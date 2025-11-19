import { Folder, MessageSquare, Monitor, Terminal } from 'lucide-react'
import type { Tab } from './MobileTabContainer'

// Default tab configuration
export const DEFAULT_TABS: Omit<Tab, 'content'>[] = [
  {
    id: 'workspace', // Keep ID as 'workspace' for backward compatibility
    label: 'Project',
    icon: Folder,
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: Monitor,
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: Terminal,
  },
]
