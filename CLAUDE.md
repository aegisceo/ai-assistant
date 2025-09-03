# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🧠 MEMORY PERSISTENCE SYSTEM

### **Project State Files (READ FIRST)**
- **`PROJECT_MEMORY.md`** - ⭐ COMPREHENSIVE project status, architecture, and current state
- **`.claude/session_history.md`** - Session-by-session conversation context and decisions
- **`IMPLEMENTATION_PROGRESS.md`** - ⚠️ OUTDATED (claims phases pending, but all are complete)

### **Quick Status Check**
```bash
# Current Servers (if running)
Backend: http://localhost:3000/api/health
Frontend: http://localhost:8080 (ai-assistant-ui directory)

# Quick architecture verification
curl http://localhost:3000/api/health  # Should return healthy status
curl http://localhost:8080 | head -5   # Should show NeuroFlow AI title
```

### **Critical Context**
- ✅ **ALL 4 PHASES COMPLETE** - Ready for testing and PR
- ✅ **18 API Endpoints** - Complete Gmail, AI, Calendar integration
- ⚠️ **Two Frontends**: Use `ai-assistant-ui/` (NOT `site ui/`)
- 🎯 **Production Ready** - Comprehensive TypeScript, security, error handling

## Development Commands

### Core Development
```bash
# Development server (smart startup - handles port conflicts)
npm run start:dev

# Regular development server (port 3000)
npm run dev

# Kill any process using port 3000
npm run kill:3000

# Build application
npm run build

# Production server
npm start
```

### Code Quality & Type Safety
```bash
# TypeScript type checking (critical - run before committing)
npm run type-check

# Linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Operations
```bash
# Supabase CLI commands (if available)
supabase db push              # Push migrations
supabase db reset             # Reset local database
supabase migration new        # Create new migration
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript (strict mode)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI/ML**: Anthropic Claude API for email classification
- **Auth**: Supabase Auth
- **Integrations**: Gmail API, Google Calendar API

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (Gmail, email processing)
│   ├── page.tsx           # Main dashboard page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   └── gmail/            # Gmail-specific UI components
├── integrations/         # Third-party service integrations
│   └── gmail/           # Gmail API client, auth service
├── lib/                 # Core utilities and helpers
│   ├── types.ts         # Utility types and Result pattern
│   ├── validation.ts    # Zod schemas for runtime validation
│   ├── api-client.ts    # Type-safe API client
│   └── test-utils.ts    # Testing utilities
└── types/              # TypeScript type definitions
    ├── index.ts        # Core domain types (Email, User, etc.)
    ├── api.ts          # API request/response types
    └── errors.ts       # Custom error classes
```

### Core Domain Types

#### Email Processing
- **Email**: Main email entity with strict typing
- **EmailClassification**: AI classification results (category, urgency, importance)
- **EmailCategory**: Union type: 'work' | 'personal' | 'financial' | 'opportunity' | 'newsletter' | 'spam' | 'other'

#### Authentication & Users
- **UserId**: Branded type `string & { __brand: 'UserId' }` for type safety
- **UserPreferences**: Configuration for email classification and working hours

#### Gmail Integration
- **GmailToken**: OAuth token storage with expiration handling
- **GmailIntegrationError**: Specific error types for Gmail API failures

### Error Handling Pattern
The project uses a **Result pattern** for type-safe error handling:
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }
```

All async operations that can fail return `Result<T, E>` instead of throwing exceptions.

### Database Schema
- **emails**: Email metadata and classification results
- **user_preferences**: User settings and AI classification preferences  
- **gmail_tokens**: Secure OAuth token storage with RLS

### Key API Endpoints
- `GET/DELETE /api/gmail/status` - Connection status and disconnect
- `GET /api/gmail/auth` - Initiate OAuth flow
- `GET /api/gmail/emails` - Fetch emails with filtering
- `POST /api/emails/classify` - AI email classification (planned)

## TypeScript Configuration

### Strict Mode Requirements
The project uses **maximum TypeScript strictness**:
- `strict: true` with all sub-options enabled
- `exactOptionalPropertyTypes: true` - Distinguishes `undefined` vs missing properties
- `noUncheckedIndexedAccess: true` - Requires null checks for array/object access
- `noPropertyAccessFromIndexSignature: true` - Prevents unsafe property access

### Development Patterns
1. **Always use explicit types** - Never use `any`, prefer `unknown` for uncertain types
2. **Prefer readonly arrays/objects** for immutability
3. **Use discriminated unions** for state management
4. **Implement branded types** for IDs to prevent mixing different ID types
5. **Use const assertions** for literal types: `as const`

### Path Mapping
```typescript
"@/*": ["./src/*"]
"@/components/*": ["./src/components/*"]  
"@/lib/*": ["./src/lib/*"]
"@/types/*": ["./src/types/*"]
"@/integrations/*": ["./src/integrations/*"]
```

## Security & Privacy Principles

### Privacy-First Design
- **Never log email content** in development or production
- Only store email metadata and classification results
- User data is isolated with Supabase RLS policies

### Environment Variables
All sensitive configuration is validated with Zod schemas:
- `GOOGLE_CLIENT_ID/SECRET` - Gmail OAuth credentials
- `SUPABASE_URL/ANON_KEY` - Database connection
- `ANTHROPIC_API_KEY` - Claude AI classification service

### Data Security
- OAuth tokens encrypted at rest in Supabase
- Row Level Security ensures user data isolation
- Rate limiting implemented on all API endpoints

## Gmail Integration Status

The Gmail integration is **production-ready** with:
- ✅ OAuth2 authentication flow
- ✅ Secure token storage with auto-refresh
- ✅ Email fetching with pagination
- ✅ Type-safe error handling
- ✅ Comprehensive API routes

**Next phases**: Frontend components, AI classification, calendar integration.

## Cursor AI Configuration

The project includes `.cursorrules` with:
- Strict TypeScript enforcement
- Privacy and security guidelines  
- Code style preferences optimized for AI assistance
- Performance optimization suggestions

## Common Development Tasks

### Adding New API Routes
1. Create route handler in `src/app/api/[endpoint]/route.ts`
2. Define request/response types in `src/types/api.ts`
3. Add Zod validation schemas in `src/lib/validation.ts`
4. Use Result pattern for error handling
5. Implement proper authentication checks

### Adding New Components
1. Check existing components for patterns and styling
2. Use strict TypeScript with proper prop typing
3. Implement proper error boundaries
4. Follow accessibility best practices
5. Use existing utility functions from `src/lib/`

### Database Changes  
1. Create migration in `supabase/migrations/`
2. Update type definitions in `src/types/`
3. Test with RLS policies
4. Update API routes and validation schemas