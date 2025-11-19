import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import styles from './SecretsTab.module.css';

interface AiProviderTabProps {
  userId?: string;
  onOAuthStateChange?: (inProgress: boolean) => void;
  onProviderChange?: () => void;
}

export function AiProviderTab({ userId, onOAuthStateChange, onProviderChange }: AiProviderTabProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // TODO: Save to backend
      const response = await fetch('/api/secrets/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      setSuccessMessage('OpenAI API key saved successfully');
      setApiKey('');
      onProviderChange?.();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>OpenAI Configuration</h3>
        <p className={styles.sectionDescription}>
          Configure your OpenAI API key for ChatKit integration
        </p>

        <div className={styles.formGroup}>
          <label className={styles.label}>OpenAI API Key</label>
          <input
            type="password"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            disabled={isLoading}
          />
        </div>

        {successMessage && (
          <div className={styles.successMessage}>
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className={styles.errorMessage}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          className={styles.primaryButton}
          onClick={handleSaveApiKey}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save API Key'}
        </button>
      </div>

      <div className={styles.section} style={{ marginTop: '24px' }}>
        <h3 className={styles.sectionTitle}>About OpenAI Integration</h3>
        <p className={styles.sectionDescription}>
          AppKit uses OpenAI's ChatKit SDK to power the widget builder.
          You'll need an OpenAI API key to create and manage Apps in ChatGPT.
        </p>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          Get your OpenAI API key →
        </a>
      </div>
    </div>
  );
}
