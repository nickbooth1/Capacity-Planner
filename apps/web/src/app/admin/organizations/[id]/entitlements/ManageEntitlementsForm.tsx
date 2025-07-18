'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../organizations.module.css';

interface Module {
  key: string;
  name: string;
  description?: string;
}

interface ManageEntitlementsFormProps {
  organizationId: string;
  organizationName: string;
  availableModules: Module[];
  activeModules: string[];
}

export default function ManageEntitlementsForm({
  organizationId,
  organizationName,
  availableModules,
  activeModules,
}: ManageEntitlementsFormProps) {
  const router = useRouter();
  const [selectedModules, setSelectedModules] = useState<string[]>(activeModules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((key) => key !== moduleKey) : [...prev, moduleKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Find modules to add
      const modulesToAdd = selectedModules.filter((key) => !activeModules.includes(key));

      // Find modules to remove
      const modulesToRemove = activeModules.filter((key) => !selectedModules.includes(key));

      // Add new modules
      for (const moduleKey of modulesToAdd) {
        const response = await fetch('/api/admin/entitlements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId,
            moduleKey,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add module');
        }
      }

      // Remove deselected modules
      for (const moduleKey of modulesToRemove) {
        const response = await fetch('/api/admin/entitlements', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId,
            moduleKey,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove module');
        }
      }

      router.push('/admin/organizations');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.formGroup}>
        <label>Available Modules</label>
        <div style={{ marginTop: '0.5rem' }}>
          {availableModules.map((module) => (
            <label
              key={module.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: selectedModules.includes(module.key) ? '#eff6ff' : '#f9fafb',
                border: `2px solid ${selectedModules.includes(module.key) ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={selectedModules.includes(module.key)}
                onChange={() => handleToggleModule(module.key)}
                disabled={loading}
                style={{ marginRight: '0.75rem' }}
              />
              <div>
                <div style={{ fontWeight: 500 }}>{module.name}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {module.description || `Module key: ${module.key}`}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading || selectedModules.length === 0}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/organizations')}
          className={styles.cancelButton}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
