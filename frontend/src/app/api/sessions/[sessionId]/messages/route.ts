import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const BACKEND_URL = 'http://127.0.0.1:8000/api/chat'; // Fixed: added /api prefix back

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // ACTUALLY CORRECTED: Await cookies before using them
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    });
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    const { messages } = await req.json();

    console.log('Sending request to:', `${BACKEND_URL}/${params.sessionId}`);

    const backendResponse = await fetch(`${BACKEND_URL}/${params.sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messages }), // Pass the full message history
    });

    console.log('Backend response status:', backendResponse.status);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      return new Response(`Error from backend: ${errorText}`, { status: backendResponse.status });
    }

    if (!backendResponse.body) {
      return new Response("The backend response does not contain a body.", { status: 500 });
    }

    // Stream the response from backend to frontend
    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body!.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Optional: Log chunks for debugging
            const chunk = decoder.decode(value, { stream: true });
            console.log('Streaming chunk:', chunk.substring(0, 100) + '...');
            
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('POST streaming error:', error);
    if (error instanceof Error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 });
  }
}