from fastapi import APIRouter, HTTPException
from supabase import AuthApiError
from ..schemas.user import SignUpCredentials, UserCredentials
# THIS IS THE FIX: We now import the correctly named 'supabase_anon' client
from ..core.dependencies import supabase_anon

router = APIRouter()

@router.post("/signup")
def signup(credentials: SignUpCredentials):
    try:
        # AND USE IT HERE
        res = supabase_anon.auth.sign_up({
            "email": credentials.email,
            "password": credentials.password,
            "options": {"data": {"full_name": credentials.full_name}}
        })
        if res.user and res.user.id:
            return {"message": "Sign up successful! Please check your email to confirm.", "user": res.user.id}
        elif res.user is None and res.session is None:
             raise HTTPException(status_code=400, detail="User already exists or sign up failed.")
        else:
             return {"message": "Sign up successful! Please check your email to confirm.", "user_id": res.user.id if res.user else None}
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
def login(credentials: UserCredentials):
    try:
        # AND USE IT HERE
        res = supabase_anon.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        return res
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=str(e))
