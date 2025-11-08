# Database-AI Project — File Map

This file map lists the repository layout and a one-line purpose for each major file/folder to help navigation.

Root
- Readme.md — Project README
- .gitignore — Git ignore rules
- FILE_MAP.md — (this file)

backend/
- main.py — FastAPI app entrypoint (includes routers and CORS)
- requirements.txt — Python dependencies
- venv/ — (optional) virtual environment (not committed)

backend/api/
- __init__.py
- auth.py — Authentication endpoints (signup/login) using Supabase
- chat.py — Chat-related endpoints

backend/core/
- __init__.py
- config.py — Project configuration (env, constants)
- dependencies.py — Dependency injection (Supabase client, etc.)

backend/schemas/
- __init__.py
- user.py — Pydantic models for user-related payloads
- session.py — Pydantic models for sessions
- chat.py — Pydantic models for chat messages / requests

backend/services/
- __init__.py
- agent.py — Agent logic / orchestration for AI tasks
- tools.py — Utility tools used by services

frontend/
- README.md — Frontend README
- package.json / package-lock.json — Node dependencies and lockfile
- next.config.js — Next.js configuration
- tsconfig.json — TypeScript config
- tailwind.config.ts — Tailwind CSS config
- postcss.config.mjs — PostCSS config
- eslint.config.mjs — ESLint config
- public/ — Static public assets (svgs etc.)
  - vercel.svg, next.svg, globe.svg, file.svg, window.svg

frontend/src/
- lib/supabaseClient.ts — Supabase client wrapper
- hooks/useAuth.tsx — React hook for auth state
- components/
  - Thinking.tsx — UI: thinking indicator
  - TitleAnimation.tsx — UI: animated title
  - SupabaseProvider.tsx — Provider for Supabase context
  - MermaidDiagram.tsx — Diagram rendering component

frontend/src/app/
- layout.tsx — Root layout
- globals.css — Global styles
- page.tsx — Home page
- about.txt — About file
- site.webmanifest — PWA manifest
- favicon.ico / favicon-*.png / apple-touch-icon.png — Icons
- android-chrome-192x192.png / android-chrome-512x512.png — Icons

frontend/src/app/signup/
- page.tsx — Signup page

frontend/src/app/login/
- page.tsx — Login page

frontend/src/app/chat/
- layout.tsx — Chat layout
- [[...sessionId]]/page.tsx — Chat session page (dynamic)

frontend/src/app/api/
- chat/route.ts — Client -> backend chat proxy route
- sessions/route.ts — Sessions API (POST handler used by UI)
- sessions/[sessionId]/route.ts — Session-specific API handlers
- sessions/[sessionId]/messages/route.ts — Messages API for a session

Other
- backend/__pycache__/ — Python cache files

Notes
- Some files/folders may be omitted if they are generated or ignored by git (e.g., virtual environments). Use `git status` to see untracked items.
- If you want, I can:
  - Generate a more detailed README for `backend/` or `frontend/`.
  - Create a visual tree (JSON or DOT) for tooling.
  - Open any file or run the backend server for you.

---
Generated on: 2025-11-08
