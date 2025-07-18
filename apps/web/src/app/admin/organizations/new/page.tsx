'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './new.module.css';
import { getAvailableModules } from '../../../../lib/modules';

const AVAILABLE_MODULES = getAvailableModules();

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    selectedModules: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/admin/organizations');
      } else {
        setError(data.error || 'Failed to create organization');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleKey: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(moduleKey)
        ? prev.selectedModules.filter((m) => m !== moduleKey)
        : [...prev.selectedModules, moduleKey],
    }));
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Create New Organization</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h2>Organization Details</h2>

          <div className={styles.formGroup}>
            <label htmlFor="name">Organization Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className={styles.input}
              placeholder="London Heathrow Airport"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="code">IATA Code</label>
            <input
              id="code"
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
              maxLength={3}
              className={styles.input}
              placeholder="LHR"
              pattern="[A-Z]{3}"
            />
            <span className={styles.hint}>3-letter airport code</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Module Access</h2>
          <p className={styles.sectionDescription}>
            Select which modules this organization should have access to
          </p>

          <div className={styles.moduleGrid}>
            {AVAILABLE_MODULES.map((module) => (
              <div
                key={module.key}
                className={`${styles.moduleCard} ${
                  formData.selectedModules.includes(module.key) ? styles.selected : ''
                }`}
                onClick={() => toggleModule(module.key)}
              >
                <input
                  type="checkbox"
                  checked={formData.selectedModules.includes(module.key)}
                  onChange={() => {}}
                  className={styles.checkbox}
                />
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formActions}>
          <button type="button" onClick={() => router.back()} className={styles.cancelButton}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || formData.selectedModules.length === 0}
            className={styles.submitButton}
          >
            {loading ? 'Creating...' : 'Create Organization'}
          </button>
        </div>
      </form>
    </div>
  );
}
