/**
 * Classification Feedback Component
 * Allows users to provide feedback on AI email classifications for continuous improvement
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useAsyncOperation } from '@/lib/hooks';
import { EmailClassification, Email, EmailCategory } from '@/types';

export interface ClassificationFeedbackProps {
  readonly email: Email;
  readonly classification: EmailClassification;
  readonly onFeedbackSubmitted?: (feedbackType: 'confirmation' | 'correction' | 'partial_correction') => void;
  readonly compact?: boolean;
}

interface FeedbackForm {
  urgency?: number;
  importance?: number;
  actionRequired?: boolean | undefined;
  category?: EmailCategory;
  reasoning?: string;
}

export function ClassificationFeedback({
  email,
  classification,
  onFeedbackSubmitted,
  compact = false
}: ClassificationFeedbackProps): React.ReactElement {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correction' | 'partial_correction' | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({});
  const [userComment, setUserComment] = useState('');

  // Feedback submission
  const { 
    loading: submittingFeedback, 
    execute: submitFeedback 
  } = useAsyncOperation(
    (feedbackData: {
      feedbackType: 'confirmation' | 'correction' | 'partial_correction';
      userCorrection?: FeedbackForm;
      userComment?: string;
    }) => fetch('/api/feedback/classification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`,
      },
      body: JSON.stringify({
        emailId: email.id,
        originalClassification: classification,
        userCorrection: feedbackData.userCorrection || {},
        feedbackType: feedbackData.feedbackType,
        userComment: feedbackData.userComment,
        emailContext: {
          subject: email.subject,
          sender: email.sender.email,
          senderName: email.sender.name,
          snippet: email.snippet,
          timestamp: email.date.toISOString(),
        },
      }),
    }).then(async res => {
      if (!res.ok) {
        return { success: false as const, error: new Error(`HTTP ${res.status}: ${res.statusText}`) };
      }
      const result = await res.json();
      return { success: true as const, data: result };
    }).catch(error => {
      return { success: false as const, error: error instanceof Error ? error : new Error('Unknown error') };
    })
  );

  const handleConfirmClassification = useCallback(async (): Promise<void> => {
    const result = await submitFeedback({
      feedbackType: 'confirmation',
    });
    
    if (result) {
      onFeedbackSubmitted?.('confirmation');
    }
  }, [submitFeedback, onFeedbackSubmitted]);

  const handleSubmitCorrection = useCallback(async (): Promise<void> => {
    if (!feedbackType) return;

    // Determine what was corrected
    const corrections: FeedbackForm = {};
    let hasCorrections = false;

    if (feedbackForm.urgency !== undefined && feedbackForm.urgency !== classification.urgency) {
      corrections.urgency = feedbackForm.urgency;
      hasCorrections = true;
    }
    if (feedbackForm.importance !== undefined && feedbackForm.importance !== classification.importance) {
      corrections.importance = feedbackForm.importance;
      hasCorrections = true;
    }
    if (feedbackForm.actionRequired !== undefined && feedbackForm.actionRequired !== classification.actionRequired) {
      corrections.actionRequired = feedbackForm.actionRequired;
      hasCorrections = true;
    }
    if (feedbackForm.category !== undefined && feedbackForm.category !== classification.category) {
      corrections.category = feedbackForm.category;
      hasCorrections = true;
    }
    if (feedbackForm.reasoning && feedbackForm.reasoning.trim()) {
      corrections.reasoning = feedbackForm.reasoning;
      hasCorrections = true;
    }

    if (!hasCorrections) {
      alert('Please make at least one correction before submitting.');
      return;
    }

    const actualFeedbackType = Object.keys(corrections).length > 2 ? 'correction' : 'partial_correction';

    const feedbackData: any = {
      feedbackType: actualFeedbackType,
      userCorrection: corrections,
    };
    
    if (userComment.trim()) {
      feedbackData.userComment = userComment.trim();
    }
    
    const result = await submitFeedback(feedbackData);

    if (result) {
      setShowFeedbackForm(false);
      setFeedbackForm({});
      setUserComment('');
      setFeedbackType(null);
      onFeedbackSubmitted?.(actualFeedbackType);
      
      // Show success message with insights
      if (result.insights?.personalizedSuggestions?.length > 0) {
        alert(`${result.message}\n\n💡 Tip: ${result.insights.personalizedSuggestions[0]}`);
      } else if (result.message) {
        alert(result.message);
      }
    }
  }, [feedbackType, feedbackForm, userComment, classification, submitFeedback, onFeedbackSubmitted]);

  const handleStartCorrection = useCallback((type: 'correction' | 'partial_correction'): void => {
    setFeedbackType(type);
    setFeedbackForm({
      urgency: classification.urgency,
      importance: classification.importance,
      actionRequired: classification.actionRequired,
      category: classification.category,
    });
    setShowFeedbackForm(true);
  }, [classification]);

  const getUrgencyLabel = (urgency: number): string => {
    const labels = ['', 'None', 'Low', 'Medium', 'High', 'Critical'];
    return labels[urgency] || 'Unknown';
  };

  const getImportanceLabel = (importance: number): string => {
    const labels = ['', 'Trivial', 'Low', 'Medium', 'High', 'Critical'];
    return labels[importance] || 'Unknown';
  };

  if (compact) {
    return (
      <div className="classification-feedback-compact">
        <div className="feedback-actions flex items-center space-x-2">
          <button
            onClick={() => void handleConfirmClassification()}
            disabled={submittingFeedback}
            className="feedback-btn confirm px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50"
            type="button"
            title="Confirm this classification is correct"
          >
            {submittingFeedback ? '⟳' : '✓'}
          </button>
          <button
            onClick={() => handleStartCorrection('partial_correction')}
            disabled={submittingFeedback}
            className="feedback-btn correct px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 disabled:opacity-50"
            type="button"
            title="Make corrections to this classification"
          >
            📝
          </button>
        </div>

        {/* Correction Form Modal */}
        {showFeedbackForm && (
          <div className="feedback-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="modal-content bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Correct AI Classification
              </h3>
              
              <div className="form-fields space-y-4">
                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency (1-5)
                  </label>
                  <select
                    value={feedbackForm.urgency || ''}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, urgency: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select urgency</option>
                    {[1, 2, 3, 4, 5].map(level => (
                      <option key={level} value={level}>
                        {level} - {getUrgencyLabel(level)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Importance (1-5)
                  </label>
                  <select
                    value={feedbackForm.importance || ''}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select importance</option>
                    {[1, 2, 3, 4, 5].map(level => (
                      <option key={level} value={level}>
                        {level} - {getImportanceLabel(level)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={feedbackForm.category || ''}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, category: e.target.value as EmailCategory }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select category</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="financial">Financial</option>
                    <option value="opportunity">Opportunity</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="spam">Spam</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action Required
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="actionRequired"
                        checked={feedbackForm.actionRequired === true}
                        onChange={() => setFeedbackForm(prev => ({ ...prev, actionRequired: true }))}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="actionRequired"
                        checked={feedbackForm.actionRequired === false}
                        onChange={() => setFeedbackForm(prev => ({ ...prev, actionRequired: false }))}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reasoning (optional)
                  </label>
                  <textarea
                    value={feedbackForm.reasoning || ''}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, reasoning: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={3}
                    placeholder="Why is this classification incorrect?"
                  />
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Comments (optional)
                  </label>
                  <textarea
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={2}
                    placeholder="Any additional feedback to help improve AI accuracy"
                  />
                </div>
              </div>

              <div className="modal-actions flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowFeedbackForm(false);
                    setFeedbackForm({});
                    setUserComment('');
                    setFeedbackType(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSubmitCorrection()}
                  disabled={submittingFeedback}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  type="button"
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="classification-feedback bg-gray-50 rounded-lg p-4 mt-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">
        📝 Help Improve AI Accuracy
      </h4>
      
      <p className="text-xs text-gray-600 mb-3">
        Your feedback helps the AI learn your preferences and improve future classifications.
      </p>

      <div className="feedback-options space-y-2">
        <div className="option-row flex items-center justify-between p-2 bg-white rounded border">
          <span className="text-sm text-gray-700">This classification looks correct</span>
          <button
            onClick={() => void handleConfirmClassification()}
            disabled={submittingFeedback}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            type="button"
          >
            {submittingFeedback ? '⟳' : '✓ Confirm'}
          </button>
        </div>

        <div className="option-row flex items-center justify-between p-2 bg-white rounded border">
          <span className="text-sm text-gray-700">I need to make some corrections</span>
          <button
            onClick={() => handleStartCorrection('correction')}
            disabled={submittingFeedback}
            className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            type="button"
          >
            📝 Correct
          </button>
        </div>
      </div>

      <div className="feedback-stats mt-3 text-xs text-gray-500">
        <p>🧠 Your feedback trains a personalized AI model for better accuracy over time.</p>
      </div>

      {/* Correction Form Modal */}
      {showFeedbackForm && (
        <div className="feedback-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="modal-content bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Correct AI Classification
            </h3>
            
            <div className="original-classification mb-4 p-3 bg-gray-100 rounded">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Current Classification:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Urgency: {classification.urgency}/5</div>
                <div>Importance: {classification.importance}/5</div>
                <div>Category: {classification.category}</div>
                <div>Action Required: {classification.actionRequired ? 'Yes' : 'No'}</div>
              </div>
            </div>
            
            <div className="form-fields space-y-4">
              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Urgency (1-5)
                </label>
                <select
                  value={feedbackForm.urgency || ''}
                  onChange={(e) => setFeedbackForm(prev => ({ ...prev, urgency: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Keep current urgency</option>
                  {[1, 2, 3, 4, 5].map(level => (
                    <option key={level} value={level}>
                      {level} - {getUrgencyLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importance (1-5)
                </label>
                <select
                  value={feedbackForm.importance || ''}
                  onChange={(e) => setFeedbackForm(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Keep current importance</option>
                  {[1, 2, 3, 4, 5].map(level => (
                    <option key={level} value={level}>
                      {level} - {getImportanceLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={feedbackForm.category || ''}
                  onChange={(e) => setFeedbackForm(prev => ({ ...prev, category: e.target.value as EmailCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Keep current category</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="financial">Financial</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="spam">Spam</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Required
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="actionRequired"
                      checked={feedbackForm.actionRequired === true}
                      onChange={() => setFeedbackForm(prev => ({ ...prev, actionRequired: true }))}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="actionRequired"
                      checked={feedbackForm.actionRequired === false}
                      onChange={() => setFeedbackForm(prev => ({ ...prev, actionRequired: false }))}
                      className="mr-2"
                    />
                    No
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="actionRequired"
                      checked={feedbackForm.actionRequired === undefined}
                      onChange={() => setFeedbackForm(prev => ({ ...prev, actionRequired: undefined }))}
                      className="mr-2"
                    />
                    Keep current
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Why is this incorrect? (optional but helpful)
                </label>
                <textarea
                  value={feedbackForm.reasoning || ''}
                  onChange={(e) => setFeedbackForm(prev => ({ ...prev, reasoning: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                  placeholder="E.g., 'This is from my manager so it should be higher urgency' or 'This is a newsletter that was miscategorized'"
                />
              </div>

              <div className="form-group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Comments (optional)
                </label>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={2}
                  placeholder="Any other feedback to help the AI learn your preferences"
                />
              </div>
            </div>

            <div className="modal-actions flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowFeedbackForm(false);
                  setFeedbackForm({});
                  setUserComment('');
                  setFeedbackType(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmitCorrection()}
                disabled={submittingFeedback}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                type="button"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}