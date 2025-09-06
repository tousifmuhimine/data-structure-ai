import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: NextRequest) {
try {
const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
const token = session.access_token;

const { message } = await req.json();

const backendUrl = 'http://127.0.0.1:8000/api/chat';

const backendResponse = await fetch(backendUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ message }),
});

if (!backendResponse.ok) {
  const errorText = await backendResponse.text();
  return new Response(`Error from backend: ${errorText}`, { status: backendResponse.status });
}

if (!backendResponse.body) {
  return new Response("The backend response does not contain a body.", { status: 500 });
}

const stream = new ReadableStream({
  async start(controller) {
    const reader = backendResponse.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
    } catch (error) {
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
  },
});

} catch (error) {
if (error instanceof Error) {
return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
return new Response(JSON.stringify({ error: 'An unknown error occurred' }), { status: 500 });
}
}