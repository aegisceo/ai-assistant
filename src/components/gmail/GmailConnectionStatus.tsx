/**
 * Gmail Connection Status Component
 * Displays Gmail connection status and provides connect/disconnect functionality
 */

'use client';

import React from 'react';
import { useApi, useAsyncOperation } from '@/lib/hooks';
import { useApiClient } from '@/lib/useApiClient';

export interface GmailConnectionStatusProps {
  readonly onConnectionChange?: (connected: boolean) => void;
}

export function GmailConnectionStatus({ 
  onConnectionChange 
}: GmailConnectionStatusProps): React.ReactElement {
  const apiClient = useApiClient();

  // Fetch current Gmail status
  const { 
    data: status, 
    loading: statusLoading, 
    error: statusError, 
    refetch: refetchStatus 
  } = useApi(
    () => apiClient.getGmailStatus(),
    [apiClient]
  );

  // Handle connecting Gmail
  const { 
    loading: connectLoading, 
    error: connectError, 
    execute: handleConnect 
  } = useAsyncOperation(
    () => apiClient.initiateGmailAuth()
  );

  // Handle disconnecting Gmail
  const { 
    loading: disconnectLoading, 
    error: disconnectError, 
    execute: handleDisconnect 
  } = useAsyncOperation(
    () => apiClient.disconnectGmail()
  );

  const onConnectClick = async (): Promise<void> => {
    const result = await handleConnect();
    if (result?.authUrl) {
      window.location.href = result.authUrl;
    }
  };

  const onDisconnectClick = async (): Promise<void> => {
    const result = await handleDisconnect();
    if (result) {
      await refetchStatus();
      onConnectionChange?.(false);
    }
  };

  // Loading state
  if (statusLoading) {
    return (
      <div className="gmail-status loading">
        <div className="status-indicator">
          <div className="loading-spinner" />
        </div>
        <div className="status-text">
          <p>Checking Gmail connection...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (statusError) {
    return (
      <div className="gmail-status error">
        <div className="status-indicator error">
          <span className="error-icon">⚠️</span>
        </div>
        <div className="status-text">
          <h3>Connection Error</h3>
          <p className="error-message">{statusError.message}</p>
          <button 
            onClick={() => void refetchStatus()}
            className="retry-button"
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Connected state
  if (status?.isConnected) {
    return (
      <div className="gmail-status connected">
        <div className="status-indicator connected">
          <span className="success-icon">✅</span>
        </div>
        <div className="status-text">
          <h3>Gmail Connected</h3>
          <div className="connection-details">
            {status.isExpired && (
              <p className="warning">⚠️ Token expired - please reconnect</p>
            )}
            <div className="scopes">
              <p className="font-medium">Current Permissions:</p>
              <ul className="text-sm text-gray-600 ml-2">
                {status.scopes.map((scope: string) => (
                  <li key={scope}>
                    • {scope.replace('https://www.googleapis.com/auth/', '').replace('.readonly', ' (read only)').replace('.modify', ' (read/write)')}
                  </li>
                ))}
              </ul>
              {!status.scopes.some((scope: string) => scope.includes('calendar')) && (
                <p className="text-amber-600 text-sm mt-2 flex items-center">
                  <span className="mr-2">📅</span>
                  Calendar access not granted - reconnect to enable calendar features
                </p>
              )}
            </div>
            {status.connectedAt && (
              <p className="connected-date text-sm text-gray-600 mt-2">
                Connected: {new Date(status.connectedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="actions">
            <button
              onClick={() => void onDisconnectClick()}
              disabled={disconnectLoading}
              className="disconnect-button"
              type="button"
            >
              {disconnectLoading ? 'Disconnecting...' : 'Disconnect Gmail'}
            </button>
            {status.isExpired && (
              <button
                onClick={() => void onConnectClick()}
                disabled={connectLoading}
                className="reconnect-button"
                type="button"
              >
                {connectLoading ? 'Connecting...' : 'Reconnect'}
              </button>
            )}
          </div>
          {disconnectError && (
            <p className="error-message">{disconnectError.message}</p>
          )}
        </div>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="gmail-status not-connected">
      <div className="status-indicator not-connected">
        <span className="warning-icon">📧</span>
      </div>
      <div className="status-text">
        <h3>Gmail Not Connected</h3>
        <p>Connect your Gmail account to start managing your emails with AI assistance.</p>
        <div className="permissions-info">
          <h4>This will allow the app to:</h4>
          <ul>
            <li>📧 Read your email messages</li>
            <li>🏷️ Manage email labels and organization</li>
            <li>📅 View and create calendar events</li>
            <li>🤖 Detect meeting requests and suggest scheduling</li>
            <li>✉️ Send emails on your behalf (future feature)</li>
          </ul>
        </div>
        <div className="actions">
          <button
            onClick={() => void onConnectClick()}
            disabled={connectLoading}
            className="connect-button"
            type="button"
          >
            {connectLoading ? 'Connecting...' : 'Connect Gmail'}
          </button>
        </div>
        {connectError && (
          <p className="error-message">{connectError.message}</p>
        )}
      </div>
    </div>
  );
}