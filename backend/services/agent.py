from typing import TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from .tools import query_supabase, web_search, generate_diagram

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    session_id: str
    user_id: str

tools = [query_supabase, web_search, generate_diagram]
tool_node = ToolNode(tools)

system_prompt = SystemMessage(
    content="""You are an expert Data Structures and Algorithms tutor with intelligent tool routing.

CRITICAL: You MUST ALWAYS follow this format for EVERY response:

<thinking>
[Explain your reasoning here]
- What is the user asking?
- Which tool should I use?
  * generate_diagram: For flowcharts, trees, graphs, algorithm visualizations
  * web_search: For recent information, current trends, or topics not in my knowledge
  * query_supabase: For standard DSA concepts (fallback only)
- What's my strategy?
</thinking>

[Your actual response here]

TOOL ROUTING RULES:
1. **Diagram Requests** (keywords: "draw", "diagram", "visualize", "flowchart", "show me"):
   → Use generate_diagram
   → This will create Mermaid diagram + explanation + cache it

2. **Recent/Current Information** (keywords: "latest", "recent", "current", "2024", "2025"):
   → Use web_search
   → Results are automatically cached

3. **Standard DSA Concepts** (keywords: "what is", "explain", "how does"):
   → Answer directly using your knowledge
   → Only use query_supabase if you're unsure

4. **Greetings/Casual** (keywords: "hello", "hi", "thanks"):
   → Answer directly, no tools needed

After your <thinking> block, execute your plan. Be concise and educational."""
)

supervisor_prompt = ChatPromptTemplate.from_messages([system_prompt, ("placeholder", "{messages}")])
supervisor_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", temperature=0.3)
supervisor_llm_with_tools = supervisor_llm.bind_tools(tools)
supervisor_chain = supervisor_prompt | supervisor_llm_with_tools

def supervisor_node(state: AgentState) -> dict:
    """Main decision node with smart routing."""
    print("---SUPERVISOR---")
    response = supervisor_chain.invoke({"messages": state["messages"]})
    return {"messages": [response]}

def present_tool_result_node(state: AgentState) -> dict:
    """Presents tool results as final answer."""
    print("---PRESENTER---")
    tool_message = state["messages"][-1]
    final_answer = AIMessage(content=tool_message.content)
    return {"messages": [final_answer]}

def should_continue(state: AgentState) -> str:
    """Determines whether to continue or end."""
    last_message = state["messages"][-1]
    return "continue" if isinstance(last_message, AIMessage) and last_message.tool_calls else "end"

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("tools", tool_node)
workflow.add_node("presenter", present_tool_result_node)
workflow.add_conditional_edges("supervisor", should_continue, {"continue": "tools", "end": END})
workflow.add_edge("tools", "presenter")
workflow.add_edge("presenter", END)
workflow.set_entry_point("supervisor")

app_graph = workflow.compile()

async def astream_with_learning_context(messages, session_id=None, user_id=None):
    """Async streaming with session context."""
    inputs = {
        "messages": messages,
        "session_id": session_id,
        "user_id": user_id
    }
    async for event in app_graph.astream(inputs, stream_mode="values"):
        yield event