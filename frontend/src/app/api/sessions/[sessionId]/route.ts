import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/sessions';

// DELETE: Deletes a specific chat session for the logged-in user
export async function DELETE(
  _req: NextRequest, 
  { params }: { params: { sessionId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleteUrl = `${BACKEND_URL}/${params.sessionId}`;
    const backendResponse = await fetch(deleteUrl, {
      method: 'DELETE',
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
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
