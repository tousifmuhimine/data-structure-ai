import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = 'http://127.0.0.1:8000/api/sessions';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: Fetches all chat sessions for the logged-in user
export async function GET(_req: NextRequest) {
  try {
    console.log('=== GET /api/sessions START ===');
    const supabase = await createClient();
    console.log('✓ Supabase client created');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      error: sessionError?.message
    });
    
    if (!session) {
      console.log('❌ No session found - returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('→ Fetching sessions from backend:', BACKEND_URL);
    const backendResponse = await fetch(BACKEND_URL, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    console.log('← Backend response status:', backendResponse.status);
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('❌ Backend error:', errorText);
      return NextResponse.json({ error: 'Backend request failed', details: errorText }, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    console.log('✓ Sessions fetched:', Array.isArray(data) ? `${data.length} sessions` : data);
    console.log('=== GET /api/sessions END ===\n');
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ GET /api/sessions error:', error);
    return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
  }
}

// POST: Creates a new chat session for the logged-in user
export async function POST(_req: NextRequest) {
  try {
    console.log('=== POST /api/sessions START ===');
    const supabase = await createClient();
    console.log('✓ Supabase client created');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      error: sessionError?.message
    });
    
    if (!session) {
      console.log('❌ No session found - returning 401');
      return NextResponse.json({ error: 'Unauthorized', details: 'No active session found' }, { status: 401 });
    }

    console.log('→ Creating session at backend:', BACKEND_URL);
    console.log('→ Using token:', session.access_token.substring(0, 20) + '...');
    
    const backendResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('← Backend response status:', backendResponse.status);
    console.log('← Backend response ok:', backendResponse.ok);
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('❌ Backend error response:', errorText);
      return NextResponse.json({ 
        error: 'Backend request failed', 
        details: errorText,
        status: backendResponse.status 
      }, { status: backendResponse.status });
    }
    
    const data = await backendResponse.json();
    console.log('✓ Session created successfully:', data);
    console.log('=== POST /api/sessions END ===\n');
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ POST /api/sessions error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Backend request timed out' }, { status: 504 });
    }
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: getErrorMessage(error) 
    }, { status: 500 });
  }
}