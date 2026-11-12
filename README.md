# Kanban Task Board

A responsive Kanban board for creating tasks, assigning team members, organizing work with labels, and tracking deadlines. Built with React, TypeScript, Vite, and Supabase.
**Live application:** https://np-task-board-challenge.vercel.app/

## Features

- Four task statuses: To Do, In Progress, In Review, and Done.
- Drag-and-drop status changes, with a status selector in task details for keyboard and mobile use.
- Task creation and editing with descriptions, priorities, and optional due dates.
- Team members with colored avatars and multiple assignees per task.
- Custom colored labels and combined filters for status, label, assignee, and priority.
- Task search and alphabetical sorting.
- Timestamped task comments and a workspace-wide comments overview.
- Upcoming deadlines with overdue and due-soon indicators.
- Automatic anonymous sign-in and guest-specific data protected by Row Level Security (RLS).
- Local demo storage when Supabase configuration is absent.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Styling | CSS with responsive layouts |
| Drag and drop | dnd-kit |
| Database and authentication | Supabase PostgreSQL and Auth |
| Testing | Vitest and PGlite |

## Getting Started

### Prerequisites

- Node.js 22.12 or newer.
- npm.
- A Supabase project for persistent guest data.

### Install Dependencies

From the project directory:

```sh
npm ci
```

### Configure Supabase

1. Create a Supabase project and enable anonymous sign-ins in its authentication settings.
2. Open the Supabase SQL Editor and run [supabase/schema.sql](supabase/schema.sql) once for a new database.
3. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-key
```

`VITE_SUPABASE_ANON_KEY` accepts a Supabase publishable key or the legacy public anon key. Use a public frontend key, never a secret or service-role key. `.env.local` is excluded from version control.

### Start the App

```sh
npm run dev
```

Open the local URL printed in the terminal. Vite selects another port if the default port is occupied. Restart the development server after changing environment variables.

Without Supabase configuration, the app uses sample tasks and browser-local storage. Demo data is separate from Supabase data and is not uploaded automatically.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Check TypeScript and produce a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the automated test suite |

## Database

| Table | Purpose |
| --- | --- |
| `tasks` | Task title, status, description, priority, due date, owner, primary assignee, and creation time |
| `team_members` | Names and avatar colors for task assignees |
| `labels` | Custom label names and colors |
| `task_assignees` | Multiple team-member assignments per task |
| `task_labels` | Multiple labels per task |
| `comments` | Timestamped comments associated with tasks |

The `save_task` database function saves task fields and assignment/label selections in one transaction. It runs with the caller's permissions. Owner-based RLS policies and composite foreign keys prevent relationships between different guests' records.

The first selected assignee is stored in `tasks.assignee_id`; all assignments are stored in `task_assignees`. The UI displays Medium priority while the database stores it as `normal`.

## Project Structure

```text
src/
  components/       Task editor and shared visual components
  hooks/            Guest-session and board-data logic
  lib/              Supabase client, board model, sample data, and unit tests
  App.tsx           Board layout, navigation, filters, and panels
  styles.css        Application styling
supabase/
  schema.sql        Complete schema for a new database
tests/
  schema.test.ts    PostgreSQL schema and RLS checks
public/             Static assets
```

## Testing

```sh
npm test
npm run build
```

Automated tests cover guest-session reuse and retries, due-date boundaries, combined filters, legacy demo-task normalization, database relationships, atomic saves and guest isolation. Database tests run locally with PGlite and simulated authentication roles; they do not require Supabase credentials.

For a deployed environment, also verify persistence after refresh and isolation between separate browser profiles.

## Deployment

Deploy as a static Vite app on a compatible hosting service:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Set the environment variables before building. Values prefixed with `VITE_` are included in the browser bundle, so only public configuration belongs there.

## Usage Notes

- Guest identity belongs to the browser's stored session. Clearing site data or switching browsers creates a different guest workspace.
- Team members are assignee records within one guest's workspace, not invited users or shared accounts.
- Due-soon warnings cover today through the next three calendar days. Completed tasks are excluded from Upcoming events.
- Status changes persist, but manual ordering within a column is not stored.
