from typing import TypedDict, Annotated
import operator
from langchain_core.messages import BaseMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from .tools import query_supabase, web_search, generate_diagram

# --- Agent State and Graph Definition ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]

tools = [query_supabase, web_search, generate_diagram]
tool_node = ToolNode(tools)

# UPDATED: The AI's persona is now focused on Data Structures and Algorithms
system_prompt = SystemMessage(
    content="""You are an expert tutor for Data Structures and Algorithms (DSA). Your goal is to be as helpful as possible, explaining complex concepts clearly.
    
    1.  First, **think** step-by-step about the user's request to create a plan.
    2.  Enclose your thinking process in `<thinking>` tags.
    3.  After you have laid out your plan, execute it by choosing a tool, if necessary. If no tool is needed, provide a direct answer after your thinking block."""
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

def present_tool_result_node(state: AgentState) -> dict:
    """This node takes the result from the tool and formats it as the final AI message."""
    print("---PRESENTER---")
    tool_message = state["messages"][-1]
    final_answer = AIMessage(content=tool_message.content)
    return {"messages": [final_answer]}

def should_continue(state: AgentState) -> str:
    """Determines whether to continue the graph or end."""
    last_message = state["messages"][-1]
    return "continue" if isinstance(last_message, AIMessage) and last_message.tool_calls else "end"

# Define the graph
workflow = StateGraph(AgentState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("tools", tool_node)
workflow.add_node("presenter", present_tool_result_node)
workflow.add_conditional_edges("supervisor", should_continue, {"continue": "tools", "end": END})
workflow.add_edge("tools", "presenter")
workflow.add_edge("presenter", END)
workflow.set_entry_point("supervisor")

app_graph = workflow.compile()

