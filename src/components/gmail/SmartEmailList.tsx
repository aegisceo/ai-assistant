/**
 * Smart Email List Component
 * Enhanced email list with AI-powered filtering and auto-prioritization
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useApi, useAsyncOperation } from '@/lib/hooks';
import { useApiClient } from '@/lib/useApiClient';
import { Email, EmailAddress, EmailClassification } from '@/types';
import { ClassificationButton, EmailClassificationDisplay } from './EmailClassification';

export interface SmartEmailListProps {
  readonly maxResults?: number;
  readonly autoRefreshInterval?: number; // Auto-refresh interval in milliseconds
}

interface SmartFilters {
  readonly urgencyFilter?: number | undefined;
  readonly importanceFilter?: number | undefined;
  readonly categoryFilter?: 'work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other' | undefined;
  readonly actionRequired?: boolean | undefined;
  readonly priorityMode: 'all' | 'high_priority' | 'urgent_only' | 'work_hours';
  readonly sortBy: 'date' | 'urgency' | 'importance' | 'priority_score';
  readonly sortOrder: 'asc' | 'desc';
  readonly includeUnclassified: boolean;
}

type EnhancedEmail = Email & {
  readonly classification?: EmailClassification;
  readonly priorityScore: number;
  readonly isHighPriority: boolean;
  readonly needsClassification: boolean;
};

export function SmartEmailList({ 
  maxResults = 50,
  autoRefreshInterval 
}: SmartEmailListProps): React.ReactElement {
  const apiClient = useApiClient();
  const [filters, setFilters] = useState<SmartFilters>({
    priorityMode: 'high_priority',
    sortBy: 'priority_score',
    sortOrder: 'desc',
    includeUnclassified: true,
  });

  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Build API parameters (commented out as not currently used)
  // const apiParams = useMemo(() => ({
  //   maxResults,
  //   ...filters,
  //   pageToken,
  //   _refresh: refreshTrigger, // Force refetch when triggered
  // }), [maxResults, filters, pageToken, refreshTrigger]);

  // Fetch emails using basic Gmail API (temporarily simplified)
  const { 
    data: emailsResponse, 
    loading, 
    error, 
    refetch: _refetch 
  } = useApi(
    async () => {
      console.log('Fetching emails...');
      const response = await fetch(`/api/gmail/emails?maxResults=${maxResults}&labelIds=INBOX`, {
        credentials: 'include', // Include cookies for authentication
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Fetch error:', errorText);
        return { success: false, error: new Error(`HTTP ${response.status}: ${response.statusText}`) };
      }
      
      const result = await response.json() as { success: boolean; data?: { emails: Email[]; nextPageToken?: string; totalEstimate: number }; error?: string };
      console.log('API result:', result);
      
      if (!result.success) {
        return { success: false, error: new Error(result.error || 'Failed to fetch emails') };
      }

      // Convert to expected format with mock smart insights
      const convertedData = {
        emails: result.data?.emails.map((email): EnhancedEmail => ({
          ...email,
          date: typeof email.date === 'string' ? new Date(email.date) : email.date,
          priorityScore: Math.random() * 10, // Mock priority score
          isHighPriority: Math.random() > 0.7,
          needsClassification: Math.random() > 0.5,
        })) || [],
        insights: {
          summary: `Found ${result.data?.emails.length || 0} emails in your inbox`,
          recommendations: ['Check high priority emails first', 'Review unread messages'],
          urgentCount: Math.floor((result.data?.emails.length || 0) * 0.1),
          overdueActionItems: Math.floor((result.data?.emails.length || 0) * 0.05),
          categoryBreakdown: { work: 5, personal: 3, other: 2 },
        },
        totalEmails: result.data?.totalEstimate || 0,
        unclassifiedCount: Math.floor((result.data?.emails.length || 0) * 0.3),
        highPriorityCount: Math.floor((result.data?.emails.length || 0) * 0.2),
        actionRequiredCount: Math.floor((result.data?.emails.length || 0) * 0.15),
        nextPageToken: result.data?.nextPageToken,
      };
      
      console.log('Converted data:', convertedData);
      return { success: true, data: convertedData };
    },
    [maxResults, refreshTrigger]
  );

  // Auto-refresh functionality
  React.useEffect(() => {
    if (!autoRefreshInterval) return;

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  const handleFilterChange = useCallback((newFilters: Partial<SmartFilters>): void => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPageToken(undefined);
  }, []);

  const handleRefresh = useCallback((): void => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleNextPage = useCallback((): void => {
    if (emailsResponse?.nextPageToken) {
      setPageToken(emailsResponse.nextPageToken);
    }
  }, [emailsResponse]);

  const handlePrevPage = useCallback((): void => {
    setPageToken(undefined);
  }, []);

  // Email classification functionality
  const { 
    loading: classifyLoading, 
    execute: handleClassifyEmail 
  } = useAsyncOperation(
    (email: Email) => apiClient.classifyEmail({ email })
  );

  const onClassifyEmail = useCallback(async (email: Email): Promise<void> => {
    await handleClassifyEmail(email);
    // Refresh the list to show updated classification
    setRefreshTrigger(prev => prev + 1);
  }, [handleClassifyEmail]);

  const getFilterPresets = (): Array<{
    name: string;
    filters: Partial<SmartFilters>;
    description: string;
  }> => [
    {
      name: 'High Priority',
      filters: { priorityMode: 'high_priority', sortBy: 'priority_score' },
      description: 'Important and urgent emails requiring attention',
    },
    {
      name: 'Urgent Only',
      filters: { priorityMode: 'urgent_only', urgencyFilter: 4 },
      description: 'Critical emails needing immediate response',
    },
    {
      name: 'Action Required',
      filters: { actionRequired: true, sortBy: 'priority_score' },
      description: 'Emails requiring specific actions',
    },
    {
      name: 'Work Hours',
      filters: { priorityMode: 'work_hours', categoryFilter: 'work' },
      description: 'Work-related emails during business hours',
    },
    {
      name: 'Opportunities',
      filters: { categoryFilter: 'opportunity', sortBy: 'importance' },
      description: 'Career and business opportunities',
    },
  ];

  return (
    <div className="smart-email-list">
      {/* Smart Filter Controls */}
      <div className="smart-filters mb-6">
        <div className="filter-presets mb-4">
          <div className="flex flex-wrap gap-2">
            {getFilterPresets().map(preset => (
              <button
                key={preset.name}
                onClick={() => handleFilterChange(preset.filters)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                type="button"
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="advanced-filters grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="filter-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority Mode
            </label>
            <select
              value={filters.priorityMode}
              onChange={(e) => handleFilterChange({ 
                priorityMode: e.target.value as SmartFilters['priorityMode'] 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Emails</option>
              <option value="high_priority">High Priority</option>
              <option value="urgent_only">Urgent Only</option>
              <option value="work_hours">Work Hours</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Urgency
            </label>
            <select
              value={filters.urgencyFilter?.toString() || ''}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({ 
                  urgencyFilter: value ? Number(value) : undefined 
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any</option>
              <option value="2">Low+</option>
              <option value="3">Medium+</option>
              <option value="4">High+</option>
              <option value="5">Critical</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filters.categoryFilter || ''}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({ 
                  categoryFilter: value ? value as SmartFilters['categoryFilter'] : undefined 
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="financial">Financial</option>
              <option value="opportunity">Opportunity</option>
              <option value="newsletter">Newsletter</option>
              <option value="spam">Spam</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange({ 
                sortBy: e.target.value as SmartFilters['sortBy'] 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="priority_score">Priority Score</option>
              <option value="urgency">Urgency</option>
              <option value="importance">Importance</option>
              <option value="date">Date</option>
            </select>
          </div>
        </div>

        <div className="filter-toggles mt-4 flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.actionRequired === true}
              onChange={(e) => handleFilterChange({ 
                actionRequired: e.target.checked || undefined 
              })}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Action Required Only</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.includeUnclassified}
              onChange={(e) => handleFilterChange({ 
                includeUnclassified: e.target.checked 
              })}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include Unclassified</span>
          </label>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            type="button"
          >
            {loading ? '⟳ Loading...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Smart Insights Panel */}
      {emailsResponse?.insights && (
        <div className="insights-panel mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="insights-header mb-3">
            <h3 className="text-lg font-semibold text-gray-900">📊 Smart Insights</h3>
            <p className="text-sm text-gray-700">{emailsResponse.insights.summary}</p>
          </div>

          <div className="insights-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="stat-item text-center">
              <div className="text-2xl font-bold text-red-600">
                {emailsResponse.insights.urgentCount}
              </div>
              <div className="text-xs text-gray-600">Urgent</div>
            </div>
            <div className="stat-item text-center">
              <div className="text-2xl font-bold text-orange-600">
                {emailsResponse.insights.overdueActionItems}
              </div>
              <div className="text-xs text-gray-600">Overdue</div>
            </div>
            <div className="stat-item text-center">
              <div className="text-2xl font-bold text-blue-600">
                {emailsResponse.highPriorityCount}
              </div>
              <div className="text-xs text-gray-600">High Priority</div>
            </div>
            <div className="stat-item text-center">
              <div className="text-2xl font-bold text-green-600">
                {emailsResponse.unclassifiedCount}
              </div>
              <div className="text-xs text-gray-600">Unclassified</div>
            </div>
          </div>

          {emailsResponse.insights.recommendations.length > 0 && (
            <div className="recommendations">
              <h4 className="text-sm font-medium text-gray-900 mb-2">🎯 Recommendations:</h4>
              <ul className="space-y-1">
                {emailsResponse.insights.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Analyzing emails with AI...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">Error loading emails</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
          <button 
            onClick={handleRefresh} 
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            type="button"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Email List */}
      {emailsResponse && (
        <>
          <div className="email-list-header mb-4">
            <p className="text-sm text-gray-600">
              Showing {emailsResponse.emails.length} of {emailsResponse.totalEmails} emails
              {filters.priorityMode !== 'all' && ` (${filters.priorityMode.replace('_', ' ')} mode)`}
            </p>
          </div>

          <div className="emails space-y-3">
            {emailsResponse.emails.length === 0 ? (
              <div className="empty-state text-center py-8">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-600">No emails match your current filters.</p>
                <button
                  onClick={() => handleFilterChange({ priorityMode: 'all' })}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline"
                  type="button"
                >
                  Show all emails
                </button>
              </div>
            ) : (
              emailsResponse.emails.map((email) => (
                <SmartEmailItem 
                  key={email.id} 
                  email={email}
                  onClassify={onClassifyEmail}
                  classifyLoading={classifyLoading}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="pagination mt-6 flex justify-center space-x-4">
            <button
              onClick={handlePrevPage}
              disabled={!pageToken}
              className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
              type="button"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!emailsResponse.nextPageToken}
              className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
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
 * Enhanced email item with priority indicators and smart classification
 */
interface SmartEmailItemProps {
  readonly email: EnhancedEmail;
  readonly onClassify: (email: Email) => Promise<void>;
  readonly classifyLoading: boolean;
}

function SmartEmailItem({ 
  email, 
  onClassify,
  classifyLoading 
}: SmartEmailItemProps): React.ReactElement {
  const formatEmailAddress = (address: EmailAddress): string => {
    return address.name ? `${address.name} <${address.email}>` : address.email;
  };

  const formatDate = (date: Date | string): string => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if dateObj is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return dateObj.toLocaleDateString([], { weekday: 'short' });
    } else {
      return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  const getPriorityIndicator = (): React.ReactElement => {
    const score = email.priorityScore;
    if (score >= 8) {
      return <span className="priority-indicator critical" title={`Priority Score: ${score.toFixed(1)}`}>🔴</span>;
    } else if (score >= 6) {
      return <span className="priority-indicator high" title={`Priority Score: ${score.toFixed(1)}`}>🟡</span>;
    } else if (score >= 4) {
      return <span className="priority-indicator medium" title={`Priority Score: ${score.toFixed(1)}`}>🟢</span>;
    }
    return <span className="priority-indicator low" title={`Priority Score: ${score.toFixed(1)}`}>⚪</span>;
  };

  const itemClasses = [
    'smart-email-item',
    'p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow',
    email.isRead ? 'read bg-gray-50' : 'unread bg-white',
    email.isHighPriority ? 'high-priority border-l-4 border-l-orange-500' : '',
    email.classification?.actionRequired ? 'action-required border-r-4 border-r-red-500' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClasses}>
      <div className="email-header flex items-start justify-between mb-2">
        <div className="sender-info flex items-center space-x-2">
          {getPriorityIndicator()}
          <span className="sender-name font-medium text-gray-900">
            {truncateText(formatEmailAddress(email.sender), 30)}
          </span>
          {email.isImportant && <span className="important-indicator text-yellow-500">★</span>}
          {email.needsClassification && (
            <span className="unclassified-indicator px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
              Needs Classification
            </span>
          )}
        </div>
        
        <div className="email-date text-sm text-gray-500">
          {formatDate(email.date)}
        </div>
      </div>
      
      <div className="email-content">
        <div className="email-subject font-medium text-gray-900 mb-1">
          {email.subject ?? '(no subject)'}
        </div>
        <div className="email-snippet text-gray-600 text-sm mb-3">
          {truncateText(email.snippet, 120)}
        </div>
        
        <div className="email-footer flex items-center justify-between">
          <div className="classification-display">
            {email.classification ? (
              <EmailClassificationDisplay 
                classification={email.classification} 
                compact={true}
                email={email}
                showFeedback={true}
              />
            ) : (
              <ClassificationButton
                email={email}
                classification={email.classification}
                onClassify={onClassify}
                loading={classifyLoading}
              />
            )}
          </div>
          
          <div className="priority-score text-xs text-gray-500">
            Priority: {email.priorityScore.toFixed(1)}/10
          </div>
        </div>
      </div>
    </div>
  );
}