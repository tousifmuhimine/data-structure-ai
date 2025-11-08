import requests
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from supabase import create_client, Client
from core.config import SUPABASE_URL, SUPABASE_KEY, BRAVE_API_KEY
from typing import Optional
import json
import hashlib

# Create Supabase client for tools
tools_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Groq for diagram explanations
try:
    groq_llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0)
    
    diagram_prompt_template = """You are an expert in Mermaid.js syntax. Convert the user's request into valid Mermaid.js code.
- For flowcharts: use graph TD
- For data structures (trees, lists): use graph TD  
- For ER diagrams: use erDiagram

Do NOT include explanations or markdown backticks. Only output the Mermaid code.

User request: "{query}"

Mermaid.js code:"""
    
    explanation_prompt_template = """You are a data structures and algorithms expert. Provide a clear, concise explanation of this diagram.

Diagram request: "{query}"
Mermaid code:
{mermaid_code}

Provide a brief explanation (2-3 sentences) of what this diagram represents:"""
    
    diagram_prompt = ChatPromptTemplate.from_template(diagram_prompt_template)
    explanation_prompt = ChatPromptTemplate.from_template(explanation_prompt_template)
    
    diagram_chain = diagram_prompt | groq_llm
    explanation_chain = explanation_prompt | groq_llm
    
except Exception as e:
    print(f"Warning: Could not initialize Groq: {e}")
    diagram_chain = None
    explanation_chain = None

def generate_cache_key(query: str) -> str:
    """Generate a consistent cache key from query."""
    return hashlib.md5(query.lower().strip().encode()).hexdigest()

@tool
def web_search(topic: str) -> str:
    """Performs web search and caches the result."""
    print(f"---TOOL: Web search for '{topic}'---")
    
    if not BRAVE_API_KEY:
        return "Web search unavailable - API key not configured."
    
    # Check cache first
    cache_key = generate_cache_key(f"web_search:{topic}")
    try:
        cached = tools_supabase.table('knowledge_cache').select('answer').eq('cache_key', cache_key).execute()
        if cached.data and len(cached.data) > 0:
            print(f"✓ Cache hit for web search: {topic}")
            return cached.data[0]['answer']
    except Exception as e:
        print(f"Cache check error: {e}")
    
    # Perform web search
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {"X-Subscription-Token": BRAVE_API_KEY, "Accept": "application/json"}
    params = {"q": topic, "count": 3}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        results = response.json().get('web', {}).get('results', [])
        
        if not results:
            return "No web search results found."
        
        snippets = []
        for res in results:
            title = res.get('title', 'No title')
            description = res.get('description', 'No description')
            snippets.append(f"**{title}**\n{description}")
        
        answer = "\n\n".join(snippets)
        
        # Cache the result
        try:
            tools_supabase.table('knowledge_cache').insert({
                "cache_key": cache_key,
                "question": topic,
                "answer": answer,
                "source": "web_search"
            }).execute()
            print(f"✓ Cached web search result for: {topic}")
        except Exception as e:
            print(f"Cache save error: {e}")
        
        return answer
        
    except requests.exceptions.Timeout:
        return "Web search timed out. Please try again."
    except Exception as e:
        return f"Error during web search: {e}"

@tool
def generate_diagram(query: str) -> str:
    """Generates Mermaid diagram with Groq explanation and caches both together."""
    print(f"---TOOL: Generating diagram for '{query}'---")
    
    if diagram_chain is None or explanation_chain is None:
        return "Diagram generation unavailable - Groq not configured."
    
    # Check cache first
    cache_key = generate_cache_key(f"diagram:{query}")
    try:
        cached = tools_supabase.table('knowledge_cache').select('answer').eq('cache_key', cache_key).execute()
        if cached.data and len(cached.data) > 0:
            print(f"✓ Cache hit for diagram: {query}")
            return cached.data[0]['answer']
    except Exception as e:
        print(f"Cache check error: {e}")
    
    try:
        # Generate Mermaid code
        mermaid_response = diagram_chain.invoke({"query": query})
        mermaid_code = mermaid_response.content.strip()
        
        # Generate explanation
        explanation_response = explanation_chain.invoke({
            "query": query,
            "mermaid_code": mermaid_code
        })
        explanation = explanation_response.content.strip()
        
        # Combine diagram and explanation
        result = f"{explanation}\n\n%%MERMAID%%\n{mermaid_code}\n%%/MERMAID%%"
        
        # Cache the complete result
        try:
            tools_supabase.table('knowledge_cache').insert({
                "cache_key": cache_key,
                "question": query,
                "answer": result,
                "source": "diagram_generation"
            }).execute()
            print(f"✓ Cached diagram + explanation for: {query}")
        except Exception as e:
            print(f"Cache save error: {e}")
        
        return result
        
    except Exception as e:
        print(f"Error in generate_diagram: {e}")
        return f"Error generating diagram: {e}"

@tool
def query_supabase(concept: str) -> str:
    """Queries Supabase knowledge base for DSA concepts (fallback only)."""
    print(f"---TOOL: Querying knowledge base for '{concept}'---")
    
    try:
        response = tools_supabase.table('concepts').select('explanation').ilike('title', f'%{concept}%').execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]['explanation']
        
        return f"No information found for '{concept}' in knowledge base."
    except Exception as e:
        print(f"Error in query_supabase: {e}")
        return f"Error querying knowledge base: {e}"

__all__ = ['web_search', 'generate_diagram', 'query_supabase']