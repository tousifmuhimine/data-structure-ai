import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = 'http://127.0.0.1:8000/api/sessions';

// DELETE: Deletes a specific chat session for the logged-in user
export async function DELETE(
  req: NextRequest, 
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createClient();
    
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const deleteUrl = `${BACKEND_URL}/${params.sessionId}`;
    
    console.log('Deleting session at backend:', deleteUrl);

    const backendResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Backend response status:', backendResponse.status);
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      return new Response(JSON.stringify({ error: 'Backend request failed', details: errorText }), { 
        status: backendResponse.status 
      });
    }
    
    const data = await backendResponse.json();
    console.log('Session deleted:', data);
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('DELETE session error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}