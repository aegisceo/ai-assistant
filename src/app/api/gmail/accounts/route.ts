/**
 * Gmail Accounts Management API
 * GET /api/gmail/accounts - List connected Gmail accounts
 * POST /api/gmail/accounts - Add new Gmail account
 * DELETE /api/gmail/accounts - Remove Gmail account
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest): Promise<NextResponse> {
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

    // Get all Gmail accounts for this user
    const { data: accounts, error } = await supabase
      .from('gmail_tokens')
      .select('account_email, account_label, is_primary, created_at, updated_at')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch Gmail accounts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        accounts: accounts || [],
        total: accounts?.length || 0,
      },
    });

  } catch (error) {
    console.error('Gmail accounts list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Gmail accounts' },
      { status: 500 }
    );
  }
}

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

    const { account_label } = await request.json();

    if (!account_label) {
      return NextResponse.json(
        { success: false, error: 'Account label is required' },
        { status: 400 }
      );
    }

    // For now, return a placeholder OAuth URL
    // TODO: Implement additional account OAuth flow
    const authUrlResult = {
      success: true,
      data: 'https://accounts.google.com/oauth/v2/auth?placeholder=true',
    };

    if (!authUrlResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate OAuth URL for additional account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        authUrl: authUrlResult.data,
        message: 'Additional account OAuth flow initiated',
      },
    });

  } catch (error) {
    console.error('Add Gmail account error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add Gmail account' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

    const { account_email } = await request.json();

    if (!account_email) {
      return NextResponse.json(
        { success: false, error: 'Account email is required' },
        { status: 400 }
      );
    }

    // Check if this account exists
    const { data: account } = await supabase
      .from('gmail_tokens')
      .select('is_primary, account_label')
      .eq('user_id', user.id)
      .eq('account_email', account_email)
      .single();

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Gmail account not found' },
        { status: 404 }
      );
    }

    // Remove the account
    const { error: deleteError } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('account_email', account_email);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove Gmail account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Gmail account ${account_email} removed successfully`,
        was_primary: (account as any).is_primary,
      },
    });

  } catch (error) {
    console.error('Remove Gmail account error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove Gmail account' },
      { status: 500 }
    );
  }
}