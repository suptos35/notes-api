# Secure Note-Taking Application API (`notes-api`)

![CI](https://github.com/suptos35/notes-api/actions/workflows/ci.yml/badge.svg)

A production-grade, secure REST API engineered for a multi-tenant Note-Taking platform featuring role-based access control (User and Admin), strict MongoDB indexing with a 4-custom-index budget, and optimized aggregation pipelines.

*Note: The API is hosted on Render's free tier. Cold starts take approximately 30 to 60 seconds on initial wake-up.*

* **Live Frontend URL**: [https://notes-web-omega.vercel.app](https://notes-web-omega.vercel.app)
* **Live Backend API URL**: [https://notes-api-service.onrender.com](https://notes-api-service.onrender.com)

---

## 1. Local Setup

### Prerequisites
* Node.js >= 20.x
* npm >= 10.x
* MongoDB (Local instance or MongoDB Atlas M0 cluster)

### Installation & Execution
```bash
# Clone the repository
git clone <repo-url>
cd notes-api

# Install dependencies
npm install

# Configure local environment
cp .env.example .env

# Verify database indexes and explain plans
npm run verify

# Run automated test suite (17 tests)
npm test

# Seed database with sample users, notes, and posts
npm run seed

# Run local development server
npm run dev
```

### Environment Variables (`.env.example`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Local HTTP port | `4000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/secure_notes` |
| `JWT_SECRET` | Secret key for HS256 JWT signing (min 32 chars) | `super_secret_jwt_key_at_least_32_chars_long!!` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | `http://localhost:5173` |
| `SEED_ADMIN_EMAIL` | Seed admin email address | `admin@example.com` |
| `SEED_ADMIN_PASSWORD`| Seed admin password | `Password123!` |

---

## 2. Seed Credentials

When seeded via `npm run seed`:
* **Admin Account**: `admin@example.com` / `Password123!`
* **Sample User Account**: `user1@example.com` / `Password123!` (Users `user1@example.com` through `user40@example.com` are available)

---

## 3. Database Indexing Strategy

### The 4 Custom Index Budget

To avoid unnecessary memory and write overhead, this application operates under a strict budget of **exactly 4 custom indexes** across the database (plus the default `_id` index on each collection):

1. `users`: `{ email: 1 }` (unique)
2. `users`: `{ interests: 1 }` (multikey)
3. `notes`: `{ owner: 1, _id: -1 }` (compound)
4. `posts`: `{ author: 1, _id: -1 }` (compound)

### Index Justification Table

| Query / Operation | Index Used | Rationale |
| :--- | :--- | :--- |
| Login by email / Duplicate registration check | `users { email: 1 }` (unique) | Fast O(1) equality lookup by email. |
| Get user by id (profile, auth middleware) | default `_id` | Standard primary key lookup. |
| Admin list users (sorted by `_id` desc, keyset cursor) | default `_id` | Utilizes the natural chronological order of MongoDB ObjectIds. |
| Get note by id with owner check | default `_id` | Direct primary key fetch; owner equality verified in application or query filter. |
| User lists own notes | `notes { owner: 1, _id: -1 }` | Compound index fits ESR rule (Equality on `owner`, Sort on `_id` desc). |
| Admin lists all notes | default `_id` | Unfiltered list sorted by `_id` desc walks the default `_id` index in reverse. |
| Admin filters notes by owner | `notes { owner: 1, _id: -1 }` | Equality filter on `owner` with keyset sort on `_id` desc. |
| Public feed of all posts | default `_id` | Unfiltered list sorted by `_id` desc walks the default `_id` index in reverse. |
| Scenario 1: Group by interests | `users { interests: 1 }` | Multikey index accelerates the leading `$match` stage. |
| Scenario 2: User posts via `$lookup` | `posts { author: 1, _id: -1 }` | Foreign collection lookup equality on `author` + `_id` descending sort. |
| Cascade delete user notes & posts | Compound indexes above | Fast bulk deletion: `deleteMany({ owner: id })` and `deleteMany({ author: id })`. |

### Deliberate Non-Indexes & Why `_id` Keyset Pagination Beats Skip/Limit
* **Why `_id` instead of `createdAt` for sorting**: MongoDB ObjectIds begin with a 4-byte Unix timestamp. Sorting descending on `_id` naturally produces reverse-chronological order without requiring an extra index on `createdAt`. Keyset pagination using `{ _id: { $lt: cursor } }` avoids the O(N) offset scanning penalties of skip/limit.
* **What was deliberately NOT indexed**:
  * No `createdAt` indexes (superseded by `_id`).
  * No `role` index (low cardinality; admin listing walks `_id`).
  * No text/search indexes (unneeded for the required queries).
  * No unbounded query filters allowed on list endpoints.

---

## 4. Aggregations (Scenario 1 & Scenario 2)

### Scenario 1: Group Users by Interests (`GET /api/interests`)

* **Pipeline**:
  1. `$match`: Leading filter on `interests: interest` (equality) or `interests: { $gt: '' }` (range scan skipping empty interest arrays). **Uses multikey index `users { interests: 1 }`**.
  2. `$unwind`: Deconstructs the `interests` array.
  3. `$match` *(conditional)*: When filtering by a single interest, filters again post-unwind to prevent emitting other interests of matching users.
  4. `$group`: Groups by `_id: '$interests'`, computes total user `count: { $sum: 1 }`, and pushes user previews `users: { $push: { _id: '$_id', name: '$name' } }`.
  5. `$sort`: Orders groups alphabetically by interest name (`_id: 1`).
  6. `$facet`: Computes paginated `groups` with `{ $slice: ['$users', 20] }` and total group count in a single aggregation pass.
* **Honest Index Assessment**: `$group` and `$sort` stages following `$unwind` cannot utilize an index because unwinding produces temporary in-memory streams. The index is strictly and effectively utilized by the leading `$match` stage to eliminate non-matching documents before processing.

### Scenario 2: User Posts via `$lookup` (`GET /api/users/:id/posts`)

* **Pipeline**:
  1. `$match`: Matches the user by `_id`. **Uses default `_id` index**.
  2. `$project`: Selects user name (`name: 1`).
  3. `$lookup`: Correlates with the `posts` collection using `localField: '_id'` and `foreignField: 'author'`, with an inner `pipeline` executing `{ $sort: { _id: -1 } }` and `{ $limit: limit + 1 }`. **Uses compound index `posts { author: 1, _id: -1 }`**.
* Single aggregation pass without secondary queries.

---

## 5. Execution Explain Plans (`npm run verify`)

Trimmed `executionStats` captured via `scripts/verify-indexes.js`:

```
================ DECLARED INDEXES ================
User: _id_, email_1 (unique), interests_1
Note: _id_, owner_1__id_-1
Post: _id_, author_1__id_-1

================ QUERY EXPLAIN PLANS ================
Query: 1. Login by email (users {email:1})
 - Winning Stage: IXSCAN
 - Index Name: email_1
 - totalDocsExamined: 1, nReturned: 1

Query: 2. Get user by id (default _id)
 - Winning Stage: IDHACK
 - totalDocsExamined: 1, nReturned: 1

Query: 3. Admin list users (keyset cursor, default _id)
 - Winning Stage: FETCH
 - totalDocsExamined: 1, nReturned: 1

Query: 4. Get note by id with owner check (default _id)
 - Winning Stage: IXSCAN (_id_)

Query: 5. User lists own notes (notes {owner:1,_id:-1})
 - Winning Stage: FETCH (via compound index owner_1__id_-1)
 - totalDocsExamined: 1, nReturned: 1

Query: 7. Admin filters notes by owner (notes {owner:1,_id:-1})
 - Winning Stage: FETCH (via compound index owner_1__id_-1)

Query: 9. Scenario 1: Group by interests (users {interests:1})
 - Leading Cursor Stage: FETCH / IXSCAN on interests_1

Query: 10. Scenario 2: User posts via $lookup (posts {author:1,_id:-1})
 - Leading Cursor Stage: IDHACK on user _id, foreign lookup uses author_1__id_-1
```

---

## 6. Security Decisions

* **httpOnly Cookies vs. localStorage**: Tokens are stored in an `httpOnly`, `SameSite=Lax` cookie. Client-side JavaScript cannot access the token, neutralizing XSS credential theft.
* **Vercel Reverse Proxy Architecture**: In production, frontend (Vercel) rewrites `/api/*` requests to the backend (Render). The browser only communicates with its own origin, making the cookie first-party and avoiding Safari/Chrome third-party cookie blocking without requiring `SameSite=None`.
* **CSRF Protection (`csrfGuard`)**:
  * `SameSite=Lax` cookie policy.
  * For mutating methods (`POST`, `PATCH`, `PUT`, `DELETE`), if an `Origin` header is present, it is checked against `CORS_ORIGINS` (returns 403 on untrusted origins).
  * Enforces `Content-Type: application/json` for requests with bodies (returns 415 otherwise).
* **Database-Sourced Roles**: On every authenticated request, `authenticate` loads the user record from the database by `_id`. Role changes, password changes, or account deletions take effect instantly without waiting for JWT expiry.
* **Constant-Time Login Defense**: When an unknown email attempts login, bcrypt still computes against a dummy cost-12 hash, preventing timing attacks from revealing registered emails.
* **404 Instead of 403 on Note Access**: Non-owners attempting to access another user's note receive 404 Not Found to prevent confirming the existence of resources.
* **Algorithm Pinning**: JWT signing and verification are pinned strictly to `HS256`.

---

## 7. API Specification

Base Path: `/api`. All responses JSON.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Service health check (`{ ok: true, db: true }`) |
| `POST` | `/api/auth/register` | None | Register new user (always role `user`) & sets cookie |
| `POST` | `/api/auth/login` | None | Authenticate with email & password & sets cookie |
| `POST` | `/api/auth/logout` | None | Clears auth cookie (204) |
| `GET` | `/api/users/me` | User | Get authenticated user profile |
| `PATCH`| `/api/users/me` | User | Update name and normalized interests |
| `GET` | `/api/users/:id` | User | Get public user profile |
| `GET` | `/api/users/:id/posts`| None | **Scenario 2**: Paginated posts for a user via `$lookup` |
| `GET` | `/api/notes` | User | List own notes (keyset paginated) |
| `POST` | `/api/notes` | User | Create a new note |
| `GET` | `/api/notes/:id` | User | Get single note (admin can view any; user only own) |
| `PATCH`| `/api/notes/:id` | User | Update own note (owner only) |
| `DELETE`| `/api/notes/:id`| User | Delete own note (owner only) |
| `GET` | `/api/posts` | None | Public feed of all posts (keyset paginated) |
| `POST` | `/api/posts` | User | Create a public post |
| `GET` | `/api/interests` | User | **Scenario 1**: Users grouped by interests |
| `GET` | `/api/admin/users` | Admin | List all users (keyset paginated) |
| `POST` | `/api/admin/users`| Admin | Create user with chosen role |
| `GET` | `/api/admin/users/:id`| Admin | Get single user details |
| `PATCH`| `/api/admin/users/:id`| Admin | Update user (prevents admin self-demotion) |
| `DELETE`| `/api/admin/users/:id`| Admin | Delete user + cascade delete notes & posts (prevents self-delete) |
| `GET` | `/api/admin/notes` | Admin | List all notes with optional `?owner=<id>` filter |

---

## 8. Automated Testing

Run the test suite using Node's built-in test runner with in-memory MongoDB:
```bash
npm test
```

### Test Coverage Summary (17 tests across 6 files)
* **`test/indexes.test.js`**: Asserts exact index key sets on all collections to enforce the 4-custom-index budget.
* **`test/auth.test.js`**: Verifies role restriction on register, httpOnly cookie generation, timing attack defense, deleted user 401 response, cookie clearing on logout, and CSRF Origin protection.
* **`test/rbac.test.js`**: Asserts 403 on all `/api/admin` routes for regular users, and verifies admins cannot edit/delete another user's note.
* **`test/pagination.test.js`**: Confirms stable keyset cursor pagination with 25 items across 3 pages without duplicates or gaps, clamp limit behavior, and ownership 404 returns.
* **`test/admin.test.js`**: Validates self-demotion and self-deletion prevention, cascade deletion of child notes/posts, and duplicate email 409 handling.
* **`test/aggregations.test.js`**: Tests Scenario 1 case-insensitive grouping, filtering, and count accuracy; tests Scenario 2 single-aggregate `$lookup` pagination and 404 handling.

---

## 9. Known Limitations

* **Session Expiry**: Access tokens expire after 1 hour (refresh token rotation is deliberately omitted in this iteration to keep token management lean).
* **Password Recovery**: Self-service email password resets are not implemented; password updates are managed via user profile or admin management.
