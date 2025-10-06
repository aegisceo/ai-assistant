/**
 * Focused Priority System Component
 * Simplified priority system designed for neurodivergent-friendly UX
 * Reduces cognitive load by focusing on essential information only
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Email, EmailClassification } from '@/types';

export type PriorityLevel = 'urgent' | 'important' | 'normal' | 'low' | 'archive';

export interface SimplifiedPriority {
  readonly level: PriorityLevel;
  readonly score: number; // 1-10 scale
  readonly actionRequired: boolean;
  readonly dueDate?: Date;
  readonly isTimeSensitive: boolean;
  readonly visualIndicator: {
    readonly color: string;
    readonly icon: string;
    readonly label: string;
  };
}

export interface FocusedPriorityProps {
  readonly email: Email;
  readonly classification?: EmailClassification;
  readonly onPriorityChange?: (email: Email, priority: SimplifiedPriority) => void;
  readonly mode: 'view' | 'edit' | 'quick';
  readonly showReasoningToggle?: boolean;
}

export function FocusedPrioritySystem({
  email,
  classification,
  onPriorityChange,
  mode = 'view',
  showReasoningToggle = false,
}: FocusedPriorityProps): React.ReactElement {
  const [showReasoning, setShowReasoning] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  // Convert complex classification to simplified priority
  const simplifiedPriority: SimplifiedPriority = useMemo(() => {
    if (!classification) {
      return {
        level: 'normal',
        score: 5,
        actionRequired: false,
        isTimeSensitive: false,
        visualIndicator: {
          color: 'bg-gray-100 text-gray-600',
          icon: '📋',
          label: 'Unclassified',
        },
      };
    }

    // Simplified logic combining urgency and importance
    const combinedScore = (classification.urgency + classification.importance) / 2;
    const isTimeSensitive = classification.urgency >= 4 || classification.actionRequired;

    let level: PriorityLevel;
    let visualIndicator;

    if (combinedScore >= 4.5 && classification.actionRequired) {
      level = 'urgent';
      visualIndicator = {
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: '🚨',
        label: 'Urgent',
      };
    } else if (combinedScore >= 3.5 || classification.importance >= 4) {
      level = 'important';
      visualIndicator = {
        color: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: '⚡',
        label: 'Important',
      };
    } else if (combinedScore >= 2.5) {
      level = 'normal';
      visualIndicator = {
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: '📬',
        label: 'Normal',
      };
    } else if (combinedScore >= 1.5) {
      level = 'low';
      visualIndicator = {
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: '📝',
        label: 'Low Priority',
      };
    } else {
      level = 'archive';
      visualIndicator = {
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: '📦',
        label: 'Archive',
      };
    }

    return {
      level,
      score: Math.round(combinedScore * 2), // Convert to 1-10 scale
      actionRequired: classification.actionRequired,
      isTimeSensitive,
      visualIndicator,
    };
  }, [classification]);

  const handlePriorityChange = useCallback((newLevel: PriorityLevel): void => {
    const newPriority: SimplifiedPriority = {
      ...simplifiedPriority,
      level: newLevel,
    };
    onPriorityChange?.(email, newPriority);
    setIsEditing(false);
  }, [simplifiedPriority, email, onPriorityChange]);

  const renderQuickView = (): React.ReactElement => (
    <div className="priority-quick-view">
      <div className={`priority-indicator ${simplifiedPriority.visualIndicator.color}`}>
        <span className="priority-icon">{simplifiedPriority.visualIndicator.icon}</span>
        <span className="priority-label">{simplifiedPriority.visualIndicator.label}</span>
        {simplifiedPriority.actionRequired && (
          <span className="action-indicator">⏰</span>
        )}
      </div>
    </div>
  );

  const renderEditMode = (): React.ReactElement => (
    <div className="priority-edit-mode">
      <div className="priority-options">
        {(['urgent', 'important', 'normal', 'low', 'archive'] as const).map(level => {
          const isSelected = simplifiedPriority.level === level;
          const colors = {
            urgent: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
            important: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200',
            normal: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
            low: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200',
            archive: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200',
          };

          const icons = {
            urgent: '🚨',
            important: '⚡',
            normal: '📬',
            low: '📝',
            archive: '📦',
          };

          return (
            <button
              key={level}
              onClick={() => handlePriorityChange(level)}
              className={`priority-option ${colors[level]} ${isSelected ? 'ring-2 ring-current' : ''}`}
              type="button"
            >
              <span className="option-icon">{icons[level]}</span>
              <span className="option-label">{level}</span>
            </button>
          );
        })}
      </div>
      <div className="edit-actions">
        <button
          onClick={() => setIsEditing(false)}
          className="cancel-button"
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const renderViewMode = (): React.ReactElement => (
    <div className="priority-view-mode">
      <div className={`priority-card ${simplifiedPriority.visualIndicator.color}`}>
        <div className="priority-main">
          <div className="priority-header">
            <span className="priority-icon">{simplifiedPriority.visualIndicator.icon}</span>
            <span className="priority-title">{simplifiedPriority.visualIndicator.label}</span>
            <span className="priority-score">({simplifiedPriority.score}/10)</span>
          </div>
          
          {simplifiedPriority.actionRequired && (
            <div className="action-required-badge">
              <span className="action-icon">⏰</span>
              <span className="action-text">Action Required</span>
            </div>
          )}

          {simplifiedPriority.isTimeSensitive && (
            <div className="time-sensitive-badge">
              <span className="time-icon">⏱️</span>
              <span className="time-text">Time Sensitive</span>
            </div>
          )}
        </div>

        <div className="priority-actions">
          {mode !== 'view' && (
            <button
              onClick={() => setIsEditing(true)}
              className="edit-priority-button"
              type="button"
              title="Change Priority"
            >
              ✏️
            </button>
          )}
          
          {showReasoningToggle && classification && (
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="reasoning-toggle"
              type="button"
              title="Show/Hide Reasoning"
            >
              {showReasoning ? '🔼' : '🔽'}
            </button>
          )}
        </div>
      </div>

      {showReasoning && classification && (
        <div className="priority-reasoning">
          <div className="reasoning-header">
            <h4>Why this priority?</h4>
          </div>
          <div className="reasoning-content">
            <div className="reasoning-factors">
              <div className="factor">
                <span className="factor-label">Urgency:</span>
                <div className="factor-bar">
                  <div 
                    className="factor-fill bg-red-400" 
                    style={{ width: `${(classification.urgency / 5) * 100}%` }}
                  />
                </div>
                <span className="factor-value">{classification.urgency}/5</span>
              </div>
              <div className="factor">
                <span className="factor-label">Importance:</span>
                <div className="factor-bar">
                  <div 
                    className="factor-fill bg-purple-400" 
                    style={{ width: `${(classification.importance / 5) * 100}%` }}
                  />
                </div>
                <span className="factor-value">{classification.importance}/5</span>
              </div>
            </div>
            {classification.reasoning && (
              <div className="ai-reasoning">
                <p className="reasoning-text">{classification.reasoning}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render based on mode
  if (mode === 'quick') return renderQuickView();
  if (isEditing) return renderEditMode();
  return renderViewMode();
}

/**
 * Priority Filter Component
 * Allows filtering emails by priority level with visual clarity
 */
