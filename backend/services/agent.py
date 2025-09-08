from typing import TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
# UPDATED IMPORT: Now includes new self-learning tools
from .tools import (
    query_supabase, web_search, generate_diagram,  # Existing tools
    query_knowledge_cache, smart_knowledge_search,  # New self-learning tools
    cache_knowledge  # Learning function
)

# --- Agent State and Graph Definition ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    # NEW: Track current session for learning
    session_id: str = None
    user_id: str = None

# UPDATED: Now includes both original and new self-learning tools
tools = [
    # Original tools (preserved)
    query_supabase, 
    web_search, 
    generate_diagram,
    # New self-learning tools
    query_knowledge_cache,
    smart_knowledge_search
]
tool_node = ToolNode(tools)

# ENHANCED: The AI now mentions its learning capabilities alongside DSA expertise
system_prompt = SystemMessage(
    content="""You are an expert tutor for Data Structures and Algorithms (DSA) with self-learning capabilities. Your goal is to be as helpful as possible, explaining complex concepts clearly while continuously learning from interactions.

    CRITICAL: You MUST ALWAYS follow this exact format for EVERY response:

    <thinking>
    [Always explain your reasoning here, even for simple greetings or basic questions]
    - What is the user asking?
    - Do I have this information readily available?
    - Should I check my memory first (knowledge_cache) for similar past interactions?
    - Do I need to use tools? Available tools:
      * smart_knowledge_search: Combines both my memory and textbook knowledge
      * query_knowledge_cache: Searches my memory of past interactions  
      * query_supabase: Searches the structured knowledge base (textbook)
      * web_search: For current information not in my knowledge base
      * generate_diagram: Creates visual representations
    - What's the best approach to help them?
    </thinking>

    [Your actual response here]

    LEARNING STRATEGY:
    - For DSA questions, prefer smart_knowledge_search (combines memory + textbook)
    - Use query_knowledge_cache when looking for similar past problem-solving approaches
    - Use traditional query_supabase only when you need specific structured knowledge
    - Always aim to provide comprehensive, educational responses that I can learn from

    After you have laid out your plan in thinking tags, execute it by choosing the most appropriate tool(s). If no tool is needed, provide a direct answer after your thinking block."""
)
supervisor_prompt = ChatPromptTemplate.from_messages([system_prompt, ("placeholder", "{messages}")])
supervisor_llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
supervisor_llm_with_tools = supervisor_llm.bind_tools(tools)
supervisor_chain = supervisor_prompt | supervisor_llm_with_tools

def supervisor_node(state: AgentState) -> dict:
    """The primary node that decides what to do."""
    print("---SUPERVISOR---")
    response = supervisor_chain.invoke({"messages": state["messages"]})
    return {"messages": [response]}

# ENHANCED: Now includes learning logic
def present_tool_result_node(state: AgentState) -> dict:
    """This node takes the result from the tool, formats it as the final AI message, and learns from the interaction."""
    print("---PRESENTER---")
    tool_message = state["messages"][-1]
    final_answer = AIMessage(content=tool_message.content)
    
    # NEW: Learning Logic - Extract and cache valuable interactions
    try:
        # Look for the original user question
        user_messages = [msg for msg in state["messages"] if hasattr(msg, 'content') and not isinstance(msg, AIMessage)]
        if user_messages and len(user_messages) > 0:
            last_user_question = user_messages[-1].content
            
            # Get the final answer content
            answer_content = final_answer.content
            
            # Cache the knowledge if it's valuable
            if last_user_question and answer_content:
                session_id = state.get("session_id")
                user_id = state.get("user_id")
                
                success = cache_knowledge(
                    question=last_user_question,
                    answer=answer_content,
                    session_id=session_id,
                    user_id=user_id
                )
                
                if success:
                    print(f"✅ Learned from interaction: {last_user_question[:50]}...")
                else:
                    print("📝 Interaction not cached (not valuable enough or error occurred)")
    
    except Exception as e:
        print(f"⚠️ Learning error (non-critical): {e}")
        # Continue normally - learning errors shouldn't break the chat
    
    return {"messages": [final_answer]}

def should_continue(state: AgentState) -> str:
    """Determines whether to continue the graph or end."""
    last_message = state["messages"][-1]
    return "continue" if isinstance(last_message, AIMessage) and last_message.tool_calls else "end"

# Define the graph (same structure as before)
workflow = StateGraph(AgentState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("tools", tool_node)
workflow.add_node("presenter", present_tool_result_node)
workflow.add_conditional_edges("supervisor", should_continue, {"continue": "tools", "end": END})
workflow.add_edge("tools", "presenter")
workflow.add_edge("presenter", END)
workflow.set_entry_point("supervisor")

app_graph = workflow.compile()

# NEW: Enhanced invocation function that supports learning context
def invoke_with_learning_context(messages, session_id=None, user_id=None):
    """Invoke the agent with learning context for better knowledge caching."""
    inputs = {
        "messages": messages,
        "session_id": session_id,
        "user_id": user_id
    }
    return app_graph.invoke(inputs)

# NEW: Streaming version with learning context
async def astream_with_learning_context(messages, session_id=None, user_id=None):
    """Async streaming version with learning context."""
    inputs = {
        "messages": messages,
        "session_id": session_id,
        "user_id": user_id
    }
    async for event in app_graph.astream(inputs, stream_mode="values"):
        yield event