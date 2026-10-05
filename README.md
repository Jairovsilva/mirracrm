# MirraCRM

> A modern B2B CRM built to organize leads, sales pipelines, team workflows, analytics, and customer relationship operations in one application.

MirraCRM is a full-stack CRM project developed with **Next.js, React, TypeScript, Supabase, Zustand, Tailwind CSS, Radix UI, Recharts, Zod, and React Hook Form**.

The repository demonstrates hands-on work across application architecture, authentication, persistent data, state management, business workflows, analytics, UI development, debugging, and iterative product development.

## Engineering Highlights

- Full-stack CRM built with **Next.js 13 + React + TypeScript**
- Persistent backend and authentication powered by **Supabase**
- Global application state managed with **Zustand**
- B2B lead and sales pipeline workflows
- Dashboard and commercial performance analytics
- Team and user-management flows
- Responsive component-based UI
- Form validation using **Zod** and **React Hook Form**
- Data visualization with **Recharts**
- Type checking and linting included in the development workflow
- Real-world debugging of authentication, session propagation, and Row Level Security behavior

## Core Product Areas

The application currently includes the following main areas:

- **Dashboard** — commercial overview and operational KPIs
- **Sales Funnel** — pipeline management using a Kanban-style workflow
- **Leads** — lead and customer record management
- **Reports** — commercial analytics and performance indicators
- **Team** — user and team-management workflows
- **Settings** — application and account configuration
- **AI Assistant** — contextual guidance for lead management, prospecting, qualification, follow-up, negotiation, and CRM usage

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Framework | Next.js 13 |
| Language | TypeScript |
| UI | React 18, Tailwind CSS, Radix UI |
| State Management | Zustand |
| Backend / Database | Supabase |
| Authentication | Supabase Auth |
| Forms | React Hook Form |
| Validation | Zod |
| Data Visualization | Recharts |
| Dates | date-fns |
| PDF / Export | jsPDF, XLSX |
| Tooling | ESLint, TypeScript |

## Application Architecture

```text
                  ┌──────────────────────────┐
                  │        Next.js App       │
                  └────────────┬─────────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      React UI Layer     Zustand CRM Store    API Routes
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                               ▼
                         Supabase Client
                               │
                   ┌───────────┴───────────┐
                   ▼                       ▼
              Authentication            Database
```

The application separates presentation, state, business logic, API operations, and persistence. Supabase is used to provide authenticated, persistent CRM data across sessions and devices.

## CRM State & Persistence

The central CRM state is handled through a Zustand store and synchronized with Supabase.

The data layer includes operations involving records such as:

- leads
- user profiles
- authentication sessions
- team-related information

This architecture allows the application to move beyond browser-local state and maintain persistent CRM information across authenticated sessions.

## Authentication & Session Management

Authentication is integrated with Supabase Auth.

One of the engineering issues addressed in the project involved a registration-flow timing problem where protected database operations could occur before the authenticated Supabase session was fully available.

This resulted in **Row Level Security (RLS) error 42501** during registration.

The flow was adjusted to explicitly synchronize the authenticated session before protected operations were executed.

This work involved:

- diagnosing authentication state timing
- tracing protected database operations
- understanding Supabase session behavior
- working with Row Level Security constraints
- updating application state after authentication
- validating session-aware database access

## Dashboard & Analytics

MirraCRM includes commercial metrics derived from CRM data.

Examples implemented in the application include:

- total leads
- hot leads
- pipeline value
- conversion rate
- activity volume

The analytics layer derives these indicators from application data and presents them through reusable dashboard and reporting components.

## Sales Pipeline

The CRM includes a structured sales-funnel workflow.

Users can navigate between:

```text
Dashboard
   │
   ├── Sales Funnel
   ├── Leads
   ├── Reports
   ├── Team
   └── Settings
```

The sales pipeline is designed to help teams organize leads through commercial stages and monitor progress through the funnel.

## AI Assistant

The project contains an AI-assistant component focused on practical CRM guidance.

Its context covers topics including:

- lead management
- sales pipeline strategy
- prospecting
- lead qualification
- follow-up
- B2B negotiations
- CRM usage

The assistant is designed not to fabricate user CRM data and instead provides contextual best-practice guidance.

## Engineering Challenges

### 1. Authentication and RLS troubleshooting

A session-latency issue in the account-registration flow caused database requests to encounter Supabase Row Level Security restrictions.

The solution required explicitly synchronizing the authenticated session before continuing with protected CRM operations.

### 2. Persistent state across sessions

The application uses Supabase-backed persistence rather than relying exclusively on local browser state, allowing CRM data to remain available across browsers and devices.

### 3. Coordinating application and authentication state

The project includes explicit handling for authentication lifecycle events such as login, active-session recovery, and logout to keep frontend state aligned with Supabase.

### 4. Commercial metrics from live CRM records

Dashboard and report views calculate business indicators from current CRM records rather than static display values.

## Project Structure

```text
mirracrm/
├── app/                     # Next.js application and API routes
├── components/              # Shared UI components
├── src/
│   ├── components/          # CRM interface and feature components
│   ├── lib/                 # Supabase client and application utilities
│   └── store/               # Zustand CRM state
├── types/                   # TypeScript definitions
├── public/                  # Static assets
├── package.json             # Dependencies and scripts
├── tailwind.config.ts       # Tailwind configuration
└── tsconfig.json            # TypeScript configuration
```

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run TypeScript validation:

```bash
npm run typecheck
```

Run linting:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Environment Configuration

The application uses Supabase environment variables.

A local environment requires values such as:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> Secrets and production credentials must never be committed to the repository.

## What This Repository Demonstrates

From an engineering perspective, MirraCRM demonstrates practical experience with:

- TypeScript application development
- React component architecture
- Next.js application structure
- client/server integration
- REST-style API routes
- authentication workflows
- database-backed persistence
- application state management
- debugging production-style issues
- Row Level Security troubleshooting
- business-rule implementation
- dashboard and analytics development
- reusable UI design
- form validation
- iterative feature development

## Current Status

MirraCRM is under active development.

The codebase continues to evolve through feature implementation, UX improvements, backend integration, debugging, and production-readiness work.

---

**MirraCRM** — B2B sales intelligence, lead management, and commercial workflow organization.
