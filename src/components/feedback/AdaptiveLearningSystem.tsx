/**
 * Adaptive Learning System Component
 * Neurodivergent-friendly feedback and learning mechanisms
 * Helps the AI learn user preferences while supporting executive function
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Email, EmailClassification } from '@/types';

export interface UserFeedback {
  readonly id: string;
  readonly emailId: string;
  readonly classification: EmailClassification;
  readonly userCorrection?: Partial<EmailClassification> | undefined;
  readonly feedbackType: 'correction' | 'confirmation' | 'suggestion';
  readonly confidence: number; // How confident the user is in their feedback
  readonly timestamp: Date;
  readonly context?: {
    readonly timeOfDay: string;
    readonly deviceType: string;
    readonly energyLevel?: 'high' | 'medium' | 'low';
    readonly focusMode?: boolean;
  } | undefined;
}

export interface LearningPattern {
  readonly pattern: string;
  readonly confidence: number;
  readonly frequency: number;
  readonly lastSeen: Date;
  readonly examples: string[];
}

interface AdaptiveLearningProps {
  readonly email: Email;
  readonly classification?: EmailClassification;
  readonly onFeedbackSubmit: (feedback: UserFeedback) => Promise<void>;
  readonly learningPatterns?: readonly LearningPattern[];
  readonly mode: 'simple' | 'detailed' | 'minimal';
  readonly showLearningProgress?: boolean;
}

export function AdaptiveLearningSystem({
  email,
  classification,
  onFeedbackSubmit,
  learningPatterns = [],
  mode = 'simple',
  showLearningProgress = true,
}: AdaptiveLearningProps): React.ReactElement {
  const [feedbackMode, setFeedbackMode] = useState<'closed' | 'simple' | 'detailed'>('closed');
  const [confidence, setConfidence] = useState<number>(3); // 1-5 scale
  const [energyLevel, setEnergyLevel] = useState<'high' | 'medium' | 'low'>('medium');
  const [userCorrection, setUserCorrection] = useState<Partial<EmailClassification>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simplified feedback options for neurodivergent users
  const simpleFeedbackOptions = useMemo(() => [
    { id: 'perfect', label: '✅ Perfect', emoji: '✅', description: 'This classification is exactly right' },
    { id: 'mostly-right', label: '👍 Mostly Right', emoji: '👍', description: 'Close, but could be improved' },
    { id: 'somewhat-off', label: '🤔 Somewhat Off', emoji: '🤔', description: 'Some parts are wrong' },
    { id: 'way-off', label: '❌ Way Off', emoji: '❌', description: 'This needs significant correction' },
    { id: 'not-sure', label: '🤷 Not Sure', emoji: '🤷', description: 'I need help understanding this' },
  ], []);

  const getCurrentContext = useCallback(() => ({
    timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
    deviceType: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
    energyLevel,
    focusMode: mode === 'minimal',
  }), [energyLevel, mode]);

  const handleSimpleFeedback = useCallback(async (optionId: string) => {
    setIsSubmitting(true);
    
    try {
      let userCorrection: Partial<EmailClassification> | undefined = undefined;

      // Add simple corrections based on feedback
      if (optionId === 'way-off') {
        userCorrection = {
          urgency: Math.max(1, Math.min(5, classification!.urgency + (Math.random() > 0.5 ? 1 : -1))) as 1 | 2 | 3 | 4 | 5,
          importance: Math.max(1, Math.min(5, classification!.importance + (Math.random() > 0.5 ? 1 : -1))) as 1 | 2 | 3 | 4 | 5,
        };
      }

      const feedback: UserFeedback = {
        id: `feedback-${Date.now()}`,
        emailId: email.id,
        classification: classification!,
        userCorrection,
        feedbackType: optionId === 'perfect' ? 'confirmation' : 'correction',
        confidence: optionId === 'perfect' ? 5 : optionId === 'not-sure' ? 1 : confidence,
        timestamp: new Date(),
        context: getCurrentContext(),
      };

      await onFeedbackSubmit(feedback);
      setFeedbackMode('closed');
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [email.id, classification, confidence, onFeedbackSubmit, getCurrentContext]);

  const handleDetailedFeedback = useCallback(async () => {
    if (!classification) return;
    
    setIsSubmitting(true);
    
    try {
      const feedback: UserFeedback = {
        id: `feedback-${Date.now()}`,
        emailId: email.id,
        classification,
        userCorrection,
        feedbackType: Object.keys(userCorrection).length > 0 ? 'correction' : 'confirmation',
        confidence,
        timestamp: new Date(),
        context: getCurrentContext(),
      };

      await onFeedbackSubmit(feedback);
      setFeedbackMode('closed');
      setUserCorrection({});
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [email.id, classification, userCorrection, confidence, onFeedbackSubmit, getCurrentContext]);

  const renderSimpleFeedback = (): React.ReactElement => (
    <div className="simple-feedback-container">
      <div className="feedback-header">
        <h4 className="feedback-title">How did we do?</h4>
        <p className="feedback-subtitle">Your feedback helps us learn your preferences</p>
      </div>
      
      <div className="simple-feedback-options">
        {simpleFeedbackOptions.map(option => (
          <button
            key={option.id}
            onClick={() => void handleSimpleFeedback(option.id)}
            disabled={isSubmitting}
            className="simple-feedback-button"
            type="button"
            title={option.description}
          >
            <span className="feedback-emoji">{option.emoji}</span>
            <span className="feedback-label">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="energy-level-selector">
        <label className="energy-level-label">
          My energy level right now:
        </label>
        <div className="energy-options">
          {(['high', 'medium', 'low'] as const).map(level => (
            <button
              key={level}
              onClick={() => setEnergyLevel(level)}
              className={`energy-button ${energyLevel === level ? 'selected' : ''}`}
              type="button"
            >
              {level === 'high' ? '⚡' : level === 'medium' ? '🔋' : '😴'} {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDetailedFeedback = (): React.ReactElement => (
    <div className="detailed-feedback-container">
      <div className="feedback-header">
        <h4 className="feedback-title">Detailed Feedback</h4>
        <p className="feedback-subtitle">Help us understand your preferences better</p>
      </div>

      <div className="correction-fields">
        <div className="correction-field">
          <label className="correction-label">Urgency (1-5):</label>
          <div className="urgency-slider">
            <input
              type="range"
              min="1"
              max="5"
              value={userCorrection.urgency ?? classification?.urgency ?? 3}
              onChange={(e) => setUserCorrection(prev => ({ ...prev, urgency: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
              className="slider"
            />
            <span className="slider-value">{userCorrection.urgency ?? classification?.urgency ?? 3}</span>
          </div>
        </div>

        <div className="correction-field">
          <label className="correction-label">Importance (1-5):</label>
          <div className="importance-slider">
            <input
              type="range"
              min="1"
              max="5"
              value={userCorrection.importance ?? classification?.importance ?? 3}
              onChange={(e) => setUserCorrection(prev => ({ ...prev, importance: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
              className="slider"
            />
            <span className="slider-value">{userCorrection.importance ?? classification?.importance ?? 3}</span>
          </div>
        </div>

        <div className="correction-field">
          <label className="correction-label">Category:</label>
          <select
            value={userCorrection.category ?? classification?.category ?? 'other'}
            onChange={(e) => setUserCorrection(prev => ({ ...prev, category: e.target.value as any }))}
            className="category-select"
          >
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="financial">Financial</option>
            <option value="opportunity">Opportunity</option>
            <option value="newsletter">Newsletter</option>
            <option value="spam">Spam</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="correction-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={userCorrection.actionRequired ?? classification?.actionRequired ?? false}
              onChange={(e) => setUserCorrection(prev => ({ ...prev, actionRequired: e.target.checked }))}
            />
            Action Required
          </label>
        </div>
      </div>

      <div className="confidence-selector">
        <label className="confidence-label">How confident are you in this feedback?</label>
        <div className="confidence-options">
          {[1, 2, 3, 4, 5].map(level => (
            <button
              key={level}
              onClick={() => setConfidence(level)}
              className={`confidence-button ${confidence === level ? 'selected' : ''}`}
              type="button"
            >
              {level === 1 ? '🤷' : level === 2 ? '😐' : level === 3 ? '🙂' : level === 4 ? '😊' : '💪'}
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="detailed-feedback-actions">
        <button
          onClick={() => setFeedbackMode('closed')}
          className="cancel-feedback-button"
          type="button"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleDetailedFeedback()}
          disabled={isSubmitting}
          className="submit-feedback-button"
          type="button"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );

  const renderLearningProgress = (): React.ReactElement | null => {
    if (!showLearningProgress || learningPatterns.length === 0) return null;

    return (
      <div className="learning-progress-container">
        <div className="progress-header">
          <h4 className="progress-title">🧠 Learning Progress</h4>
          <p className="progress-subtitle">AI is learning your preferences</p>
        </div>
        
        <div className="learning-patterns">
          {learningPatterns.slice(0, 3).map((pattern, index) => (
            <div key={index} className="learning-pattern">
              <div className="pattern-info">
                <span className="pattern-text">{pattern.pattern}</span>
                <span className="pattern-confidence">
                  {Math.round(pattern.confidence * 100)}% confident
                </span>
              </div>
              <div className="pattern-bar">
                <div 
                  className="pattern-fill" 
                  style={{ width: `${pattern.confidence * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!classification) {
    return (
      <div className="no-classification-feedback">
        <p className="feedback-prompt">Once this email is classified, you can provide feedback to help improve accuracy.</p>
      </div>
    );
  }

  return (
    <div className="adaptive-learning-system">
      {feedbackMode === 'closed' && (
        <div className="feedback-trigger">
          <button
            onClick={() => setFeedbackMode(mode === 'detailed' ? 'detailed' : 'simple')}
            className="open-feedback-button"
            type="button"
          >
            <span className="feedback-icon">💬</span>
            <span className="feedback-text">Give Feedback</span>
          </button>
          
          {mode !== 'minimal' && (
            <button
              onClick={() => setFeedbackMode(feedbackMode === 'closed' ? 'detailed' : 'simple')}
              className="toggle-mode-button"
              type="button"
              title="Switch feedback mode"
            >
              ⚙️
            </button>
          )}
        </div>
      )}

      {feedbackMode === 'simple' && renderSimpleFeedback()}
      {feedbackMode === 'detailed' && renderDetailedFeedback()}
      
      {renderLearningProgress()}
    </div>
  );
}

/**
 * Learning Statistics Display
 * Shows aggregated learning statistics and user patterns
 */
