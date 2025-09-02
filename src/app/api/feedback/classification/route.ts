/**
 * Classification Feedback API Route
 * POST /api/feedback/classification
 * 
 * Collects user feedback on AI email classifications for continuous improvement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// EmailClassification type available but not used in this file
import { z } from 'zod';

// Feedback validation schema
const classificationFeedbackSchema = z.object({
  emailId: z.string(),
  originalClassification: z.object({
    urgency: z.number().min(1).max(5),
    importance: z.number().min(1).max(5),
    actionRequired: z.boolean(),
    category: z.enum(['work', 'personal', 'financial', 'opportunity', 'newsletter', 'spam', 'other']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  }),
  userCorrection: z.object({
    urgency: z.number().min(1).max(5).optional(),
    importance: z.number().min(1).max(5).optional(),
    actionRequired: z.boolean().optional(),
    category: z.enum(['work', 'personal', 'financial', 'opportunity', 'newsletter', 'spam', 'other']).optional(),
    reasoning: z.string().optional(),
  }),
  feedbackType: z.enum(['correction', 'confirmation', 'partial_correction']),
  userComment: z.string().optional(),
  emailContext: z.object({
    subject: z.string().nullable(),
    sender: z.string().email(),
    senderName: z.string().optional(),
    snippet: z.string(),
    timestamp: z.string().datetime(),
  }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = classificationFeedbackSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid feedback data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const feedbackData = validationResult.data;

    // Get authenticated user
    const supabase = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') ?? '',
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Calculate feedback quality scores
    const feedbackAnalysis = analyzeFeedback(feedbackData);

    // Store feedback in database
    const { data: feedbackRecord, error: insertError } = await supabase
      .from('classification_feedback')
      .insert({
        user_id: user.id,
        email_id: feedbackData.emailId,
        original_classification: feedbackData.originalClassification,
        user_correction: feedbackData.userCorrection,
        feedback_type: feedbackData.feedbackType,
        user_comment: feedbackData.userComment || null,
        email_context: feedbackData.emailContext,
        feedback_quality_score: feedbackAnalysis.qualityScore,
        disagreement_magnitude: feedbackAnalysis.disagreementMagnitude,
        improvement_suggestions: feedbackAnalysis.suggestions,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store classification feedback:', insertError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save feedback',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // Update email record with corrected classification if provided
    if (feedbackData.feedbackType === 'correction' || feedbackData.feedbackType === 'partial_correction') {
      const updatedClassification = {
        ...feedbackData.originalClassification,
        ...feedbackData.userCorrection,
        // Mark as user-corrected
        userCorrected: true,
        correctionTimestamp: new Date().toISOString(),
      };

      await supabase
        .from('emails')
        .update({
          classification: updatedClassification,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('gmail_id', feedbackData.emailId);
    }

    // Update user feedback statistics
    await updateUserFeedbackStats(supabase, user.id, feedbackData.feedbackType);

    // Generate improvement insights for the AI model
    const improvementInsights = await generateImprovementInsights(
      supabase,
      user.id,
      feedbackData,
      feedbackAnalysis
    );

    return NextResponse.json({
      success: true,
      data: {
        feedbackId: feedbackRecord.id,
        analysis: feedbackAnalysis,
        insights: improvementInsights,
        message: generateFeedbackMessage(feedbackData.feedbackType, feedbackAnalysis),
      },
    });

  } catch (error) {
    console.error('Classification feedback API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Analyze feedback quality and disagreement patterns
 */
