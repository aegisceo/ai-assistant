/**
 * Focused Dashboard Component
 * Neurodivergent-friendly dashboard with cognitive load reduction and progressive disclosure
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { GmailConnectionStatus } from '@/components/gmail/GmailConnectionStatus';
import { SmartEmailList } from '@/components/gmail/SmartEmailList';
import { UrgentEmailNotifications } from '@/components/notifications/UrgentEmailNotifications';
import { CalendarIntegration } from '@/components/calendar/CalendarIntegration';

interface DashboardSection {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly priority: number;
  readonly isExpanded?: boolean;
  readonly isEnabled: boolean;
  readonly cognitiveLoad: 'low' | 'medium' | 'high';
}

interface FocusSettings {
  readonly maxVisibleSections: number;
  readonly autoCollapseAfterMinutes: number;
  readonly enableProgressiveDisclosure: boolean;
  readonly prioritizeUrgent: boolean;
  readonly showCognitiveLoadIndicators: boolean;
  readonly reduceAnimations: boolean;
}

export function FocusedDashboard(): React.ReactElement {
  const [focusSettings, setFocusSettings] = useState<FocusSettings>({
    maxVisibleSections: 3,
    autoCollapseAfterMinutes: 10,
    enableProgressiveDisclosure: true,
    prioritizeUrgent: true,
    showCognitiveLoadIndicators: true,
    reduceAnimations: false,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['connection']));
  const [lastInteraction, setLastInteraction] = useState<Date>(new Date());
  const [isGmailConnected, setIsGmailConnected] = useState<boolean>(false);

  // Define dashboard sections with cognitive load indicators
  const sections: readonly DashboardSection[] = useMemo(() => [
    {
      id: 'connection',
      title: 'Email Connection',
      description: 'Connect and manage your email accounts',
      icon: '📧',
      priority: 1,
      isEnabled: true,
      cognitiveLoad: 'low',
    },
    {
      id: 'urgent',
      title: 'Urgent Items',
      description: 'High-priority emails requiring immediate attention',
      icon: '🚨',
      priority: 2,
      isEnabled: isGmailConnected,
      cognitiveLoad: 'high',
    },
    {
      id: 'emails',
      title: 'Smart Email List',
      description: 'AI-organized emails with filtering and prioritization',
      icon: '📬',
      priority: 3,
      isEnabled: isGmailConnected,
      cognitiveLoad: 'high',
    },
    {
      id: 'calendar',
      title: 'Calendar Integration',
      description: 'View and manage your calendar events',
      icon: '📅',
      priority: 4,
      isEnabled: isGmailConnected,
      cognitiveLoad: 'medium',
    },
  ], [isGmailConnected]);

  // Auto-collapse sections after inactivity
  React.useEffect(() => {
    if (!focusSettings.enableProgressiveDisclosure) return;

    const timeout = setTimeout(() => {
      if (expandedSections.size > focusSettings.maxVisibleSections) {
        const sortedSections = sections
          .filter(s => s.isEnabled)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, focusSettings.maxVisibleSections);
        
        setExpandedSections(new Set(sortedSections.map(s => s.id)));
      }
    }, focusSettings.autoCollapseAfterMinutes * 60 * 1000);

    return () => clearTimeout(timeout);
  }, [lastInteraction, sections, focusSettings, expandedSections]);

  const handleSectionToggle = useCallback((sectionId: string): void => {
    setLastInteraction(new Date());
    setExpandedSections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        // Progressive disclosure: collapse others if max reached
        if (focusSettings.enableProgressiveDisclosure && newExpanded.size >= focusSettings.maxVisibleSections) {
          const sectionsToKeep = sections
            .filter(s => s.priority <= sections.find(sec => sec.id === sectionId)?.priority! || s.id === sectionId)
            .sort((a, b) => a.priority - b.priority)
            .slice(0, focusSettings.maxVisibleSections - 1)
            .map(s => s.id);
          
          newExpanded.clear();
          sectionsToKeep.forEach(id => newExpanded.add(id));
        }
        newExpanded.add(sectionId);
      }
      return newExpanded;
    });
  }, [sections, focusSettings]);

  const handleConnectionChange = useCallback((connected: boolean): void => {
    setIsGmailConnected(connected);
    setLastInteraction(new Date());
    
    // Auto-expand next priority section when connection changes
    if (connected && focusSettings.prioritizeUrgent) {
      setExpandedSections(prev => new Set([...prev, 'urgent']));
    }
  }, [focusSettings.prioritizeUrgent]);

  const updateFocusSettings = useCallback((newSettings: Partial<FocusSettings>): void => {
    setFocusSettings(prev => ({ ...prev, ...newSettings }));
    setLastInteraction(new Date());
  }, []);

  const getCognitiveLoadColor = (load: DashboardSection['cognitiveLoad']): string => {
    switch (load) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderSection = (section: DashboardSection): React.ReactElement => {
    const isExpanded = expandedSections.has(section.id);
    const isDisabled = !section.isEnabled;
    
    return (
      <div 
        key={section.id}
        className={`dashboard-section ${isExpanded ? 'expanded' : 'collapsed'} ${isDisabled ? 'disabled' : ''}`}
      >
        <button
          onClick={() => section.isEnabled && handleSectionToggle(section.id)}
          className={`section-header ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}
          type="button"
          disabled={isDisabled}
        >
          <div className="section-info">
            <div className="section-title-row">
              <span className="section-icon">{section.icon}</span>
              <h2 className="section-title">{section.title}</h2>
              {focusSettings.showCognitiveLoadIndicators && (
                <span className={`cognitive-load-indicator ${getCognitiveLoadColor(section.cognitiveLoad)}`}>
                  {section.cognitiveLoad}
                </span>
              )}
            </div>
            <p className="section-description">{section.description}</p>
          </div>
          <div className="section-controls">
            {!isDisabled && (
              <span className={`expand-indicator ${isExpanded ? 'expanded' : ''}`}>
                {isExpanded ? '−' : '+'}
              </span>
            )}
          </div>
        </button>

        {isExpanded && section.isEnabled && (
          <div className={`section-content ${focusSettings.reduceAnimations ? 'no-animation' : 'animated'}`}>
            {section.id === 'connection' && (
              <GmailConnectionStatus onConnectionChange={handleConnectionChange} />
            )}
            {section.id === 'urgent' && (
              <UrgentEmailNotifications />
            )}
            {section.id === 'emails' && (
              <SmartEmailList 
                maxResults={25} 
                autoRefreshInterval={5 * 60 * 1000} // 5 minutes
              />
            )}
            {section.id === 'calendar' && (
              <CalendarIntegration />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="focused-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">
            <span className="title-icon">🧠</span>
            AI Assistant Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Designed for focus, reduced cognitive load, and executive function support
          </p>
        </div>
        
        {/* Focus Settings Toggle */}
        <div className="header-controls">
          <button
            onClick={() => handleSectionToggle('settings')}
            className="settings-toggle"
            type="button"
            title="Focus Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Focus Settings Panel */}
      {expandedSections.has('settings') && (
        <div className="focus-settings-panel">
          <div className="settings-header">
            <h3>Focus & Accessibility Settings</h3>
            <button
              onClick={() => handleSectionToggle('settings')}
              className="close-button"
              type="button"
            >
              ×
            </button>
          </div>
          
          <div className="settings-content">
            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={focusSettings.enableProgressiveDisclosure}
                  onChange={(e) => updateFocusSettings({ enableProgressiveDisclosure: e.target.checked })}
                />
                Enable Progressive Disclosure
              </label>
              <p className="setting-description">
                Automatically limit visible sections to reduce cognitive load
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                Max Visible Sections: {focusSettings.maxVisibleSections}
              </label>
              <input
                type="range"
                min="1"
                max="6"
                value={focusSettings.maxVisibleSections}
                onChange={(e) => updateFocusSettings({ maxVisibleSections: parseInt(e.target.value) })}
                className="setting-slider"
              />
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={focusSettings.showCognitiveLoadIndicators}
                  onChange={(e) => updateFocusSettings({ showCognitiveLoadIndicators: e.target.checked })}
                />
                Show Cognitive Load Indicators
              </label>
              <p className="setting-description">
                Visual indicators to help manage mental effort
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={focusSettings.reduceAnimations}
                  onChange={(e) => updateFocusSettings({ reduceAnimations: e.target.checked })}
                />
                Reduce Animations
              </label>
              <p className="setting-description">
                Minimize visual motion for better focus
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={focusSettings.prioritizeUrgent}
                  onChange={(e) => updateFocusSettings({ prioritizeUrgent: e.target.checked })}
                />
                Auto-prioritize Urgent Items
              </label>
              <p className="setting-description">
                Automatically expand urgent notifications
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Sections */}
      <div className="dashboard-sections">
        {sections
          .filter(section => section.isEnabled || section.id === 'connection')
          .map(renderSection)}
      </div>

      {/* Quick Stats */}
      <div className="dashboard-footer">
        <div className="quick-stats">
          <div className="stat-item">
            <span className="stat-label">Active Sections:</span>
            <span className="stat-value">{expandedSections.size}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Connection:</span>
            <span className={`stat-value ${isGmailConnected ? 'connected' : 'disconnected'}`}>
              {isGmailConnected ? '✅ Connected' : '⚠️ Not Connected'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Focus Mode:</span>
            <span className="stat-value">
              {focusSettings.enableProgressiveDisclosure ? '🎯 Focused' : '📋 Full View'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}