'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { LogOut, MessageSquarePlus } from 'lucide-react';
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
            <Link key={session.id} href={`/chat/${session.id}`}>
              <div className={`w-full p-2 text-left text-sm rounded-md truncate transition ${currentSessionId === session.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}>
                {session.title}
              </div>
            </Link>
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

