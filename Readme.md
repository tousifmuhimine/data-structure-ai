# Data-Structure AI
Interactive multi-agent AI assistant for learning data structures and algorithms (DSA). Ask questions, get explanations, and see real-time visual diagrams.

## Features
- Conversational AI Tutor for DSA questions
- Multi-Agent System: Supervisor LLM (Gemini) delegates to specialized agents
- Dynamic Diagram Generation: Mermaid.js diagrams via Groq Llama 3
- Persistent Chat History: Context-aware conversations
- Secure User Authentication via Supabase Auth

## Tech Stack
**Backend:** Python, FastAPI, LangGraph, LangChain  
**Frontend:** Next.js, React, TypeScript, Tailwind CSS  
**Database/Auth:** Supabase (PostgreSQL + Auth)  
**LLMs:** Google Gemini (Supervisor), Groq Llama 3 (Specialist)  
**External APIs:** Brave Search API

## Demo
![Demo GIF / Screenshot](link-to-image-or-gif)

## Setup
1. Clone repository
2. Backend: Create virtual environment → install packages → add .env keys → run uvicorn
3. Frontend: Install packages → add .env.local keys → run `npm run dev`

App runs at http://localhost:3000
