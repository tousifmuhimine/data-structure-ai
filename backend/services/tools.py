import requests
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from supabase import create_client, Client
from ..core.config import SUPABASE_URL, SUPABASE_KEY, BRAVE_API_KEY

# Create a dedicated Supabase client for tools (no auth required for public data)
tools_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Tool Definitions ---

@tool
def query_supabase(concept: str) -> str:
    """Queries the Supabase knowledge base for a specific data structure or algorithm concept."""
    print(f"---TOOL: Querying Supabase for '{concept}'---")
    try:
        response = tools_supabase.table('concepts').select('explanation').ilike('title', f'%{concept}%').execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]['explanation']
        
        return f"Sorry, I couldn't find a definition for '{concept}'."
        
    except Exception as e:
        print(f"Error in query_supabase: {e}")
        return f"Error connecting to knowledge base: {e}"

@tool
def web_search(topic: str) -> str:
    """Performs a web search for real-time information on a topic."""
    print(f"---TOOL: Searching web for '{topic}'---")
    
    if not BRAVE_API_KEY:
        return "Web search is not available - API key not configured."
    
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
            snippets.append(f"Title: {title}\nSnippet: {description}")
            
        return "\n\n".join(snippets)
        
    except requests.exceptions.Timeout:
        return "Web search timed out. Please try again."
    except requests.exceptions.RequestException as e:
        return f"Error during web search: {e}"
    except Exception as e:
        print(f"Unexpected error in web_search: {e}")
        return f"Unexpected error during web search: {e}"

# --- Groq-powered Diagram Generation Logic ---
try:
    diagram_llm = ChatGroq(model_name="llama3-8b-8192")
    diagram_prompt_template = """You are an expert in Mermaid.js syntax. Your sole purpose is to convert a user's natural language description into valid, clean Mermaid.js code.

- For flowcharts of algorithms, use `graph TD`.
- For visualizing data structures like trees or linked lists, use `graph TD`.
- For Entity-Relationship diagrams, use `erDiagram`.

Do NOT include any explanations, apologies, or any text other than the Mermaid code itself. Do not wrap the code in markdown backticks (```).

User request: "{query}"

Mermaid.js code:"""
    
    diagram_prompt = ChatPromptTemplate.from_template(diagram_prompt_template)
    diagram_chain = diagram_prompt | diagram_llm
    
except Exception as e:
    print(f"Warning: Could not initialize Groq diagram generation: {e}")
    diagram_chain = None

@tool
def generate_diagram(query: str) -> str:
    """Generates Mermaid.js code for a flowchart or data structure visualization."""
    print(f"---TOOL: Generating diagram for '{query}' with Groq---")
    
    if diagram_chain is None:
        return "Diagram generation is not available - Groq LLM not configured properly."
    
    try:
        response = diagram_chain.invoke({"query": query})
        mermaid_code = response.content
        
        # Clean up the response in case there are extra characters
        mermaid_code = mermaid_code.strip()
        
        return f"Here is the diagram you requested:\n%%MERMAID%%\n{mermaid_code}\n%%/MERMAID%%"
        
    except Exception as e:
        print(f"Error in generate_diagram: {e}")
        return f"Error generating diagram: {e}"