'use client';

import { useState, useEffect } from 'react';
import styles from './audit-log.module.css';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: any;
  performedBy: string;
  performedAt: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
}

interface Props {
  initialLogs: AuditLog[];
  totalCount: number;
}

export default function AuditLogClient({ initialLogs, totalCount }: Props) {
  const [logs, setLogs] = useState(initialLogs || []);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    performedBy: '',
    dateFrom: '',
    dateTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(totalCount || 0);

  const pageSize = 50;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });

      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.action) params.append('action', filters.action);
      if (filters.performedBy) params.append('performedBy', filters.performedBy);
      if (filters.dateFrom) params.append('startDate', filters.dateFrom);
      if (filters.dateTo) params.append('endDate', filters.dateTo);

      const response = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (page > 0 || Object.values(filters).some((v) => v)) {
      fetchLogs();
    }
  }, [page, filters]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return styles.actionCreate;
      case 'updated':
        return styles.actionUpdate;
      case 'deleted':
        return styles.actionDelete;
      case 'login':
        return styles.actionLogin;
      default:
        return '';
    }
  };

  const getEntityTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const renderChanges = (changes: any) => {
    if (!changes) return '-';

    if (typeof changes === 'object') {
      const keys = Object.keys(changes);
      if (keys.length === 0) return '-';

      return (
        <div className={styles.changes}>
          {keys.map((key) => (
            <div key={key}>
              <span className={styles.changeKey}>{key}:</span>{' '}
              <span className={styles.changeValue}>
                {typeof changes[key] === 'object'
                  ? JSON.stringify(changes[key])
                  : String(changes[key])}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return String(changes);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Audit Log</h1>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Entity Type</label>
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className={styles.select}
          >
            <option value="">All Types</option>
            <option value="organization">Organization</option>
            <option value="user">User</option>
            <option value="entitlement">Entitlement</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className={styles.select}
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="login">Login</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Performed By</label>
          <input
            type="text"
            value={filters.performedBy}
            onChange={(e) => setFilters({ ...filters, performedBy: e.target.value })}
            placeholder="Email address"
            className={styles.input}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Date From</label>
          <input
            type="datetime-local"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Date To</label>
          <input
            type="datetime-local"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className={styles.input}
          />
        </div>

        <button
          onClick={() => {
            setFilters({
              entityType: '',
              action: '',
              performedBy: '',
              dateFrom: '',
              dateTo: '',
            });
            setPage(0);
          }}
          className={styles.clearButton}
        >
          Clear Filters
        </button>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Changes</th>
                  <th>Performed By</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.dateCell}>{formatDate(log.performedAt)}</td>
                    <td>
                      <div className={styles.entityInfo}>
                        <span className={styles.entityType}>
                          {getEntityTypeLabel(log.entityType)}
                        </span>
                        <span className={styles.entityId}>{log.entityId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.action} ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{renderChanges(log.changes)}</td>
                    <td>{log.performedBy}</td>
                    <td className={styles.ipCell}>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className={styles.emptyState}>No audit logs found matching your filters.</div>
            )}

            <div className={styles.pagination}>
              <div className={styles.pageInfo}>
                Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
              </div>
              <div className={styles.pageButtons}>
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className={styles.pageButton}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= total}
                  className={styles.pageButton}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
