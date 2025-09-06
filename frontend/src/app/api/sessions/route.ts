import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const BACKEND_URL = 'http://127.0.0.1:8000/api/sessions'; // Fixed: added /api prefix back

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: Fetches all chat sessions for the logged-in user
export async function GET(req: NextRequest) {
  try {
    // FIXED: Await cookies before using them
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Fetching sessions from backend:', BACKEND_URL);
    
    const backendResponse = await fetch(BACKEND_URL, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    console.log('Backend response status:', backendResponse.status);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { error: 'Backend request failed', details: errorText }, 
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    console.log('Fetched', data?.length || 0, 'sessions');
    return NextResponse.json(data);

  } catch (error) {
    console.error('GET sessions error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred', details: getErrorMessage(error) }, 
      { status: 500 }
    );
  }
}

// POST: Creates a new chat session for the logged-in user
export async function POST(req: NextRequest) {
  try {
    // FIXED: Await cookies before using them
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Creating new session at backend:', BACKEND_URL);

    const backendResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Backend response status:', backendResponse.status);
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { error: 'Backend request failed', details: errorText }, 
        { status: backendResponse.status }
      );
    }
    
    const data = await backendResponse.json();
    console.log('Session created:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('POST session error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Backend request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'An internal server error occurred', details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}