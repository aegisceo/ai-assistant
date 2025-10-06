/**
 * Email List Component
 * Displays a list of Gmail emails with filtering and pagination
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useApi, useAsyncOperation } from '@/lib/hooks';
import { useApiClient } from '@/lib/useApiClient';
import { type FetchEmailsParams } from '@/lib/api-client';
import { Email, EmailAddress, EmailClassification } from '@/types';
import { ClassificationButton, EmailClassificationDisplay } from './EmailClassification';

export interface EmailListProps {
  readonly maxResults?: number;
}

interface EmailFilters {
  readonly query: string;
  readonly labelIds: string;
  readonly includeSpamTrash: boolean;
}

export function EmailList({ 
  maxResults = 50
}: EmailListProps): React.ReactElement {
  const apiClient = useApiClient();
  const [filters, setFilters] = useState<EmailFilters>({
    query: '',
    labelIds: 'INBOX',
    includeSpamTrash: false,
  });

  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [classifications, setClassifications] = useState<Map<string, EmailClassification>>(new Map());

  // Fetch emails with current filters
  const fetchParams = useMemo((): FetchEmailsParams => ({
    maxResults,
    includeSpamTrash: filters.includeSpamTrash,
    ...(filters.query.length > 0 && { query: filters.query }),
    ...(filters.labelIds.length > 0 && { labelIds: filters.labelIds }),
    ...(pageToken && { pageToken }),
  }), [maxResults, filters, pageToken]);

  const { 
    data: emailsResponse, 
    loading, 
    error, 
    refetch 
  } = useApi(
    () => apiClient.fetchGmailEmails(fetchParams),
    [apiClient, fetchParams]
  );

  const handleFilterChange = (newFilters: Partial<EmailFilters>): void => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPageToken(undefined); // Reset pagination when filters change
  };

  const handleNextPage = (): void => {
    if (emailsResponse?.nextPageToken) {
      setPageToken(emailsResponse.nextPageToken);
    }
  };

  const handlePrevPage = (): void => {
    setPageToken(undefined); // For simplicity, go back to first page
  };

  // Email classification functionality
  const { 
    loading: classifyLoading, 
    execute: handleClassifyEmail 
  } = useAsyncOperation(
    (email: Email) => apiClient.classifyEmail({ email })
  );

  const onClassifyEmail = async (email: Email): Promise<void> => {
    const result = await handleClassifyEmail(email);
    if (result && result.classification) {
      setClassifications(prev => new Map(prev.set(email.id, result.classification as EmailClassification)));
    }
  };


  return (
    <div className="email-list">
      {/* Filters */}
      <div className="email-filters">
        <div className="filter-row">
          <input
            type="text"
            placeholder="Search emails..."
            value={filters.query}
            onChange={(e) => handleFilterChange({ query: e.target.value })}
            className="search-input"
          />
          <select
            value={filters.labelIds}
            onChange={(e) => handleFilterChange({ labelIds: e.target.value })}
            className="label-select"
          >
            <option value="INBOX">Inbox</option>
            <option value="SENT">Sent</option>
            <option value="DRAFT">Drafts</option>
            <option value="IMPORTANT">Important</option>
            <option value="STARRED">Starred</option>
            <option value="">All Mail</option>
          </select>
          <button
            onClick={() => void refetch()}
            disabled={loading}
            className="refresh-button"
            type="button"
          >
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
        
        <div className="filter-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.includeSpamTrash}
              onChange={(e) => handleFilterChange({ includeSpamTrash: e.target.checked })}
            />
            Include spam and trash
          </label>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading emails...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="error-state">
          <p className="error-message">Error loading emails: {error.message}</p>
          <button onClick={() => void refetch()} className="retry-button" type="button">
            Try Again
          </button>
        </div>
      )}

      {/* Email list */}
      {emailsResponse && (
        <>
          <div className="email-list-header">
            <p className="email-count">
              {emailsResponse.emails.length} of ~{emailsResponse.totalEstimate} emails
            </p>
          </div>

          <div className="emails">
            {emailsResponse.emails.length === 0 ? (
              <div className="empty-state">
                <p>No emails found matching your criteria.</p>
              </div>
            ) : (
              emailsResponse.emails.map((email) => (
                <EmailItem 
                  key={email.id} 
                  email={email}
                  classification={classifications.get(email.id)}
                  onClassify={onClassifyEmail}
                  classifyLoading={classifyLoading}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={handlePrevPage}
              disabled={!pageToken}
              className="pagination-button"
              type="button"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!emailsResponse.nextPageToken}
              className="pagination-button"
              type="button"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Individual email item component
 */
interface EmailItemProps {
  readonly email: Email;
  readonly classification?: EmailClassification | undefined;
  readonly onClassify: (email: Email) => Promise<void>;
  readonly classifyLoading: boolean;
}

function EmailItem({ 
  email, 
  classification,
  onClassify,
  classifyLoading 
}: EmailItemProps): React.ReactElement {
  const formatEmailAddress = (address: EmailAddress): string => {
    return address.name ? `${address.name} <${address.email}>` : address.email;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  return (
    <div className={`email-item ${email.isRead ? 'read' : 'unread'} ${email.isImportant ? 'important' : ''}`}>
      <div className="email-sender">
        <span className="sender-name">
          {truncateText(formatEmailAddress(email.sender), 30)}
        </span>
        {email.isImportant && <span className="important-indicator">★</span>}
      </div>
      
      <div className="email-content">
        <div className="email-subject">
          {email.subject ?? '(no subject)'}
        </div>
        <div className="email-snippet">
          {truncateText(email.snippet, 100)}
        </div>
        
        {/* AI Classification Display */}
        {classification && (
          <div className="email-classification">
            <EmailClassificationDisplay 
              classification={classification} 
              compact={true}
            />
          </div>
        )}
      </div>
      
      <div className="email-meta">
        <div className="email-date">
          {formatDate(email.date)}
        </div>
        <div className="email-labels">
          {email.labels.filter(label => !label.startsWith('Label_')).slice(0, 2).map(label => (
            <span key={label} className="label-tag">
              {label.replace('CATEGORY_', '').toLowerCase()}
            </span>
          ))}
        </div>
        
        {/* Classification Button */}
        <div className="email-actions">
          <ClassificationButton
            email={email}
            classification={classification}
            onClassify={onClassify}
            loading={classifyLoading}
          />
        </div>
      </div>
    </div>
  );
}