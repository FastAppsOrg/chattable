import { LogIn, Github } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import styles from './GitHubReauthModal.module.css'

interface GitHubReauthModalProps {
  isOpen: boolean
  onClose: () => void
  message?: string
}

export function GitHubReauthModal({ isOpen, onClose, message }: GitHubReauthModalProps) {
  const { signInWithGitHub } = useAuth()

  if (!isOpen) return null

  const handleReauth = async () => {
    try {
      await signInWithGitHub()
      // The page will redirect to GitHub OAuth
    } catch (error) {
      console.error('Failed to initiate GitHub reauth:', error)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <Github size={24} />
          <h2>GitHub 연동 필요</h2>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            {message || '워크스페이스를 생성하려면 GitHub 계정 연동이 필요합니다.'}
          </p>
          <p className={styles.subMessage}>GitHub로 다시 로그인하여 권한을 부여해주세요.</p>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            취소
          </button>
          <button className={styles.authButton} onClick={handleReauth}>
            <LogIn size={16} />
            GitHub로 다시 로그인
          </button>
        </div>
      </div>
    </div>
  )
}
