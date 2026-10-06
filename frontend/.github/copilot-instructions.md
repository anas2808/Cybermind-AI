# CyberMind AI Frontend Instructions

## Project
CyberMind AI is an AI-powered intelligent security analyst platform.

## UI principles
- Build a professional cybersecurity SaaS interface.
- Use the approved CyberMind AI visual design.
- Do not introduce arbitrary colors.
- Primary accent: #217EAA
- Secondary accent: #7D9CB7
- Muted text: #8CA4AC
- Main text: #EEEEEE
- High-emphasis text: #F2F2F3
- Use dark neutral backgrounds.
- Avoid excessive gradients.
- Avoid unnecessary animations.
- Maintain strong visual hierarchy.
- Design mobile-first and make every screen responsive.

## Authentication
- Supabase is the authentication provider.
- Email/password authentication must use the existing Supabase client.
- Google authentication uses Supabase OAuth.
- GitHub authentication uses Supabase OAuth.
- Never expose Supabase secret/service-role keys in frontend code.
- Only VITE_* public environment variables may be used in React.

## Architecture
- Keep authentication UI separate from authentication logic.
- Reuse the existing src/lib/supabase.ts client.
- Do not duplicate Supabase client creation.
- Keep reusable UI components in src/components/.
- Keep authentication pages/components organized under an auth-related structure.
- Do not modify backend code when implementing frontend authentication.

## UX
- Show loading states during authentication.
- Disable submit buttons while requests are running.
- Display useful authentication errors.
- Validate email format.
- Validate password requirements.
- Validate password confirmation during registration.
- Provide clear Login ↔ Registration navigation.
- Support keyboard navigation.
- Maintain accessible labels and focus states.

## Security
- Never hardcode passwords, tokens, API keys, or secrets.
- Never log authentication tokens.
- Do not store sensitive credentials in localStorage manually.
- Use the Supabase session mechanism.

## Existing functionality
Do not remove or replace existing working functionality unless explicitly requested.