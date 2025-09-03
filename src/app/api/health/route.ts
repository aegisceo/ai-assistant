/**
 * Health Check API Route
 * Used by frontend to detect backend availability and exit demo mode
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected', // TODO: Add actual DB health check
        gmail: 'available',
        ai: 'available'
      }
    };

    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: 'Service unavailable' 
      },
      { status: 503 }
    );
  }
}

export async function HEAD() {
  // Support HEAD requests for quick health checks
  return new NextResponse(null, { status: 200 });
}