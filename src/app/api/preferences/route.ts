import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dbService } from '@/lib/database';

import { 
  validateUserPreferences
} from '@/lib/validation';
import { UserPreferences } from '@/types';

/**
 * GET /api/preferences - Get user preferences
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user preferences from database
    const preferences = await dbService.getUserPreferences(user.id);

    if (preferences) {
      return NextResponse.json({
        success: true,
        data: preferences,
        isDefault: false
      });
    }

    // If no preferences exist, return defaults
    const defaultPreferences: UserPreferences = {
      emailClassificationEnabled: true,
      autoUnsubscribeEnabled: false,
      priorityCategories: ['work', 'financial', 'opportunity'],
      workingHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5] as const // Monday to Friday
      },
      notificationSettings: {
        urgentEmails: true,
        upcomingEvents: true,
        missedOpportunities: true
      }
    };

    return NextResponse.json({
      success: true,
      data: defaultPreferences,
      isDefault: true
    });

  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/preferences - Update user preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const requestData = await request.json();
    const validationResult = validateUserPreferences(requestData);
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid preferences data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const preferences = validationResult.data;

    // Prepare database record
    const dbData = {
      user_id: user.id,
      email_classification_enabled: preferences.emailClassificationEnabled,
      auto_unsubscribe_enabled: preferences.autoUnsubscribeEnabled,
      priority_categories: preferences.priorityCategories,
      working_hours: preferences.workingHours,
      notification_settings: preferences.notificationSettings,
      updated_at: new Date().toISOString()
    };

    // Check if preferences already exist
    const { data: existingPrefs } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    
    if (existingPrefs) {
      // Update existing preferences
      result = await (supabase as any)
        .from('user_preferences')
        .update(dbData)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      // Insert new preferences
      result = await (supabase as any)
        .from('user_preferences')
        .insert({
          ...dbData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Database error updating preferences:', result.error);
      return NextResponse.json(
        { success: false, error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: preferences,
      message: existingPrefs ? 'Preferences updated successfully' : 'Preferences created successfully'
    });

  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/preferences - Reset user preferences to defaults
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const supabase = createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Delete user preferences
    const { error: deleteError } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database error deleting preferences:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to reset preferences' },
        { status: 500 }
      );
    }

    const defaultPreferences: UserPreferences = {
      emailClassificationEnabled: true,
      autoUnsubscribeEnabled: false,
      priorityCategories: ['work', 'financial', 'opportunity'],
      workingHours: {
        start: '09:00',
        end: '17:00',
        days: [1, 2, 3, 4, 5]
      },
      notificationSettings: {
        urgentEmails: true,
        upcomingEvents: true,
        missedOpportunities: true
      }
    };

    return NextResponse.json({
      success: true,
      data: defaultPreferences,
      message: 'Preferences reset to defaults successfully'
    });

  } catch (error) {
    console.error('Error resetting user preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}