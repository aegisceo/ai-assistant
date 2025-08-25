# AI Digital Assistant for Neurodivergent Professionals

A privacy-first, performance-optimized AI assistant built with Next.js 14, TypeScript (strict mode), Supabase, and OpenAI API. Designed specifically for email and calendar management with AI-powered classification and prioritization.

## 🚀 Features

- **AI-Powered Email Classification**: Automatically categorize and prioritize emails using OpenAI
- **Smart Calendar Management**: Intelligent event scheduling and conflict resolution
- **Privacy-First Design**: No sensitive data logging, encrypted storage
- **Type-Safe Architecture**: Full TypeScript strict mode with comprehensive type definitions
- **Cursor AI Optimized**: Enhanced AI assistance with strict typing and documentation

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript 5.2
- **Backend**: Next.js API Routes, Supabase
- **AI**: OpenAI API for email classification
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email Integration**: Gmail API
- **Calendar**: Google Calendar API

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Google Cloud Platform account (for Gmail/Calendar APIs)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd ai-assistant
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Google APIs
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

Run the Supabase migrations to create the required tables:

```sql
-- Create emails table
CREATE TABLE emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  subject TEXT,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  classification JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_classification_enabled BOOLEAN DEFAULT true,
  auto_unsubscribe_enabled BOOLEAN DEFAULT false,
  priority_categories TEXT[] DEFAULT ARRAY['work', 'financial'],
  working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}',
  notification_settings JSONB DEFAULT '{"urgentEmails": true, "upcomingEvents": true, "missedOpportunities": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX idx_emails_received_at ON emails(received_at);
```

### 4. Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Development server
npm run dev
```

## 🏗️ Project Structure

```
ai-assistant/
├── src/
│   ├── types/           # TypeScript type definitions
│   │   ├── index.ts     # Core types (Email, Calendar, etc.)
│   │   ├── api.ts       # API-specific types
│   │   └── test.ts      # Test utility types
│   ├── lib/             # Utility functions and helpers
│   │   ├── types.ts     # Utility types and Result pattern
│   │   └── ai-patterns.ts # AI-optimized development examples
│   ├── components/      # React components
│   ├── integrations/    # Third-party API integrations
│   └── agents/          # AI agent implementations
├── .vscode/             # VS Code settings
├── tsconfig.json        # TypeScript configuration
├── .eslintrc.json       # ESLint rules
├── .cursorrules         # Cursor AI behavior rules
└── package.json         # Dependencies
```

## 🔧 TypeScript Strict Mode Features

### Strict Compiler Options
- `strict: true` - Enables all strict type checking options
- `exactOptionalPropertyTypes: true` - Distinguishes between `undefined` and missing properties
- `noUncheckedIndexedAccess: true` - Requires explicit checks for array/object access
- `noPropertyAccessFromIndexSignature: true` - Prevents unsafe property access

### Advanced Type Patterns
- **Result Pattern**: Type-safe error handling with `Result<T, E>`
- **Branded Types**: Type-safe IDs with `UserId = string & { __brand: 'UserId' }`
- **Discriminated Unions**: Exhaustive state management
- **Readonly Arrays**: Immutable data structures

## 🤖 Cursor AI Optimization

This project is specifically configured to maximize Cursor's AI assistance:

### AI Behavior Rules (`.cursorrules`)
- Strict TypeScript requirements
- AI assistance behavior guidelines
- Privacy and security considerations
- Code style preferences

### VS Code Settings
- Enhanced TypeScript IntelliSense
- Cursor-specific AI features
- Auto-formatting and import organization
- Real-time error detection

## 📚 Development Patterns

### 1. Type-Safe API Handlers

```typescript
export async function classifyEmail(
  email: Pick<Email, 'subject' | 'bodyText' | 'sender'>,
  userContext: UserPreferences
): Promise<Result<EmailClassification, ClassificationError>> {
  // Implementation with full type safety
}
```

### 2. Result Pattern for Error Handling

```typescript
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

### 3. Branded Types for IDs

```typescript
export type UserId = string & { readonly __brand: 'UserId' };
export const createUserId = (id: string): UserId => id as UserId;
```

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
npm run build
npm start
```

## 🔒 Privacy & Security

- **No Sensitive Logging**: Email content is never logged in development
- **Environment Validation**: All environment variables validated with Zod
- **Rate Limiting**: API endpoints include rate limiting
- **Encrypted Storage**: Sensitive data encrypted at rest
- **GDPR Compliant**: User data can be exported/deleted

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript strict mode guidelines
4. Add comprehensive type definitions
5. Include JSDoc documentation
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the TypeScript configuration

## 🔮 Roadmap

- [ ] Advanced email filtering and rules
- [ ] Calendar conflict resolution
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Team collaboration features
- [ ] Advanced AI models integration
