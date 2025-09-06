from pydantic import BaseModel
from typing import List

class HistoryMessage(BaseModel):
    # THIS IS THE FIX: Changed 'type' to 'role' to match the frontend
    role: str 
    text: str

class ChatRequest(BaseModel):
    messages: List[HistoryMessage]

