/**
 * Priority Dashboard Items API
 * GET /api/dashboard/priority-items
 * 
 * Returns unified priority items (emails + calendar events) with AI summaries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20); // Max 20 items

    // For now, return mock priority items until Gmail client is properly integrated
    const mockPriorityItems = [
      {
        id: 'mock-1',
        type: 'email',
        title: 'Project Deadline Approaching',
        summary: 'Review and approve Q3 deliverables by end of day.',
        priority: 9,
        priorityLabel: 'Critical',
        priorityColor: 'red',
        source: 'manager@company.com',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        actionRequired: true,
        category: 'work',
        confidence: 0.95,
        metadata: {
          sender: 'manager@company.com',
          subject: 'Project Deadline Approaching',
          snippet: 'The Q3 project deliverables are due by end of day',
          gmailId: 'mock-1',
        },
      },
      {
        id: 'mock-2',
        type: 'email',
        title: 'Team Sync Meeting',
        summary: 'Weekly team sync meeting starts in 30 minutes.',
        priority: 7,
        priorityLabel: 'High',
        priorityColor: 'orange',
        source: 'team@company.com',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        actionRequired: false,
        category: 'work',
        confidence: 0.88,
        metadata: {
          sender: 'team@company.com',
          subject: 'Team Sync Meeting Reminder',
          snippet: 'Reminder for our weekly team sync meeting',
          gmailId: 'mock-2',
        },
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        items: mockPriorityItems.slice(0, limit),
        summary: {
          total: mockPriorityItems.length,
          critical: mockPriorityItems.filter(item => item.priority >= 9).length,
          high: mockPriorityItems.filter(item => item.priority >= 7 && item.priority < 9).length,
          medium: mockPriorityItems.filter(item => item.priority >= 5 && item.priority < 7).length,
          actionRequired: mockPriorityItems.filter(item => item.actionRequired).length,
        },
      },
    });

  } catch (error) {
    console.error('Priority items error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch priority items' },
      { status: 500 }
    );
  }
}

