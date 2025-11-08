# Database Setup - Drizzle ORM

This project uses **Drizzle ORM** with **better-sqlite3** for local SQLite database management.

## Database Location

- SQLite database file: `./sqlite.db` (at project root)
- Schema definition: `src/db/schema.ts`
- Database client: `src/db/index.ts`
- Configuration: `drizzle.config.ts`

## Available Scripts

```bash
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Apply migrations to database
npm run db:push      # Push schema directly (for prototyping)
npm run db:studio    # Open Drizzle Studio (visual database browser)
```

## Current Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `username` | TEXT | Unique username, required |
| `email` | TEXT | Unique email, optional |
| `createdAt` | TIMESTAMP | Account creation time (auto-generated) |
| `lastLogin` | TIMESTAMP | Last login timestamp, optional |
| `preferences` | JSON | User preferences (darkMode, soundEnabled, boardTheme) |

### Lessons Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `title` | TEXT | Lesson title, required |
| `userColor` | TEXT | Player color ('WHITE' or 'BLACK'), required |
| `chapters` | JSON | Array of Chapter objects (title, notes, pgn), required |
| `createdAt` | TIMESTAMP | Lesson creation time (auto-generated) |
| `updatedAt` | TIMESTAMP | Last update time (auto-generated) |

**Chapter JSON Structure:**
```typescript
interface Chapter {
  title: string;
  notes?: string;
  pgn: string;  // PGN notation with variations
}
```

## Usage Examples

### User Queries

```typescript
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Insert a user
const newUser = await db.insert(users).values({
  username: "alice",
  email: "alice@example.com",
  preferences: { darkMode: true, soundEnabled: false }
}).returning();

// Query all users
const allUsers = await db.select().from(users);

// Find by username
const user = await db.select()
  .from(users)
  .where(eq(users.username, "alice"));

// Update last login
await db.update(users)
  .set({ lastLogin: new Date() })
  .where(eq(users.id, 1));

// Delete a user
await db.delete(users).where(eq(users.id, 1));
```

### Lesson Queries

```typescript
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PieceColor } from "@/types/chess";

// Insert a lesson
const newLesson = await db.insert(lessons).values({
  title: "Vienna Game",
  userColor: PieceColor.WHITE,
  chapters: [
    {
      title: "Main Line",
      notes: "The most common continuation",
      pgn: "1. e4 e5 2. Nc3 Nf6 3. f4..."
    },
    {
      title: "Gambit Variation",
      pgn: "1. e4 e5 2. Nc3 Nf6 3. f4 exf4..."
    }
  ]
}).returning();

// Query all lessons
const allLessons = await db.select().from(lessons);

// Find lesson by ID
const lesson = await db.select()
  .from(lessons)
  .where(eq(lessons.id, 1));

// Update lesson
await db.update(lessons)
  .set({
    title: "Vienna Game - Updated",
    updatedAt: new Date()
  })
  .where(eq(lessons.id, 1));

// Delete a lesson
await db.delete(lessons).where(eq(lessons.id, 1));
```

### TypeScript Types

The schema exports type-safe interfaces:

```typescript
import type { User, InsertUser, Lesson, InsertLesson } from "@/db/schema";

// User: Full user object from database
// InsertUser: Type for creating new users (omits auto-generated fields)

// Lesson: Full lesson object from database
// InsertLesson: Type for creating new lessons (omits auto-generated fields)
```

## Adding New Tables

When you need to add more tables (UserProgress, etc.):

1. **Update the schema** in `src/db/schema.ts`:
   ```typescript
   export const lessons = sqliteTable("lessons", {
     id: integer("id").primaryKey({ autoIncrement: true }),
     title: text("title").notNull(),
     // ... more columns
   });
   ```

2. **Generate migration**:
   ```bash
   npm run db:generate
   ```

3. **Apply migration**:
   ```bash
   npm run db:migrate
   ```

## Drizzle Studio

To visually browse and edit your database:

```bash
npm run db:studio
```

This opens a web interface at `https://local.drizzle.studio` where you can:
- View all tables and data
- Run queries
- Edit records
- Inspect relationships

## Development Workflow

### Schema Changes
1. Edit `src/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply it

### Quick Prototyping
For rapid iteration during development, use:
```bash
npm run db:push
```
This pushes schema changes directly without creating migration files.

## Notes

- The database file (`sqlite.db`) should be added to `.gitignore`
- Migration files in `drizzle/` directory should be committed to version control
- For production, consider migrating to PostgreSQL (Drizzle supports it seamlessly)
