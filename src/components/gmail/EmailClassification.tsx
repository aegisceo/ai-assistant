/**
 * Email Classification Display Component
 * Shows AI-generated email classification with visual indicators
 */

'use client';

import React from 'react';
import { EmailClassification, Email } from '@/types';
import { ClassificationFeedback } from '@/components/feedback';

export interface EmailClassificationProps {
  readonly classification?: EmailClassification;
  readonly suggestions?: readonly string[];
  readonly metadata?: {
    readonly processingTimeMs: number;
    readonly tokensUsed: number;
    readonly confidenceBreakdown: Record<string, number>;
  };
  readonly compact?: boolean;
  readonly showDetails?: boolean;
  readonly email?: Email;
  readonly showFeedback?: boolean;
}

export function EmailClassificationDisplay({ 
  classification,
  suggestions,
  metadata,
  compact = false,
  showDetails = false,
  email,
  showFeedback = false
}: EmailClassificationProps): React.ReactElement | null {
  if (!classification) {
    return null;
  }

  const getUrgencyColor = (urgency: number): string => {
    switch (urgency) {
      case 5: return 'text-red-600 bg-red-50';
      case 4: return 'text-orange-600 bg-orange-50';
      case 3: return 'text-yellow-600 bg-yellow-50';
      case 2: return 'text-blue-600 bg-blue-50';
      case 1: return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImportanceColor = (importance: number): string => {
    switch (importance) {
      case 5: return 'text-purple-600 bg-purple-50';
      case 4: return 'text-indigo-600 bg-indigo-50';
      case 3: return 'text-blue-600 bg-blue-50';
      case 2: return 'text-green-600 bg-green-50';
      case 1: return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'work': return 'text-blue-700 bg-blue-100';
      case 'personal': return 'text-green-700 bg-green-100';
      case 'financial': return 'text-yellow-700 bg-yellow-100';
      case 'opportunity': return 'text-purple-700 bg-purple-100';
      case 'newsletter': return 'text-indigo-700 bg-indigo-100';
      case 'spam': return 'text-red-700 bg-red-100';
      case 'other': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getUrgencyLabel = (urgency: number): string => {
    switch (urgency) {
      case 5: return 'Critical';
      case 4: return 'High';
      case 3: return 'Medium';
      case 2: return 'Low';
      case 1: return 'None';
      default: return 'Unknown';
    }
  };

  const getImportanceLabel = (importance: number): string => {
    switch (importance) {
      case 5: return 'Critical';
      case 4: return 'High';
      case 3: return 'Medium';
      case 2: return 'Low';
      case 1: return 'Trivial';
      default: return 'Unknown';
    }
  };

  if (compact) {
    return (
      <div className="classification-compact">
        <div className="flex items-center space-x-2 text-xs">
          <span className={`px-2 py-1 rounded-full font-medium ${getUrgencyColor(classification.urgency)}`}>
            U{classification.urgency}
          </span>
          <span className={`px-2 py-1 rounded-full font-medium ${getImportanceColor(classification.importance)}`}>
            I{classification.importance}
          </span>
          <span className={`px-2 py-1 rounded-full font-medium ${getCategoryColor(classification.category)}`}>
            {classification.category}
          </span>
          {classification.actionRequired && (
            <span className="px-2 py-1 rounded-full font-medium text-red-600 bg-red-50">
              Action Required
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="classification-detailed">
      <div className="classification-header">
        <h4 className="text-sm font-medium text-gray-900 mb-2">AI Classification</h4>
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <span>Confidence: {Math.round(classification.confidence * 100)}%</span>
          {metadata && (
            <span>• {metadata.processingTimeMs}ms</span>
          )}
        </div>
      </div>

      <div className="classification-metrics">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="metric">
            <div className="text-xs text-gray-600 mb-1">Urgency</div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(classification.urgency)}`}>
              {getUrgencyLabel(classification.urgency)} ({classification.urgency}/5)
            </div>
          </div>
          <div className="metric">
            <div className="text-xs text-gray-600 mb-1">Importance</div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${getImportanceColor(classification.importance)}`}>
              {getImportanceLabel(classification.importance)} ({classification.importance}/5)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="metric">
            <div className="text-xs text-gray-600 mb-1">Category</div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(classification.category)}`}>
              {classification.category}
            </div>
          </div>
          <div className="metric">
            <div className="text-xs text-gray-600 mb-1">Action Required</div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              classification.actionRequired 
                ? 'text-red-600 bg-red-50' 
                : 'text-green-600 bg-green-50'
            }`}>
              {classification.actionRequired ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {classification.reasoning && (
        <div className="reasoning">
          <div className="text-xs text-gray-600 mb-1">AI Reasoning</div>
          <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
            {classification.reasoning}
          </div>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="suggestions">
          <div className="text-xs text-gray-600 mb-2">Suggestions</div>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-xs text-gray-700 flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showDetails && metadata && (
        <div className="metadata">
          <div className="text-xs text-gray-600 mb-2">Classification Details</div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>Processing Time: {metadata.processingTimeMs}ms</div>
            <div>Tokens Used: {metadata.tokensUsed}</div>
            {metadata.confidenceBreakdown && (
              <div className="confidence-breakdown">
                <div className="font-medium">Confidence Breakdown:</div>
                {Object.entries(metadata.confidenceBreakdown).map(([key, value]) => (
                  <div key={key} className="ml-2">
                    {key.replace('_confidence', '')}: {Math.round(value * 100)}%
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Classification Feedback */}
      {!compact && showFeedback && email && (
        <ClassificationFeedback
          email={email}
          classification={classification}
          compact={true}
        />
      )}
    </div>
  );
}

/**
 * Classification Button Component
 * Shows classification status and provides classify action
 */
export interface ClassificationButtonProps {
  readonly email: import('@/types').Email;
  readonly classification?: EmailClassification | undefined;
  readonly onClassify: (email: import('@/types').Email) => Promise<void>;
  readonly loading?: boolean;
}

export function ClassificationButton({
  email,
  classification,
  onClassify,
  loading = false
}: ClassificationButtonProps): React.ReactElement {
  if (classification) {
    return (
      <div className="classification-status">
        <EmailClassificationDisplay 
          classification={classification} 
          compact={true}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => void onClassify(email)}
      disabled={loading}
      className="classify-button"
      type="button"
      title="Classify with AI"
    >
      {loading ? (
        <div className="loading-spinner" />
      ) : (
        <span className="classify-icon">🤖</span>
      )}
      <span className="classify-text">
        {loading ? 'Classifying...' : 'Classify'}
      </span>
    </button>
  );
}