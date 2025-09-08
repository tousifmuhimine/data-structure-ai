import requests
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from supabase import create_client, Client
from core.config import SUPABASE_URL, SUPABASE_KEY, BRAVE_API_KEY
from typing import List, Dict, Optional
import json
from sentence_transformers import SentenceTransformer
import numpy as np

# Create a dedicated Supabase client for tools (no auth required for public data)
tools_supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize embedding model for knowledge cache (lazy loading)
_embedding_model = None

def get_embedding_model():
    """Lazy load the embedding model to avoid startup delays."""
    global _embedding_model
    if _embedding_model is None:
        try:
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("Embedding model loaded successfully")
        except Exception as e:
            print(f"Warning: Could not load embedding model: {e}")
            _embedding_model = False
    return _embedding_model if _embedding_model != False else None

# --- EXISTING TOOLS (PRESERVED EXACTLY AS THEY WERE) ---

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

# --- Groq-powered Diagram Generation Logic (PRESERVED) ---
try:
    diagram_llm = ChatGroq(model_name="llama-3.1-70b-versatile", temperature=0)
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

# --- NEW SELF-LEARNING TOOLS ---

def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate embedding for a text string."""
    model = get_embedding_model()
    if model is None:
        return None
    
    try:
        embedding = model.encode(text, convert_to_tensor=False)
        return embedding.tolist()
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    try:
        a_np = np.array(a)
        b_np = np.array(b)
        return np.dot(a_np, b_np) / (np.linalg.norm(a_np) * np.linalg.norm(b_np))
    except:
        return 0.0

@tool
def query_knowledge_cache(question: str, threshold: float = 0.7) -> str:
    """Queries the AI's self-learning memory for similar past interactions using vector similarity."""
    print(f"---TOOL: Querying knowledge cache for '{question}'---")
    
    # Generate embedding for the question
    query_embedding = generate_embedding(question)
    if query_embedding is None:
        return "Knowledge cache search unavailable - embedding model not loaded."
    
    try:
        # Get all cached knowledge entries
        response = tools_supabase.table('knowledge_cache').select('question, answer, embedding').execute()
        
        if not response.data:
            return "No cached knowledge found."
        
        best_match = None
        best_similarity = 0.0
        
        # Find the most similar cached interaction
        for entry in response.data:
            if entry.get('embedding'):
                try:
                    cached_embedding = json.loads(entry['embedding']) if isinstance(entry['embedding'], str) else entry['embedding']
                    similarity = cosine_similarity(query_embedding, cached_embedding)
                    
                    if similarity > best_similarity and similarity >= threshold:
                        best_similarity = similarity
                        best_match = entry
                except Exception as e:
                    print(f"Error processing cached embedding: {e}")
                    continue
        
        if best_match:
            return f"Found similar interaction (similarity: {best_similarity:.2f}):\n\nQ: {best_match['question']}\nA: {best_match['answer']}"
        
        return f"No sufficiently similar interactions found in cache (threshold: {threshold})."
        
    except Exception as e:
        print(f"Error in query_knowledge_cache: {e}")
        return f"Error querying knowledge cache: {e}"

@tool
def smart_knowledge_search(concept: str) -> str:
    """Intelligently searches both the knowledge cache (memory) and concepts table (textbook) for information."""
    print(f"---TOOL: Smart knowledge search for '{concept}'---")
    
    # First, check the self-learning memory
    cache_result = query_knowledge_cache(concept, threshold=0.6)
    
    # Then, check the textbook
    textbook_result = query_supabase(concept)
    
    # Combine results intelligently
    results = []
    
    if cache_result and "No cached knowledge found" not in cache_result and "No sufficiently similar" not in cache_result:
        results.append(f"From AI Memory:\n{cache_result}")
    
    if textbook_result and "Sorry, I couldn't find" not in textbook_result:
        results.append(f"From Knowledge Base:\n{textbook_result}")
    
    if results:
        return "\n\n---\n\n".join(results)
    else:
        return f"No information found for '{concept}' in either memory or knowledge base."

# --- LEARNING FUNCTIONS (NOT TOOLS - INTERNAL FUNCTIONS) ---

def extract_valuable_qa(question: str, answer: str) -> bool:
    """Determine if a Q&A pair is valuable enough to cache."""
    # Simple heuristics - you can enhance these
    if len(answer.strip()) < 50:  # Too short
        return False
    if "error" in answer.lower() or "sorry" in answer.lower():  # Error responses
        return False
    if len(question.strip()) < 10:  # Too vague
        return False
    
    # Add more sophisticated filtering logic here
    return True

def cache_knowledge(question: str, answer: str, session_id: str = None, user_id: str = None) -> bool:
    """Cache a valuable Q&A interaction in the knowledge cache."""
    if not extract_valuable_qa(question, answer):
        return False
    
    try:
        # Generate embedding for the question
        embedding = generate_embedding(question)
        if embedding is None:
            print("Could not generate embedding for caching")
            return False
        
        # Store in knowledge cache
        data = {
            "question": question,
            "answer": answer,
            "embedding": json.dumps(embedding)  # Store as JSON string
        }
        
        response = tools_supabase.table('knowledge_cache').insert(data).execute()
        
        if response.data:
            print(f"Successfully cached knowledge: {question[:50]}...")
            return True
        
        return False
        
    except Exception as e:
        print(f"Error caching knowledge: {e}")
        return False

# Export the new tools alongside existing ones
__all__ = [
    # Existing tools
    'query_supabase', 
    'web_search', 
    'generate_diagram',
    # New self-learning tools
    'query_knowledge_cache',
    'smart_knowledge_search',
    # Utility functions
    'cache_knowledge'
]