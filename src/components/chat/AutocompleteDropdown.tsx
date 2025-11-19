import type { AutocompleteDropdownProps, FileItem, CommandItem } from '../../types/chat'

export function AutocompleteDropdown({
  show,
  type,
  items,
  selectedIndex,
  onSelect,
  onMouseEnter,
}: AutocompleteDropdownProps) {
  if (!show || items.length === 0) return null

  return (
    <div className="autocomplete-dropdown">
      <div className="autocomplete-header">{type === 'files' ? 'Files' : 'Commands'}</div>
      {items.map((item, index) => {
        const isFile = type === 'files'
        const fileItem = item as FileItem
        const commandItem = item as CommandItem

        return (
          <div
            key={index}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onMouseEnter(index)}
          >
            {isFile ? (
              <>
                <span className="autocomplete-icon">{fileItem.is_directory ? '📁' : '📄'}</span>
                <span
                  className="autocomplete-name"
                  style={
                    {
                      // paddingLeft: `${(fileItem.level || 0) * 12}px`
                    }
                  }
                >
                  {fileItem.path}
                </span>
              </>
            ) : (
              <>
                <span className="autocomplete-name">{commandItem.name}</span>
                <span className="autocomplete-desc">{commandItem.description}</span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
