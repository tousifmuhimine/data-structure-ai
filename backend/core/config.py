import os
from dotenv import load_dotenv
from pathlib import Path

# --- THIS IS THE FIX ---
# We build a path to the .env file that is located in the parent directory
# of this file's directory (i.e., in the 'backend' folder).
# This ensures the .env file is found, regardless of where the script is run from.
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
# --- END FIX ---

def get_env_variable(var_name: str) -> str:
    """Gets an environment variable or raises an error if it's not found."""
    value = os.getenv(var_name)
    if not value:
        # Added the path to the error message for easier debugging in the future
        raise ValueError(f"{var_name} is not set in the environment. Please check your .env file at {env_path}")
    return value

# API Keys
GOOGLE_API_KEY = get_env_variable("GOOGLE_API_KEY")
GROQ_API_KEY = get_env_variable("GROQ_API_KEY")
BRAVE_API_KEY = get_env_variable("BRAVE_API_KEY")
SUPABASE_URL = get_env_variable("SUPABASE_URL")
SUPABASE_KEY = get_env_variable("SUPABASE_KEY")

# Set environment variables for LangChain modules
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
os.environ["GROQ_API_KEY"] = GROQ_API_KEY