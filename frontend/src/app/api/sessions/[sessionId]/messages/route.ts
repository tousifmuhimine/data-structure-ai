import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL + '/api/chat';

interface Params {
  sessionId: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Params }
) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', context.params.sessionId)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
        status: 500,
      });
    }

    const formattedMessages =
      messages?.map((msg) => ({
        role: msg.role,
        text: msg.content,
      })) || [];

    return new Response(JSON.stringify(formattedMessages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GET messages error:', error);
    return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
      status: 500,
    });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Params }
) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const { messages } = await req.json();

    const backendResponse = await fetch(`${BACKEND_URL}/${context.params.sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error:', errorText);
      return new Response(`Error from backend: ${errorText}`, { status: backendResponse.status });
    }

    if (!backendResponse.body) {
      return new Response('The backend response does not contain a body.', { status: 500 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = backendResponse.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
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
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('POST streaming error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unknown error' }), {
      status: 500,
    });
  }
}
