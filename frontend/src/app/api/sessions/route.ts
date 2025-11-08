import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sessions';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// GET: Fetches all chat sessions for the logged-in user
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendResponse = await fetch(BACKEND_URL, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json({ error: 'Backend request failed', details: errorText }, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
  }
}

// POST: Creates a new chat session for the logged-in user
export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backendResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json({ error: 'Backend request failed', details: errorText }, { status: backendResponse.status });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Backend request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal server error', details: getErrorMessage(error) }, { status: 500 });
  }
}
