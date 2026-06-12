# 📝 Notes App

A full-stack notes application with user authentication, tags, search, and pin functionality.

**Live Demo:** https://notes-app-ddue.onrender.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Auth | JWT + bcryptjs |
| Hosting | Render (app + database) |

---

## Features

- **Authentication** — Register and login with JWT-based sessions (7-day expiry)
- **Notes CRUD** — Create, read, update, and delete notes
- **Pin Notes** — Pin important notes to keep them at the top
- **Tags** — Create colour-coded tags and attach multiple tags to notes
- **Search** — Real-time search across note titles and content (debounced 300ms)
- **Tag Filter** — Filter notes by tag from the sidebar
- **Persistent Storage** — All data stored in PostgreSQL, survives restarts
- **Responsive UI** — Collapses to single column on mobile (< 768px)

---

## Project Structure

```
notes-app/
├── frontend/
│   ├── index.html       # Main app layout (sidebar + note list + editor)
│   ├── auth.html        # Login / Register page
│   ├── style.css        # Full light-theme styles with CSS variables
│   └── app.js           # All client-side logic
├── backend/
│   ├── routes/
│   │   ├── auth.js      # POST /api/auth/register, /api/auth/login
│   │   ├── notes.js     # Full notes CRUD + pin + search + tag filter
│   │   └── tags.js      # Tags CRUD
│   ├── middleware/
│   │   └── auth.js      # JWT verification middleware
│   ├── db/
│   │   ├── schema.sql   # PostgreSQL table definitions
│   │   └── db.js        # pg Pool connection (supports DATABASE_URL)
│   └── index.js         # Express app entry point
├── .env                 # Local environment variables (not committed)
├── .gitignore
└── package.json
```

---

## Database Schema

```sql
users       — id, username, email, password_hash, created_at
notes       — id, user_id, title, content, is_pinned, created_at, updated_at
tags        — id, user_id, name, color
note_tags   — note_id, tag_id  (junction table)
```

---

## API Reference

### Auth
| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, email, password }` | Register new user |
| POST | `/api/auth/login` | `{ email, password }` | Login, returns JWT |

### Notes *(all require `Authorization: Bearer <token>`)*
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notes` | Get all notes (supports `?q=search` and `?tag=name`) |
| GET | `/api/notes/:id` | Get single note with tags |
| POST | `/api/notes` | Create note — body: `{ title, content, tagIds[] }` |
| PUT | `/api/notes/:id` | Update note — body: `{ title, content, tagIds[] }` |
| DELETE | `/api/notes/:id` | Delete note |
| PUT | `/api/notes/:id/pin` | Toggle pin on/off |

### Tags *(all require `Authorization: Bearer <token>`)*
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tags` | Get all tags for current user |
| POST | `/api/tags` | Create tag — body: `{ name, color }` |
| DELETE | `/api/tags/:id` | Delete tag |

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL installed and running locally

### Setup

```bash
# Clone the repo
git clone https://github.com/Mahekyadav/Notes-app.git
cd Notes-app

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Fill in your local PostgreSQL credentials in .env

# Start the server
npm start
```

Open http://localhost:5000

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/notes_app
JWT_SECRET=your_secret_key_here
PORT=5000
```

> If `DATABASE_URL` is set, individual `DB_*` variables are ignored.

---

## Deployment (Render)

1. Push code to GitHub
2. Create a **PostgreSQL** database on Render (free tier)
3. Create a **Web Service** on Render, connect the GitHub repo
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables in the Web Service settings:
   - `DATABASE_URL` — External Database URL from your Render PostgreSQL instance
   - `JWT_SECRET` — Any long random string
5. Deploy — tables are created automatically on first start

---

## Scripts

```bash
npm start   # Run with node
npm run dev # Run with nodemon (auto-restart on file changes)
```

---

## Screenshots

| Auth Page | Notes App |
|---|---|
| Login / Register card | Two-column layout with sidebar, note list, and editor |
