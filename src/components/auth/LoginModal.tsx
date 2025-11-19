import { Github } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import styles from './LoginModal.module.css'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { signInWithGitHub } = useAuth()

  if (!isOpen) return null

  const handleLogin = async () => {
    await signInWithGitHub()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          <h2 className={styles.title}>Sign in to continue</h2>
          <p className={styles.description}>
            Build and deploy Apps for ChatGPT with real-time preview and one-click deployment
          </p>

          <button className={styles.loginButton} onClick={handleLogin}>
            <Github size={20} />
            Continue with GitHub
          </button>

          <p className={styles.footer}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
