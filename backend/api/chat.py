import json
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage
from schemas.chat import ChatRequest, HistoryMessage
from schemas.session import Session
from core.dependencies import get_current_user_and_client
from services.agent import astream_with_learning_context
from typing import List
from uuid import UUID
from datetime import datetime

router = APIRouter()

@router.post("/sessions", response_model=Session)
async def create_chat_session(request: Request):
    """Creates a new, empty chat session for the current user."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        new_title = f"New Chat - {datetime.now().strftime('%b %d, %H:%M')}"
        
        response = supabase_user_client.table('chat_sessions').insert({
            "user_id": user_id,
            "title": new_title
        }).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        
        fetch_response = supabase_user_client.table('chat_sessions').select("*").eq('user_id', user_id).order('created_at', desc=True).limit(1).execute()
        if fetch_response.data and len(fetch_response.data) > 0:
            return fetch_response.data[0]
        
        raise HTTPException(status_code=500, detail="Database failed to return new session.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR CREATING SESSION: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=List[Session])
async def get_chat_sessions(request: Request):
    """Gets all chat sessions for the current user."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        response = supabase_user_client.table('chat_sessions').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"ERROR FETCHING SESSIONS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: UUID, request: Request):
    """Deletes a chat session and all its messages."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        session_id_str = str(session_id)
        
        session_response = supabase_user_client.table('chat_sessions').select('id').eq('id', session_id_str).eq('user_id', user_id).execute()
        
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        supabase_user_client.table('chat_messages').delete().eq('session_id', session_id_str).execute()
        supabase_user_client.table('chat_sessions').delete().eq('id', session_id_str).execute()
        
        return {"message": "Session deleted successfully", "session_id": session_id_str}
    except Exception as e:
        print(f"ERROR DELETING SESSION: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages", response_model=List[HistoryMessage])
async def get_session_messages(session_id: UUID, request: Request):
    """Gets all messages for a specific chat session."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        session_id_str = str(session_id)
        
        session_response = supabase_user_client.table('chat_sessions').select('id').eq('id', session_id_str).eq('user_id', user_id).execute()
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages_response = supabase_user_client.table('chat_messages').select('role, content, thinking_process').eq('session_id', session_id_str).order('created_at', desc=False).execute()
        
        messages = []
        for msg in messages_response.data if messages_response.data else []:
            message_dict = {
                "role": msg['role'],
                "text": msg['content']
            }
            # Include thinking process if it exists
            if msg.get('thinking_process'):
                message_dict["thinkingProcess"] = msg['thinking_process'] if isinstance(msg['thinking_process'], list) else json.loads(msg['thinking_process'])
            messages.append(message_dict)
        
        return messages
    except Exception as e:
        print(f"ERROR FETCHING MESSAGES: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_events(session_id: UUID, messages: List[HistoryMessage], supabase_user_client, user_id: str):
    """Generates server-sent events with thinking process and saves responses."""
    session_id_str = str(session_id)
    thinking_steps = []
    
    # Save user message
    if messages and messages[-1].role == 'user':
        user_message_content = messages[-1].text
        supabase_user_client.table('chat_messages').insert({
            "session_id": session_id_str,
            "user_id": user_id,
            "role": "user",
            "content": user_message_content
        }).execute()
        
        # Update session title with first message if it's still "New Chat"
        try:
            session_data = supabase_user_client.table('chat_sessions').select('title').eq('id', session_id_str).single().execute()
            if session_data.data and 'New Chat' in session_data.data.get('title', ''):
                # Generate title from first message (first 50 chars)
                new_title = user_message_content[:50] + ('...' if len(user_message_content) > 50 else '')
                supabase_user_client.table('chat_sessions').update({
                    'title': new_title
                }).eq('id', session_id_str).execute()
        except Exception as e:
            print(f"Error updating session title: {e}")
    
    # Convert to LangChain messages
    history = [
        HumanMessage(content=msg.text) if msg.role == 'user' else AIMessage(content=msg.text)
        for msg in messages
    ]
    
    final_answer = ""
    
    async for event in astream_with_learning_context(history, session_id_str, user_id):
        last_message = event["messages"][-1]
        
        if isinstance(last_message, AIMessage):
            # Extract and send thinking process
            if isinstance(last_message.content, str) and "<thinking>" in last_message.content:
                thinking_match = re.search(r"<thinking>(.*?)</thinking>", last_message.content, re.DOTALL)
                if thinking_match:
                    thinking_text = thinking_match.group(1).strip()
                    for step in thinking_text.split('\n'):
                        if step.strip():
                            clean_step = step.strip()
                            thinking_steps.append(clean_step)
                            yield f"data: {json.dumps({'type': 'thinking', 'content': clean_step})}\n\n"
            
            # Handle tool calls
            if last_message.tool_calls:
                tool_call = last_message.tool_calls[0]
                tool_name = tool_call['name']
                tool_args = tool_call['args']
                
                executing_message = f"⚙️ Using {tool_name}..."
                thinking_steps.append(executing_message)
                yield f"data: {json.dumps({'type': 'thinking', 'content': executing_message})}\n\n"
            
            # Extract final answer (without thinking tags)
            if isinstance(last_message.content, str):
                final_content = re.sub(r"<thinking>.*?</thinking>", "", last_message.content, flags=re.DOTALL).strip()
                
                if final_content and not last_message.tool_calls:
                    final_answer = final_content
                    yield f"data: {json.dumps({'type': 'final_answer', 'content': final_answer})}\n\n"
    
    # Save AI response
    if final_answer:
        supabase_user_client.table('chat_messages').insert({
            "session_id": session_id_str,
            "user_id": user_id,
            "role": "ai",
            "content": final_answer
        }).execute()

@router.post("/chat/{session_id}")
async def invoke_agent_streaming(session_id: UUID, request: Request, chat_request: ChatRequest):
    """Handles streaming chat with thinking process display."""
    try:
        supabase_user_client, user_id = await get_current_user_and_client(request)
        return StreamingResponse(
            generate_events(session_id, chat_request.messages, supabase_user_client, user_id),
            media_type="text/event-stream"
        )
    except Exception as e:
        print(f"ERROR IN STREAMING CHAT: {e}")
        raise HTTPException(status_code=500, detail=str(e))