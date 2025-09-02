import { NextRequest, NextResponse } from 'next/server';
import { GmailClient, createGmailAuthService } from '@/integrations/gmail';

/**
 * Gmail OAuth Callback Endpoint
 * GET /api/gmail/callback?code=...&scope=...&state=...
 * 
 * Handles the OAuth callback from Google and stores tokens
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle OAuth errors
  if (error) {
    console.error('Gmail OAuth error:', error);
    const errorMessage = error === 'access_denied' 
      ? 'Gmail access was denied' 
      : 'Gmail authentication failed';
    
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/?error=Missing authorization code`, request.url));
  }

  if (!state) {
    console.error('Missing state parameter in OAuth callback');
    return NextResponse.redirect(new URL(`/?error=Invalid OAuth request`, request.url));
  }

  try {
    // Use server-side Supabase client to get user from cookies
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User auth error in callback:', userError);
      return NextResponse.redirect(new URL(`/?error=Please log in to connect Gmail`, request.url));
    }

    // Validate state parameter for CSRF protection
    const { data: stateRecord, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .gte('expires_at', new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error('Invalid or expired OAuth state:', stateError);
      // Clean up the state record if it exists
      await supabase
        .from('oauth_states')
        .delete()
        .eq('state', state);
      return NextResponse.redirect(new URL(`/?error=Invalid or expired OAuth request`, request.url));
    }

    // Remove the used state parameter to prevent replay attacks
    await supabase
      .from('oauth_states')
      .delete()
      .eq('id', stateRecord.id);

    // Create Gmail client
    const gmailClient = new GmailClient({
      clientId: process.env['GOOGLE_CLIENT_ID']!,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET']!,
      redirectUri: `${request.nextUrl.origin}/api/gmail/callback`,
    });

    // Exchange code for tokens
    const tokenResult = await gmailClient.exchangeCodeForTokens(code);

    if (!tokenResult.success) {
      console.error('Token exchange failed:', tokenResult.error);
      return NextResponse.redirect(new URL(`/?error=Failed to obtain Gmail access tokens`, request.url));
    }

    // Store tokens securely
    const authService = createGmailAuthService();
    const storeResult = await authService.storeTokens(user.id, tokenResult.data);

    if (!storeResult.success) {
      console.error('Token storage failed:', storeResult.error);
      return NextResponse.redirect(new URL(`/?error=Failed to save Gmail credentials`, request.url));
    }

    // Success - redirect to dashboard or success page
    return NextResponse.redirect(new URL(`/?success=Gmail connected successfully`, request.url));

  } catch (error) {
    console.error('Gmail callback processing error:', error);
    return NextResponse.redirect(new URL(`/?error=Gmail connection failed`, request.url));
  }
}

/**
 * Handle OPTIONS request for CORS if needed
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? process.env['NEXTAUTH_URL'] || 'https://yourdomain.com'
        : 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}