function analyzeFeedback(feedbackData: z.infer<typeof classificationFeedbackSchema>): {
  qualityScore: number;
  disagreementMagnitude: number;
  suggestions: string[];
  correctionAreas: string[];
} {
  const { originalClassification, userCorrection, feedbackType } = feedbackData;
  
  let qualityScore = 0.5; // Base score
  const suggestions: string[] = [];
  const correctionAreas: string[] = [];
  let disagreementMagnitude = 0;

  if (feedbackType === 'confirmation') {
    qualityScore = 0.9;
    return { qualityScore, disagreementMagnitude, suggestions, correctionAreas };
  }

  // Analyze specific corrections
  if (userCorrection.urgency !== undefined) {
    const urgencyDiff = Math.abs(originalClassification.urgency - userCorrection.urgency);
    disagreementMagnitude += urgencyDiff * 0.3;
    
    if (urgencyDiff >= 3) {
      suggestions.push('Large urgency disagreement - review urgency detection patterns');
      correctionAreas.push('urgency');
    } else if (urgencyDiff >= 2) {
      suggestions.push('Moderate urgency disagreement - fine-tune urgency scoring');
      correctionAreas.push('urgency');
    }
  }

  if (userCorrection.importance !== undefined) {
    const importanceDiff = Math.abs(originalClassification.importance - userCorrection.importance);
    disagreementMagnitude += importanceDiff * 0.3;
    
    if (importanceDiff >= 3) {
      suggestions.push('Large importance disagreement - review importance detection patterns');
      correctionAreas.push('importance');
    } else if (importanceDiff >= 2) {
      suggestions.push('Moderate importance disagreement - fine-tune importance scoring');
      correctionAreas.push('importance');
    }
  }

  if (userCorrection.actionRequired !== undefined && 
      userCorrection.actionRequired !== originalClassification.actionRequired) {
    disagreementMagnitude += 0.4;
    suggestions.push('Action required disagreement - review action detection keywords');
    correctionAreas.push('actionRequired');
  }

  if (userCorrection.category !== undefined && 
      userCorrection.category !== originalClassification.category) {
    disagreementMagnitude += 0.5;
    suggestions.push(`Category correction: ${originalClassification.category} → ${userCorrection.category}`);
    correctionAreas.push('category');
  }

  // Calculate quality score based on disagreement and context
  if (disagreementMagnitude < 0.5) {
    qualityScore = 0.8; // Minor corrections
  } else if (disagreementMagnitude < 1.0) {
    qualityScore = 0.6; // Moderate corrections
  } else if (disagreementMagnitude < 2.0) {
    qualityScore = 0.4; // Major corrections
  } else {
    qualityScore = 0.2; // Significant disagreement
  }

  // Boost quality if user provided reasoning
  if (userCorrection.reasoning && userCorrection.reasoning.length > 10) {
    qualityScore += 0.1;
    suggestions.push('User provided detailed reasoning - high-quality feedback');
  }

  // Consider original AI confidence
  if (originalClassification.confidence < 0.6 && disagreementMagnitude > 0.5) {
    suggestions.push('Low confidence classification corrected - expected improvement area');
    qualityScore += 0.1;
  }

  return {
    qualityScore: Math.min(qualityScore, 1.0),
    disagreementMagnitude,
    suggestions,
    correctionAreas,
  };
}

/**
 * Update user feedback statistics
 */
async function updateUserFeedbackStats(
  supabase: any,
  userId: string,
  feedbackType: string
): Promise<void> {
  try {
    const { data: stats } = await supabase
      .from('user_feedback_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentStats = stats || {
      user_id: userId,
      total_feedback_count: 0,
      confirmation_count: 0,
      correction_count: 0,
      partial_correction_count: 0,
      average_quality_score: 0.5,
      last_feedback_at: null,
    };

    const newStats = {
      ...currentStats,
      total_feedback_count: currentStats.total_feedback_count + 1,
      [`${feedbackType}_count`]: (currentStats[`${feedbackType}_count`] || 0) + 1,
      last_feedback_at: new Date().toISOString(),
    };

    await supabase
      .from('user_feedback_stats')
      .upsert(newStats, { onConflict: 'user_id' });

  } catch (error) {
    console.warn('Failed to update user feedback stats:', error);
  }
}

/**
 * Generate improvement insights based on feedback patterns
 */
