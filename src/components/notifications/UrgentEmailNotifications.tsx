/**
 * Urgent Email Notifications Component
 * Displays intelligent notifications for urgent emails only
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/hooks';
import { EmailClassification } from '@/types';


export interface UrgentEmailNotificationsProps {
  readonly autoRefreshInterval?: number; // Auto-refresh interval in milliseconds
  readonly onNotificationClick?: (emailId: string) => void;
  readonly respectWorkingHours?: boolean;
  readonly minUrgency?: 1 | 2 | 3 | 4 | 5;
}

interface NotificationItem {
  readonly id: string;
  readonly subject: string | null;
  readonly sender: { readonly email: string; readonly name?: string };
  readonly date: Date;
  readonly snippet: string;
  readonly urgencyReason: string;
  readonly priority: 'critical' | 'high' | 'medium';
  readonly suggestedAction?: string;
  readonly classification?: EmailClassification;
  readonly isUnread: boolean;
  readonly hasAttachment: boolean;
}

export function UrgentEmailNotifications({
  autoRefreshInterval = 300000, // 5 minutes default
  onNotificationClick,
  respectWorkingHours = true,
  minUrgency = 4
}: UrgentEmailNotificationsProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(new Set<string>());
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  // Build API parameters
  const apiParams = React.useMemo(() => {
    const params = new URLSearchParams({
      respectWorkingHours: respectWorkingHours.toString(),
      minUrgency: minUrgency.toString(),
      includeActionRequired: 'true',
      checkSince: lastCheck.toISOString(),
    });
    return params.toString();
  }, [respectWorkingHours, minUrgency, lastCheck]);

  // Fetch urgent notifications
  const { 
    data: notificationsResponse, 
    loading, 
    error, 
    refetch: _refetch 
  } = useApi(
    async () => {
      const res = await fetch(`/api/notifications/urgent?${apiParams}`, {
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!res.ok) {
        return {
          success: false,
          error: new Error(`HTTP ${res.status}: ${res.statusText}`),
        } as const;
      }
      
      const jsonResponse = await res.json() as {
        success: boolean;
        data?: {
          notifications: NotificationItem[];
          summary: string;
          totalUrgent: number;
          totalActionRequired: number;
          checkPeriod: {
            since: string;
            totalEmails: number;
          };
          userSettings: {
            notificationsEnabled: boolean;
            workingHours: {
              start: string;
              end: string;
              days: readonly number[];
            };
            respectWorkingHours: boolean;
            currentlyInWorkingHours: boolean;
          };
        };
        error?: string;
      };
      
      if (!jsonResponse.success) {
        return {
          success: false,
          error: new Error(jsonResponse.error || 'Failed to fetch notifications'),
        } as const;
      }
      
      return {
        success: true,
        data: jsonResponse,
      } as const;
    },
    [apiParams]
  );

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshInterval) return;

    const interval = setInterval(() => {
      setLastCheck(new Date());
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  const handleRefresh = useCallback((): void => {
    setLastCheck(new Date());
  }, []);

  const handleDismiss = useCallback((notificationId: string): void => {
    setDismissedIds(prev => new Set(prev.add(notificationId)));
  }, []);

  const handleNotificationClick = useCallback((notification: NotificationItem): void => {
    if (onNotificationClick) {
      onNotificationClick(notification.id);
    }
    // Auto-dismiss when clicked
    handleDismiss(notification.id);
  }, [onNotificationClick, handleDismiss]);

  // Filter out dismissed notifications
  const activeNotifications = (notificationsResponse?.data?.notifications || [])
    .filter(notification => !dismissedIds.has(notification.id));

  const criticalNotifications = activeNotifications.filter(n => n.priority === 'critical');
  const highNotifications = activeNotifications.filter(n => n.priority === 'high');

  // Don't render if no notifications or notifications disabled
  if (loading || error || !notificationsResponse?.data || activeNotifications.length === 0) {
    return (
      <div className="urgent-notifications-empty">
        {loading && (
          <div className="text-xs text-gray-500">Checking for urgent emails...</div>
        )}
        {error && (
          <div className="text-xs text-red-600">Failed to check notifications</div>
        )}
        {notificationsResponse?.data && activeNotifications.length === 0 && (
          <div className="text-xs text-green-600">✅ No urgent emails</div>
        )}
      </div>
    );
  }

  const { data } = notificationsResponse;

  return (
    <div className="urgent-notifications bg-white rounded-lg shadow-md border-l-4 border-l-orange-500">
      {/* Notification Header */}
      <div 
        className="notification-header p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="notification-icon">
              {criticalNotifications.length > 0 ? (
                <span className="text-red-600 text-lg">🚨</span>
              ) : (
                <span className="text-orange-600 text-lg">⚠️</span>
              )}
            </div>
            
            <div className="notification-summary">
              <div className="font-medium text-gray-900">
                {activeNotifications.length} Urgent Email{activeNotifications.length !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-gray-600">
                {data.summary}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Priority indicators */}
            {criticalNotifications.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                {criticalNotifications.length} Critical
              </span>
            )}
            {highNotifications.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                {highNotifications.length} High
              </span>
            )}
            
            {/* Expand/collapse indicator */}
            <span className="text-gray-400 text-sm">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>

        {/* Working hours indicator */}
        {data.userSettings.respectWorkingHours && (
          <div className="mt-2 text-xs text-gray-500">
            {data.userSettings.currentlyInWorkingHours ? (
              <span className="text-green-600">🟢 Within working hours</span>
            ) : (
              <span className="text-yellow-600">🟡 Outside working hours</span>
            )}
          </div>
        )}
      </div>

      {/* Expanded notification list */}
      {isExpanded && (
        <div className="notification-list border-t border-gray-200">
          <div className="max-h-96 overflow-y-auto">
            {activeNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDismiss={() => handleDismiss(notification.id)}
              />
            ))}
          </div>
          
          {/* Notification actions */}
          <div className="notification-actions p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Last checked: {lastCheck.toLocaleTimeString()}
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  className="text-blue-600 hover:text-blue-800 underline"
                  type="button"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setDismissedIds(new Set(activeNotifications.map(n => n.id)))}
                  className="text-gray-600 hover:text-gray-800 underline"
                  type="button"
                >
                  Dismiss All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual notification item component
 */
