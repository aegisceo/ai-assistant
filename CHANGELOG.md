# Changelog

All notable changes to this project will be documented in this file.

## [2025-10-06] - Security & Development Tools Update

### Security Improvements ✅

- **Removed Hardcoded Secrets**: All Google OAuth credentials now loaded from environment variables
- **Enhanced Security Validation**: Added environment variable validation with helpful error messages
- **Secure Logging Utility**: Created production-ready `secure-logger.ts` with automatic PII/credential redaction
- **Updated OAuth Scripts**: `test-oauth-setup.js` and `gmail-auth.js` now follow security best practices

### New Features

- **Secure Logger** (`src/lib/utils/secure-logger.ts`):
  - Automatically redacts 25+ sensitive field types (passwords, tokens, secrets, keys)
  - Special email content handling (never logs body/payload)
  - TypeScript with full type safety
  - Context-aware logging with `SecureLogger` class

### Documentation Updates

- Updated README.md with security tools and best practices
- Added automated security scanning instructions
- Documented secure logging patterns

### Breaking Changes

None - all changes are backwards compatible with improved security.

### Migration Notes

If you have existing code that logs sensitive data:

```typescript
// Before
console.log('User data:', user);

// After
import { safeLog } from '@/lib/utils/secure-logger';
safeLog('User data', user);
```

### Developer Notes

- All OAuth credentials must now be in `.env` file
- Run security scans before committing: `node scripts/review-code.js <file> security`
- Use `safeLog`, `safeLogEmail`, `safeLogToken` for any logging that might contain sensitive data
