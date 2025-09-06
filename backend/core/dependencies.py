from fastapi import Request, HTTPException
from supabase import create_client, Client
from gotrue.errors import AuthApiError
from .config import SUPABASE_URL, SUPABASE_KEY
from typing import Tuple

# This is the global, anonymous client, used only for initial auth checks
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def get_current_user_and_client(request: Request) -> Tuple[Client, str]:
    """
    Dependency to validate Supabase JWT, get the user ID, and return a
    Supabase client authenticated as that user.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
        
    try:
        # 1. Verify the token and get the user's data
        user_response = supabase_anon.auth.get_user(token)
        user_id = user_response.user.id
        
        # 2. Create a new, user-specific Supabase client for this request
        # This client will have the user's permissions for RLS.
        supabase_user_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        supabase_user_client.auth.set_session(access_token=token, refresh_token=token)
        
        return supabase_user_client, str(user_id)
        
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        print(f"--- UNEXPECTED AUTH ERROR: {e} ---")
        raise HTTPException(status_code=401, detail="Could not validate credentials")
