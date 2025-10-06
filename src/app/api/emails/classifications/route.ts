/**
 * Email Classifications API Route
 * POST /api/emails/classifications
 * 
 * Fetches stored classifications for a list of email IDs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EmailClassification } from '@/types';
import { z } from 'zod';

// Request validation schema
const fetchClassificationsSchema = z.object({
  emailIds: z.array(z.string()).max(100), // Limit to 100 email IDs per request
}).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json() as unknown;
    const validationResult = fetchClassificationsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { emailIds } = validationResult.data;

    if (emailIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    // Fetch classifications from database
    const { data: emailsData, error: fetchError } = await (supabase as any)
      .from('emails')
      .select('gmail_id, classification')
      .eq('user_id', user.id)
      .in('gmail_id', emailIds)
      .not('classification', 'is', null);

    if (fetchError) {
      console.error('Error fetching classifications:', fetchError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch classifications',
          details: fetchError.message,
        },
        { status: 500 }
      );
    }

    // Convert to the expected format
    const classificationsMap: Record<string, EmailClassification> = {};
    
    if (emailsData) {
      for (const email of emailsData) {
        if (email.classification && email.gmail_id) {
          // Ensure the classification has the correct structure
          const classification = email.classification as any;
          classificationsMap[email.gmail_id] = {
            urgency: classification.urgency as 1 | 2 | 3 | 4 | 5,
            importance: classification.importance as 1 | 2 | 3 | 4 | 5,
            actionRequired: classification.actionRequired === true,
            category: classification.category as EmailClassification['category'],
            confidence: classification.confidence || 0.5,
            reasoning: classification.reasoning || '',
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: classificationsMap,
    });

  } catch (error) {
    console.error('Classifications fetch API error:', error);
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

export interface ClassificationsResponse {
  readonly success: boolean;
  readonly data?: Record<string, EmailClassification>;
  readonly error?: string;
  readonly details?: unknown;
}