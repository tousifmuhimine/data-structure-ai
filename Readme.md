Data-Structure AIData-Structure AI is an intelligent, conversational assistant designed to be an expert tutor for data structures and algorithms (DSA). It leverages a multi-agent architecture to provide clear explanations, generate visual diagrams, and fetch real-time information, creating a comprehensive and interactive learning experience.The application features a persistent, user-specific chat history, allowing for follow-up questions and a continuous learning journey.🚀 FeaturesConversational AI Tutor: Ask complex questions about data structures and algorithms.Multi-Agent System: A supervisor LLM (Gemini) delegates tasks to specialized agents for knowledge retrieval, web searching, and diagram generation.Dynamic Diagram Generation: Uses a high-speed LLM (Groq) to generate Mermaid.js flowcharts and diagrams on the fly.Persistent Chat History: User-specific conversations are saved to the database, allowing users to pick up where they left off.User Authentication: Secure user sign-up and login powered by Supabase Auth.Modern Tech Stack: Built with FastAPI (Python) on the backend and Next.js (TypeScript) on the frontend.🛠️ Tech StackBackend: Python, FastAPI, LangGraph, LangChain, UvicornFrontend: Next.js, React, TypeScript, Tailwind CSSDatabase & Auth: Supabase (PostgreSQL + Auth)LLMs: Google Gemini (Supervisor), Groq Llama 3 (Specialist)External APIs: Brave Search API📋 Setup and InstallationPrerequisitesNode.js (v18 or later)Python (v3.11 or later)API keys for Google, Groq, Brave, and Supabase.1. Clone the Repositorygit clone <your-repository-url>
cd database-ai-project
2. Backend Setup# Navigate to the backend directory
cd backend

# Create a Python virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install the required packages
pip install -r requirements.txt

# Create the environment file
cp .env.example .env

# Add your secret API keys to the .env file
3. Frontend Setup# Navigate to the frontend directory
cd frontend

# Install the required packages
npm install

# Create the environment file
cp .env.local.example .env.local

# Add your public Supabase keys to the .env.local file
▶️ Running the ApplicationYou will need to run the backend and frontend servers in two separate terminals.1. Run the Backend ServerNavigate to the root project directory (database-ai-project/).Activate the virtual environment: .\backend\venv\Scripts\activateRun the server:uvicorn backend.main:app --reload
The backend will be running at http://127.0.0.1:8000.2. Run the Frontend ServerNavigate to the frontend directory.Run the development server:npm run dev
Open your browser and navigate to http://localhost:3000.