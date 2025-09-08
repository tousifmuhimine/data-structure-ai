from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import auth, chat 

app = FastAPI(title="Data-Structure AI Backend") # UPDATED NAME

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])

@app.get("/")
def read_root():
    """A simple endpoint to check if the server is running."""
    return {"status": "Data-Structure AI Backend is running!"}