export interface LearningStatsProps {
  readonly totalFeedback: number;
  readonly accuracyTrend: readonly number[];
  readonly topPatterns: readonly LearningPattern[];
  readonly userPreferenceStrength: number; // 0-1 scale
}

export function LearningStatsDisplay({
  totalFeedback,
  accuracyTrend,
  topPatterns,
  userPreferenceStrength,
}: LearningStatsProps): React.ReactElement {
  const getAccuracyTrendIcon = (): string => {
    if (accuracyTrend.length < 2) return '📊';
    const recent = accuracyTrend[accuracyTrend.length - 1];
    const previous = accuracyTrend[accuracyTrend.length - 2];
    
    if (recent !== undefined && previous !== undefined) {
      if (recent > previous) return '📈';
      if (recent < previous) return '📉';
    }
    return '📊';
  };

  const getPreferenceStrengthColor = (): string => {
    if (userPreferenceStrength >= 0.8) return 'text-green-600 bg-green-50';
    if (userPreferenceStrength >= 0.6) return 'text-blue-600 bg-blue-50';
    if (userPreferenceStrength >= 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="learning-stats-display">
      <div className="stats-header">
        <h3 className="stats-title">📊 Learning Statistics</h3>
        <p className="stats-subtitle">How well the AI understands your preferences</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-value">{totalFeedback}</div>
            <div className="stat-label">Feedback Given</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">{getAccuracyTrendIcon()}</div>
          <div className="stat-content">
            <div className="stat-value">
              {accuracyTrend.length > 0 && accuracyTrend[accuracyTrend.length - 1] !== undefined 
                ? `${Math.round(accuracyTrend[accuracyTrend.length - 1]! * 100)}%` 
                : 'N/A'}
            </div>
            <div className="stat-label">Current Accuracy</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className={`stat-value ${getPreferenceStrengthColor()}`}>
              {Math.round(userPreferenceStrength * 100)}%
            </div>
            <div className="stat-label">Preference Understanding</div>
          </div>
        </div>
      </div>

      {topPatterns.length > 0 && (
        <div className="top-patterns">
          <h4 className="patterns-title">🔍 Discovered Patterns</h4>
          <div className="patterns-list">
            {topPatterns.slice(0, 3).map((pattern, index) => (
              <div key={index} className="pattern-item">
                <div className="pattern-rank">#{index + 1}</div>
                <div className="pattern-details">
                  <div className="pattern-description">{pattern.pattern}</div>
                  <div className="pattern-stats">
                    {Math.round(pattern.confidence * 100)}% confident • {pattern.frequency} examples
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}