interface NotificationItemProps {
  readonly notification: NotificationItem;
  readonly onClick: () => void;
  readonly onDismiss: () => void;
}

function NotificationItem({ 
  notification, 
  onClick, 
  onDismiss 
}: NotificationItemProps): React.ReactElement {
  const getPriorityIcon = (): string => {
    switch (notification.priority) {
      case 'critical': return '🔴';
      case 'high': return '🟡';
      case 'medium': return '🟠';
      default: return '⚪';
    }
  };

  const getPriorityColors = (): string => {
    switch (notification.priority) {
      case 'critical': return 'border-l-red-500 bg-red-50 hover:bg-red-100';
      case 'high': return 'border-l-orange-500 bg-orange-50 hover:bg-orange-100';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50 hover:bg-yellow-100';
      default: return 'border-l-gray-500 bg-gray-50 hover:bg-gray-100';
    }
  };

  const formatSender = (): string => {
    return notification.sender.name 
      ? `${notification.sender.name} <${notification.sender.email}>`
      : notification.sender.email;
  };

  const formatTime = (): string => {
    const now = new Date();
    const emailDate = new Date(notification.date);
    const diffMs = now.getTime() - emailDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ago`;
    } else {
      return emailDate.toLocaleDateString();
    }
  };

  return (
    <div 
      className={`notification-item p-4 border-l-4 cursor-pointer transition-colors ${getPriorityColors()}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-1">
            {getPriorityIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="notification-sender text-sm font-medium text-gray-900 truncate">
              {formatSender()}
            </div>
            
            <div className="notification-subject text-sm text-gray-800 font-medium mt-1">
              {notification.subject || '(no subject)'}
            </div>
            
            <div className="notification-snippet text-xs text-gray-600 mt-1 line-clamp-2">
              {notification.snippet}
            </div>
            
            <div className="notification-meta mt-2 flex items-center space-x-4 text-xs text-gray-500">
              <span>{formatTime()}</span>
              {notification.hasAttachment && <span>📎 Attachment</span>}
              {notification.isUnread && <span className="text-blue-600">● Unread</span>}
            </div>
            
            <div className="notification-reason mt-2 text-xs text-gray-700 bg-white bg-opacity-70 px-2 py-1 rounded">
              <span className="font-medium">Reason:</span> {notification.urgencyReason}
            </div>
            
            {notification.suggestedAction && (
              <div className="suggested-action mt-1 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                <span className="font-medium">💡 Suggested:</span> {notification.suggestedAction}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2"
          type="button"
          title="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}