'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../organizations.module.css';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface EditOrganizationFormProps {
  organization: Organization;
}

export default function EditOrganizationForm({ organization }: EditOrganizationFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: organization.name,
    code: organization.code,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/organizations/${organization.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      router.push('/admin/organizations');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm('Are you sure you want to delete this organization? This action cannot be undone.')
    ) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/organizations/${organization.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete organization');
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
        <label htmlFor="name">Organization Name</label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="code">IATA Code</label>
        <input
          type="text"
          id="code"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          pattern="[A-Z]{3}"
          maxLength={3}
          required
          disabled={loading}
        />
        <small>3-letter uppercase code (e.g., LAX, JFK)</small>
      </div>

      <div className={styles.buttonGroup}>
        <button type="submit" className={styles.submitButton} disabled={loading}>
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

        <button
          type="button"
          onClick={handleDelete}
          className={styles.deleteButton}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          Delete Organization
        </button>
      </div>
    </form>
  );
}