async function generateImprovementInsights(
  supabase: any,
  userId: string,
  feedbackData: z.infer<typeof classificationFeedbackSchema>,
  _analysis: ReturnType<typeof analyzeFeedback>
): Promise<{
  userPatterns: Record<string, unknown>;
  modelInsights: string[];
  personalizedSuggestions: string[];
}> {
  try {
    // Get recent feedback patterns for this user
    const { data: recentFeedback } = await supabase
      .from('classification_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const userPatterns: Record<string, unknown> = {};
    const modelInsights: string[] = [];
    const personalizedSuggestions: string[] = [];

    if (recentFeedback && recentFeedback.length > 0) {
      // Analyze correction patterns
      const categoryCorrections = recentFeedback
        .filter((f: any) => f.user_correction?.category)
        .reduce((acc: Record<string, number>, f: any) => {
          const key = `${f.original_classification.category}->${f.user_correction.category}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

      const urgencyCorrections = recentFeedback
        .filter((f: any) => f.user_correction?.urgency)
        .map((f: any) => ({
          original: f.original_classification.urgency,
          corrected: f.user_correction.urgency,
          diff: f.user_correction.urgency - f.original_classification.urgency,
        }));

      userPatterns['categoryCorrections'] = categoryCorrections;
      userPatterns['avgUrgencyCorrection'] = urgencyCorrections.length > 0
        ? urgencyCorrections.reduce((sum: number, c: { diff: number }) => sum + c.diff, 0) / urgencyCorrections.length
        : 0;

      // Generate insights
      const confirmationRate = recentFeedback.filter((f: any) => f.feedback_type === 'confirmation').length / recentFeedback.length;
      
      if (confirmationRate > 0.8) {
        modelInsights.push('High accuracy for this user - model performing well');
        personalizedSuggestions.push('AI is learning your preferences well! Keep providing feedback for even better accuracy.');
      } else if (confirmationRate < 0.5) {
        modelInsights.push('Lower accuracy for this user - needs personalization improvement');
        personalizedSuggestions.push('AI is still learning your preferences. Your feedback is very valuable for improvement.');
      }

      // Detect sender-specific patterns
      const senderFeedback = recentFeedback
        .filter((f: any) => f.email_context?.sender === feedbackData.emailContext.sender)
        .slice(0, 10);

      if (senderFeedback.length >= 3) {
        const senderCorrections = senderFeedback.filter((f: any) => f.feedback_type !== 'confirmation').length;
        if (senderCorrections > senderFeedback.length * 0.6) {
          personalizedSuggestions.push(`Consider creating a rule for emails from ${feedbackData.emailContext.senderName || feedbackData.emailContext.sender}`);
        }
      }
    }

    return {
      userPatterns,
      modelInsights,
      personalizedSuggestions,
    };

  } catch (error) {
    console.warn('Failed to generate improvement insights:', error);
    return {
      userPatterns: {},
      modelInsights: [],
      personalizedSuggestions: [],
    };
  }
}

/**
 * Generate user-friendly feedback message
 */
function generateFeedbackMessage(
  feedbackType: string,
  analysis: ReturnType<typeof analyzeFeedback>
): string {
  switch (feedbackType) {
    case 'confirmation':
      return 'Thanks for confirming! Your feedback helps validate the AI model.';
    
    case 'correction':
      if (analysis.disagreementMagnitude < 1.0) {
        return 'Thanks for the correction! This helps fine-tune the AI model.';
      } else {
        return 'Thanks for the significant correction! This feedback is very valuable for improving AI accuracy.';
      }
    
    case 'partial_correction':
      return 'Thanks for the partial correction! Your input helps refine specific aspects of the classification.';
    
    default:
      return 'Thanks for your feedback! It helps improve the AI system.';
  }
}

export interface ClassificationFeedbackResponse {
  readonly success: boolean;
  readonly data?: {
    readonly feedbackId: string;
    readonly analysis: {
      readonly qualityScore: number;
      readonly disagreementMagnitude: number;
      readonly suggestions: readonly string[];
      readonly correctionAreas: readonly string[];
    };
    readonly insights: {
      readonly userPatterns: Record<string, unknown>;
      readonly modelInsights: readonly string[];
      readonly personalizedSuggestions: readonly string[];
    };
    readonly message: string;
  };
  readonly error?: string;
  readonly details?: unknown;
}