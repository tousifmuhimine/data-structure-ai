import json
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage
from ..schemas.chat import ChatRequest, HistoryMessage
from ..schemas.session import Session
from ..core.dependencies import get_current_user_and_client
from ..services.agent import app_graph, AgentState
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter()

@router.post("/sessions", response_model=Session)
async def create_chat_session(request: Request):
    """Creates a new, empty chat session for the current user."""
    try:
        # Get user-specific client and user ID
        supabase_user_client, user_id = await get_current_user_and_client(request)
        
        new_title = f"New Chat - {datetime.now().strftime('%b %d, %H:%M')}"
        
        print(f"Creating session with user_id: {user_id}, title: {new_title}")
        
        # FIXED: Use older Supabase syntax
        response = supabase_user_client.table('chat_sessions').insert({
            "user_id": user_id,
            "title": new_title
        }).execute()
        
        print(f"Insert response: {response}")
        
        if response.data and len(response.data) > 0:
            session_data = response.data[0]
            print(f"Session created successfully: {session_data}")
            return session_data
        
        # If no data returned, try to fetch the created session
        print("No data in insert response, trying to fetch latest session...")
        fetch_response = supabase_user_client.table('chat_sessions').select("*").eq('user_id', user_id).order('created_at', desc=True).limit(1).execute()
        
        if fetch_response.data and len(fetch_response.data) > 0:
            return fetch_response.data[0]
        
        raise HTTPException(status_code=500, detail="Database failed to return new session.")

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        print(f"--- ERROR CREATING SESSION: {e} ---")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=List[Session])
async def get_chat_sessions(request: Request):
    """Gets all chat sessions for the current user."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        
        print(f"Fetching sessions for user: {user_id}")
        
        response = supabase_user_client.table('chat_sessions').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        
        print(f"Sessions query response: {response}")
        
        return response.data if response.data else []
    except HTTPException:
        raise
    except Exception as e:
        print(f"--- ERROR FETCHING SESSIONS: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages", response_model=List[HistoryMessage])
async def get_session_messages(session_id: UUID, request: Request):
    """Gets all messages for a specific chat session."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        session_id_str = str(session_id)

        print(f"Fetching messages for session {session_id_str}, user {user_id}")

        # Verify session belongs to user
        session_response = supabase_user_client.table('chat_sessions').select('id').eq('id', session_id_str).eq('user_id', user_id).execute()
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found or access denied")

        messages_response = supabase_user_client.table('chat_messages').select('role, content').eq('session_id', session_id_str).order('created_at', desc=False).execute()
        
        messages = [{"role": msg['role'], "text": msg['content']} for msg in messages_response.data] if messages_response.data else []
        print(f"Fetched {len(messages)} messages")
        
        return messages
    except HTTPException:
        raise
    except Exception as e:
        print(f"--- ERROR FETCHING MESSAGES: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_events(session_id: UUID, messages: List[HistoryMessage], supabase_user_client, user_id: str):
    """Generates server-sent events and saves the final response."""
    session_id_str = str(session_id)
    
    if messages and messages[-1].role == 'user':
        user_message_content = messages[-1].text
        supabase_user_client.table('chat_messages').insert({
            "session_id": session_id_str, "user_id": user_id,
            "role": "user", "content": user_message_content
        }).execute()
    
    history = [HumanMessage(content=msg.text) if msg.role == 'user' else AIMessage(content=msg.text) for msg in messages]
    inputs: AgentState = {"messages": history}
    final_answer = ""
    
    async for event in app_graph.astream(inputs, stream_mode="values"):
        last_message = event["messages"][-1]
        # ADD THIS DEBUG LINE:
        print(f"DEBUG: Message content: {repr(last_message.content)}")
        
        if isinstance(last_message, AIMessage):
            if isinstance(last_message.content, str) and "<thinking>" in last_message.content:
                thinking_match = re.search(r"<thinking>(.*?)</thinking>", last_message.content, re.DOTALL)
                if thinking_match:
                    thinking_text = thinking_match.group(1).strip()
                    for step in thinking_text.split('\n'):
                        if step.strip():
                            yield f"data: {json.dumps({'type': 'thinking', 'content': f'🤔 {step.strip()}'})}\n\n"

            if last_message.tool_calls:
                tool_call = last_message.tool_calls[0]
                tool_name, tool_args = tool_call['name'], tool_call['args']
                executing_message = f"⚙️ Executing: {tool_name} with query '{tool_args.get('query') or tool_args.get('concept') or tool_args.get('topic')}'..."
                yield f"data: {json.dumps({'type': 'thinking', 'content': executing_message})}\n\n"
            
            final_content = ""
            if isinstance(last_message.content, str):
                final_content = re.sub(r"<thinking>.*?</thinking>", "", last_message.content, flags=re.DOTALL).strip()
            
            if final_content and not last_message.tool_calls:
                final_answer = final_content
                yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"

    if final_answer:
        supabase_user_client.table('chat_messages').insert({
            "session_id": session_id_str, "user_id": user_id,
            "role": "ai", "content": final_answer
        }).execute()

@router.post("/chat/{session_id}")
async def invoke_agent_streaming(session_id: UUID, request: Request, chat_request: ChatRequest):
    """Handles the streaming chat for a specific session. Requires authentication."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        print(f"Authenticated request for user: {user_id} in session: {session_id}")
        
        return StreamingResponse(
            generate_events(session_id, chat_request.messages, supabase_user_client, user_id), 
            media_type="text/event-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"--- ERROR IN STREAMING CHAT: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))