'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Brain } from 'lucide-react';

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

export default function ChatPage({ params }: { params: Promise<{ sessionId?: string[] }> }) {
  // FIXED: Use React.use() to unwrap the params Promise
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

  // Function to clear error messages
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
        const response = await fetch(`/api/chat/${sessionId}`);
        if (response.ok) {
          const historyMessages = await response.json();
          const formattedMessages: Message[] = historyMessages.map((msg: any, index: number) => ({
            id: `${index}`,
            role: msg.type || msg.role,
            content: msg.text,
            timestamp: new Date(),
            thinkingProcess: msg.thinkingProcess || undefined // Load thinking process if saved
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
    
    // Create a unique ID for this AI response and start thinking
    const aiMessageId = (Date.now() + 1).toString();
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

      console.log('Sending request to:', `/api/sessions/${sessionId}/messages`);
      console.log('Request payload:', { 
        messages: conversationHistory,
        sessionId: sessionId 
      });

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

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        if (response.status === 422) {
          try {
            const errorJson = JSON.parse(errorText);
            console.error('Validation error details:', errorJson);
            errorMessage = `Validation error: ${JSON.stringify(errorJson)}`;
          } catch {
            console.error('422 error (not JSON):', errorText);
            errorMessage = `Validation error: ${errorText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);

      if (!contentType?.includes('text/event-stream') && !contentType?.includes('text/plain')) {
        console.warn('Response is not SSE format, content-type:', contentType);
        const jsonResponse = await response.json();
        console.log('Non-streaming response:', jsonResponse);
        
        // For non-streaming, create final message with current thinking
        const aiMessage: Message = {
          id: aiMessageId,
          role: 'ai',
          content: jsonResponse.content || jsonResponse.message || 'Received response',
          timestamp: new Date(),
          thinkingProcess: [...thinking.thoughts] // Preserve thinking process
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
        return;
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
          console.log('Received chunk:', chunk);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const dataStr = line.slice(6);
                if (dataStr.trim() === '') continue;
                
                const data = JSON.parse(dataStr);
                console.log('Parsed SSE data:', data);
                
                if (data.type === 'thinking') {
                  // Add new thinking step to the progression
                  setThinking(prev => ({ 
                    ...prev,
                    isThinking: true, 
                    currentThought: data.content,
                    thoughts: [...prev.thoughts, data.content]
                  }));
                } else if (data.type === 'final_answer') {
                  finalResponseReceived = true;
                  aiResponse = data.content;
                  
                  // Create the final AI message with the complete thinking process
                  const aiMessage: Message = {
                    id: aiMessageId,
                    role: 'ai',
                    content: aiResponse,
                    timestamp: new Date(),
                    thinkingProcess: [...thinking.thoughts] // Store the complete thinking journey
                  };
                  
                  setMessages(prev => [...prev, aiMessage]);
                  setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
                  
                } else if (data.content && !finalResponseReceived) {
                  // Handle other possible response formats
                  const aiMessage: Message = {
                    id: aiMessageId,
                    role: 'ai',
                    content: data.content,
                    timestamp: new Date(),
                    thinkingProcess: [...thinking.thoughts]
                  };
                  
                  setMessages(prev => [...prev, aiMessage]);
                  setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError, 'Raw line:', line);
              }
            }
          }
        }
      }
      
      // Fallback: if no final response was received through SSE
      if (!finalResponseReceived && !aiResponse) {
        const finalThoughts = [...thinking.thoughts, 'No response received, ending session...'];
        
        // Show error completion step
        setThinking(prev => ({ 
          ...prev,
          currentThought: 'No response received, ending session...',
          thoughts: finalThoughts
        }));
        
        setTimeout(() => {
          const aiMessage: Message = {
            id: aiMessageId,
            role: 'ai',
            content: 'I apologize, but I didn\'t receive a complete response. Please try again.',
            timestamp: new Date(),
            thinkingProcess: finalThoughts
          };
          
          setMessages(prev => [...prev, aiMessage]);
          setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      setThinking({ isThinking: false, currentThought: '', thoughts: [], messageId: '' });
      
      const errorContent = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorMessage: Message = {
        id: aiMessageId,
        role: 'ai',
        content: `Sorry, I encountered an error while processing your request: ${errorContent}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !thinking.isThinking && (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation by typing a message below.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${
              message.role === 'user' 
                ? 'bg-blue-600 text-white p-3 rounded-lg' 
                : 'space-y-3'
            }`}>
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <>
                  {/* Show thinking process for AI messages */}
                  {message.thinkingProcess && message.thinkingProcess.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        <Brain className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-300">Thinking Process</span>
                      </div>
                      <div className="space-y-2">
                        {message.thinkingProcess.map((thought, index) => (
                          <div key={index} className="text-sm text-gray-300 flex items-start">
                            <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mr-3 mt-2 flex-shrink-0 opacity-60"></span>
                            <span>{thought}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Response */}
                  <div className="bg-gray-700 text-white p-3 rounded-lg">
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        
        {/* Current Active Thinking (only while AI is thinking) */}
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
                      className={`text-sm transition-all duration-500 ease-in-out ${
                        index === thinking.thoughts.length - 1 
                          ? 'text-white font-medium opacity-100' 
                          : 'text-gray-300 opacity-70'
                      }`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full mr-3 ${
                        index === thinking.thoughts.length - 1 
                          ? 'bg-blue-400 animate-pulse' 
                          : 'bg-gray-500'
                      }`}></span>
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

      {/* Input Area */}
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
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}