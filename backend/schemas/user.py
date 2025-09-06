from pydantic import BaseModel, EmailStr

class UserCredentials(BaseModel):
    email: EmailStr
    password: str

class SignUpCredentials(UserCredentials):
    full_name: str
