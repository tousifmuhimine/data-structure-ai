'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Brain } from 'lucide-react';
import MermaidDiagram from '../../../components/MermaidDiagram';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  thinkingProcess?: string[]; // Store the thinking steps with the final message
}

interface ThinkingState {
  isThinking: boolean;
  currentThought: string;
  thoughts: string[];
  messageId: string; // Track which message this thinking belongs to
}

// ✅ New interface to replace `any` from backend messages
interface BackendMessage {
  type?: 'user' | 'ai';
  role?: 'user' | 'ai';
  text: string;
  thinkingProcess?: string[];
}

export default function ChatPage({ params }: { params: Promise<{ sessionId?: string[] }> }) {
  const resolvedParams = React.use(params);
  const sessionId = resolvedParams.sessionId?.[0];
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinking, setThinking] = useState<ThinkingState>({ 
    isThinking: false, 
    currentThought: '', 
    thoughts: [],
    messageId: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentThoughtsRef = useRef<string[]>([]);

  const extractMermaidCode = (content: string) => {
    const mermaidMatch = content.match(/%%MERMAID%%([\s\S]*?)%%\/MERMAID%%/);
    if (mermaidMatch) {
      return {
        hasMermaid: true,
        mermaidCode: mermaidMatch[1].trim(),
        textContent: content.replace(/%%MERMAID%%([\s\S]*?)%%\/MERMAID%%/, '').trim()
      };
    }
    return { hasMermaid: false, mermaidCode: '', textContent: content };
  };

  const clearErrorMessages = () => {
    setMessages(prev => prev.filter(msg => 
      !msg.content.includes('Sorry, I encountered an error') && 
      !msg.content.includes('Validation error')
    ));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  // Load messages when sessionId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!sessionId) return;
      
      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`);
        if (response.ok) {
          const historyMessages: BackendMessage[] = await response.json();
          const formattedMessages: Message[] = historyMessages.map((msg, index) => ({
            id: `${index}`,
            role: msg.type || msg.role || 'ai',  // fallback to 'ai'
            content: msg.text,
            timestamp: new Date(),
            thinkingProcess: msg.thinkingProcess || undefined
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    loadMessages();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    const aiMessageId = (Date.now() + 1).toString();
    currentThoughtsRef.current = [];
    setThinking({ 
      isThinking: true, 
      currentThought: 'Starting to think...',
      thoughts: ['Starting to think...'],
      messageId: aiMessageId
    });

    try {
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        text: msg.content
      }));

      const requestPayload = {
        messages: conversationHistory,
        session_id: sessionId,
        user_message: input.trim(),
      };

      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';
      let finalResponseReceived = false;
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const dataStr = line.slice(6);
                if (!dataStr.trim()) continue;
                const data = JSON.parse(dataStr);

                if (data.type === 'thinking') {
                  currentThoughtsRef.current = [...currentThoughtsRef.current, data.content];
                  setThinking(prev => ({ 
                    ...prev,
                    isThinking: true, 
                    currentThought: data.content,
                    thoughts: [...prev.thoughts, data.content]
                  }));
                } else if (data.type === 'final_answer') {
                  finalResponseReceived = true;
                  aiResponse = data.content;
                  
                  const aiMessage: Message = {
                    id: aiMessageId,
                    role: 'ai',
                    content: aiResponse,
                    timestamp: new Date(),
                    thinkingProcess: [...currentThoughtsRef.current]
                  };
                  
                  setMessages(prev => [...prev, aiMessage]);
                  setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
                  currentThoughtsRef.current = [];
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError, 'Raw line:', line);
              }
            }
          }
        }
      }

      if (!finalResponseReceived && !aiResponse) {
        setThinking(prev => ({ 
          ...prev,
          currentThought: 'No response received, ending session...',
          thoughts: [...thinking.thoughts, 'No response received, ending session...']
        }));
        
        setTimeout(() => {
          const aiMessage: Message = {
            id: aiMessageId,
            role: 'ai',
            content: 'I apologize, but I didn\'t receive a complete response. Please try again.',
            timestamp: new Date(),
            thinkingProcess: [...thinking.thoughts, 'No response received']
          };
          setMessages(prev => [...prev, aiMessage]);
          setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
        }, 1000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });

      const aiMessage: Message = {
        id: aiMessageId,
        role: 'ai',
        content: `Sorry, I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Welcome to the Chat</h2>
          <p className="text-gray-400">Create a new chat to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !thinking.isThinking && (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation by typing a message below.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${message.role === 'user' ? 'bg-blue-600 text-white p-3 rounded-lg' : 'space-y-3'}`}>
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <>
                  {message.thinkingProcess && message.thinkingProcess.length > 0 && (
                    <details className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-lg">
                      <summary className="flex items-center space-x-2 p-4 cursor-pointer hover:bg-purple-900/20 transition-colors">
                        <Brain className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-300">View thinking process...</span>
                        <span className="ml-auto text-xs text-gray-400">({message.thinkingProcess.length} steps)</span>
                      </summary>  
                      <div className="px-4 pb-4 space-y-2 border-t border-purple-500/20 mt-2 pt-3">
                        {message.thinkingProcess.map((thought, index) => (
                          <div key={index} className="text-sm text-gray-300 flex items-start">
                            <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mt-1 mr-3 flex-shrink-0"></span>
                            <span>{thought}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  <div className="bg-gray-700 text-white p-3 rounded-lg">
                    <div className="space-y-4">
                      {(() => {
                        const { hasMermaid, mermaidCode, textContent } = extractMermaidCode(message.content);
                        return (
                          <>
                            {textContent && <div className="whitespace-pre-wrap">{textContent}</div>}
                            {hasMermaid && <MermaidDiagram chart={mermaidCode} id={`diagram-${message.id}`} />}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        
        {thinking.isThinking && (
          <div className="flex justify-start">
            <div className="max-w-3xl space-y-3">
              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 p-4 rounded-lg shadow-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">AI is thinking...</span>
                </div>
                
                <div className="space-y-2">
                  {thinking.thoughts.map((thought, index) => (
                    <div 
                      key={index} 
                      className={`text-sm transition-all duration-500 ease-in-out ${index === thinking.thoughts.length - 1 ? 'text-white font-medium opacity-100' : 'text-gray-300 opacity-70'}`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full mr-3 ${index === thinking.thoughts.length - 1 ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></span>
                      {thought}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-600 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
