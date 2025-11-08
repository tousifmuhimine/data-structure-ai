'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Brain, Zap, Shield, Menu, X } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGetStarted = () => {
    if (user) {
      router.push('/chat');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header/Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-400 mr-2" />
              <span className="text-xl font-bold">Data-Structure AI</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="hover:text-purple-400 transition">Features</a>
              <a href="#about" className="hover:text-purple-400 transition">About</a>
              <a href="#contact" className="hover:text-purple-400 transition">Contact</a>
              {user ? (
                <button
                  onClick={() => router.push('/chat')}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
                >
                  Go to Chat
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md hover:bg-gray-800 transition"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-3">
              <a href="#features" className="block hover:text-purple-400 transition">Features</a>
              <a href="#about" className="block hover:text-purple-400 transition">About</a>
              <a href="#contact" className="block hover:text-purple-400 transition">Contact</a>
              {user ? (
                <button
                  onClick={() => router.push('/chat')}
                  className="block w-full text-left px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
                >
                  Go to Chat
                </button>
              ) : (
                <Link
                  href="/login"
                  className="block w-full text-left px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition"
                >
                  Login
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Master Data Structures with AI
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Your intelligent tutor for learning data structures and algorithms. 
            Get instant explanations, visualizations, and smart caching for faster learning.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 transition transform hover:scale-105 shadow-lg shadow-purple-500/50"
          >
            {user ? 'Go to Chat' : 'Get Started Free'}
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Why Choose Our AI Tutor?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700 hover:border-purple-500 transition">
              <Brain className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Smart Caching</h3>
              <p className="text-gray-400">
                Diagram explanations and web searches are automatically cached for instant retrieval. 
                Learn faster with our intelligent knowledge system.
              </p>
            </div>
            
            <div className="p-8 rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700 hover:border-purple-500 transition">
              <Zap className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Visual Learning</h3>
              <p className="text-gray-400">
                Get Mermaid diagrams with detailed explanations powered by Groq. 
                Visualize complex algorithms and data structures instantly.
              </p>
            </div>
            
            <div className="p-8 rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700 hover:border-purple-500 transition">
              <Shield className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Gemini Powered</h3>
              <p className="text-gray-400">
                Advanced Google Gemini AI understands context and routes your questions 
                to the right tools automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-8">About Data-Structure AI</h2>
          <div className="space-y-6 text-lg text-gray-300">
            <p>
              Data-Structure AI is an intelligent tutoring system designed to help students and 
              professionals master data structures and algorithms through AI-powered assistance.
            </p>
            <p>
              Our system features smart caching for diagrams and web searches, automatic tool routing 
              with Gemini AI, and visual learning through Mermaid diagrams with Groq-powered explanations.
            </p>
            <p>
              Whether you are preparing for coding interviews, working on assignments, or deepening 
              your understanding of computer science fundamentals, our AI tutor adapts to your needs.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">Get in Touch</h2>
          <p className="text-lg text-gray-300 mb-8">
            Have questions or feedback? We would love to hear from you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a 
              href="mailto:support@datastructure-ai.com" 
              className="px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              abdullahtsn13@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
       <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Wanna check the backend running or not?</h2>
            <p className="text-xl text-gray-300 mb-8">
                For making sure backend is running properly.
            </p>
            <button
                onClick={() => window.location.href = "https://data-structure-ai.onrender.com"}
                className="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 transition transform hover:scale-105"
            >
                {user ? 'Go to Site' : 'Create Free Account'}
            </button>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2025 Data-Structure AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}