import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { GitHubService, type Repository } from '../../services/github.service'
import styles from './RepositorySelector.module.css'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface RepositorySelectorProps {
  onSelect: (repo: Repository | null) => void
  selectedRepo: Repository | null
}

export function RepositorySelector({ onSelect, selectedRepo }: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { getAccessToken } = useAuth()

  useEffect(() => {
    fetchRepositories()
  }, [])

  const fetchRepositories = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Not authenticated')
        return
      }

      const data = await GitHubService.fetchRepositories(token)
      setRepositories(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setRepositories([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const handleSelect = (repo: Repository | null) => {
    onSelect(repo)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      })
    }
    setIsOpen(!isOpen)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // Check if click is inside the portal dropdown
        const portalElement = document.getElementById('repository-dropdown-portal')
        if (portalElement && !portalElement.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleDropdown}
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ''}`}
      >
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        {selectedRepo ? (
          <div className={styles.selectedRepo}>
            <img
              src={selectedRepo.owner.avatar_url}
              alt={selectedRepo.owner.login}
              className={styles.repoAvatar}
            />
            <div className={styles.repoInfo}>
              <span className={styles.repoName}>
                {selectedRepo.full_name}
                {selectedRepo.private && <span className={styles.privateBadge}>Private</span>}
              </span>
            </div>
          </div>
        ) : (
          <span className={styles.placeholder}>New repository</span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            id="repository-dropdown-portal"
            className={styles.dropdownMenu}
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            <div className={styles.searchBox}>
              <div style={{ position: 'relative' }}>
                <svg
                  className={styles.searchIcon}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className={styles.repoList}>
              {/* None option */}
              {selectedRepo && (
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={`${styles.repoOption} ${styles.noneOption}`}
                >
                  <div className={styles.repoContent}>
                    <div className="w-5 h-5" />
                    <div className={styles.repoDetails}>
                      <div className={styles.repoFullName}>None (empty workspace)</div>
                    </div>
                  </div>
                </button>
              )}

              {loading && (
                <div className={styles.loading}>
                  <div className={styles.loadingSpinner}></div>
                  Loading repositories...
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}

              {!loading && !error && filteredRepos.length === 0 && (
                <div className={styles.empty}>
                  {searchTerm ? 'No repositories found' : 'No repositories available'}
                </div>
              )}

              {filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelect(repo)}
                  className={`${styles.repoOption} ${selectedRepo?.id === repo.id ? styles.selected : ''}`}
                >
                  <div className={styles.repoContent}>
                    <img
                      src={repo.owner.avatar_url}
                      alt={repo.owner.login}
                      className={styles.repoAvatar}
                    />
                    <div className={styles.repoDetails}>
                      <div className={styles.repoTitle}>
                        <span className={styles.repoFullName}>{repo.full_name}</span>
                        {repo.private && <span className={styles.privateBadge}>Private</span>}
                      </div>
                      {repo.description && (
                        <p className={styles.repoDescription}>{repo.description}</p>
                      )}
                      <div className={styles.repoMeta}>
                        {repo.language && (
                          <span className={styles.metaItem}>
                            <span
                              className={styles.languageDot}
                              data-language={repo.language}
                            ></span>
                            {repo.language}
                          </span>
                        )}
                        <span className={styles.metaItem}>
                          Updated {new Date(repo.updated_at).toLocaleDateString()}
                        </span>
                        {repo.stargazers_count > 0 && (
                          <span className={`${styles.metaItem} ${styles.starIcon}`}>
                            ⭐ {repo.stargazers_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
