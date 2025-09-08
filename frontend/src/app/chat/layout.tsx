'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { LogOut, MessageSquarePlus, Trash2 } from 'lucide-react';
import TitleAnimation from '@/components/TitleAnimation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Session {
  id: string;
  title: string;
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  // Get the current session ID from the URL, if it exists
  const currentSessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  useEffect(() => {
    const fetchSessions = async () => {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    };
    if (user) {
      fetchSessions();
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleNewChat = async () => {
    const res = await fetch('/api/sessions', { method: 'POST' });
    if (res.ok) {
      const newSession = await res.json();
      // Force a reload to update the session list
      window.location.href = `/chat/${newSession.id}`;
    } else {
      console.error("Failed to create new chat session");
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent the Link navigation
    e.stopPropagation(); // Prevent event bubbling
    
    console.log('Delete button clicked for session:', sessionId);
    
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      console.log('User cancelled deletion');
      return;
    }

    console.log('User confirmed deletion, starting delete process...');
    setDeletingSessionId(sessionId);

    try {
      console.log('Making DELETE request to:', `/api/sessions/${sessionId}`);
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      
      console.log('Delete response status:', res.status);
      console.log('Delete response ok:', res.ok);
      
      if (res.ok) {
        const responseData = await res.json();
        console.log('Delete response data:', responseData);
        
        // Remove the session from the local state
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        
        // If we're currently viewing this session, redirect to a new chat
        if (currentSessionId === sessionId) {
          router.push('/chat');
        }
        
        console.log('Session deleted successfully');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to delete session. Status:', res.status);
        console.error('Error data:', errorData);
        alert('Failed to delete the chat session. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('An error occurred while deleting the chat session.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <div className="flex h-screen text-white bg-gray-900">
      <aside className="w-64 bg-gray-800 p-4 flex flex-col">
        <div className="p-2 mb-4">
          <TitleAnimation />
        </div>
        
        <button
          onClick={handleNewChat}
          className="flex items-center w-full p-2 mb-4 text-left text-sm rounded-md hover:bg-gray-700 transition"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New Chat
        </button>
        
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map(session => (
            <div key={session.id} className="group relative">
              <Link href={`/chat/${session.id}`}>
                <div className={`w-full p-2 text-left text-sm rounded-md truncate transition flex items-center justify-between ${currentSessionId === session.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}>
                  <span className="truncate pr-2">{session.title}</span>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    disabled={deletingSessionId === session.id}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600/20 rounded transition-all shrink-0 disabled:opacity-50"
                    title="Delete chat"
                  >
                    {deletingSessionId === session.id ? (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-400" />
                    )}
                  </button>
                </div>
              </Link>
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t border-gray-700">
          <div className="text-sm truncate">{user?.email}</div>
          <button
            onClick={handleSignOut}
            className="flex items-center w-full p-2 mt-2 text-left text-sm rounded-md hover:bg-gray-700 transition"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}