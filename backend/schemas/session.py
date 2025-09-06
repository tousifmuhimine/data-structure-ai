from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class Session(BaseModel):
    id: UUID
    user_id: UUID
    created_at: datetime
    title: str

    class Config:
        from_attributes = True