export interface PriorityFilterProps {
  readonly selectedPriorities: Set<PriorityLevel>;
  readonly onPriorityToggle: (priority: PriorityLevel) => void;
  readonly emailCounts: Record<PriorityLevel, number>;
  readonly showCounts?: boolean;
}

export function PriorityFilter({
  selectedPriorities,
  onPriorityToggle,
  emailCounts,
  showCounts = true,
}: PriorityFilterProps): React.ReactElement {
  const priorityConfig = {
    urgent: { icon: '🚨', label: 'Urgent', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
    important: { icon: '⚡', label: 'Important', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
    normal: { icon: '📬', label: 'Normal', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    low: { icon: '📝', label: 'Low', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
    archive: { icon: '📦', label: 'Archive', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  };

  return (
    <div className="priority-filter">
      <div className="filter-header">
        <h3 className="filter-title">Filter by Priority</h3>
        <p className="filter-description">Select priority levels to focus on</p>
      </div>
      
      <div className="priority-filter-options">
        {(Object.keys(priorityConfig) as PriorityLevel[]).map(priority => {
          const config = priorityConfig[priority];
          const isSelected = selectedPriorities.has(priority);
          const count = emailCounts[priority] || 0;
          
          return (
            <button
              key={priority}
              onClick={() => onPriorityToggle(priority)}
              className={`filter-option ${config.color} ${isSelected ? 'selected ring-2 ring-current' : 'opacity-60'}`}
              type="button"
            >
              <span className="filter-icon">{config.icon}</span>
              <span className="filter-label">{config.label}</span>
              {showCounts && (
                <span className="filter-count">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="filter-actions">
        <button
          onClick={() => {
            (Object.keys(priorityConfig) as PriorityLevel[]).forEach(priority => {
              if (!selectedPriorities.has(priority)) {
                onPriorityToggle(priority);
              }
            });
          }}
          className="select-all-button"
          type="button"
        >
          Select All
        </button>
        
        <button
          onClick={() => {
            selectedPriorities.forEach(priority => onPriorityToggle(priority));
          }}
          className="clear-all-button"
          type="button"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}