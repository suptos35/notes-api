# Secure Note-Taking Application API (`notes-api`)

A secure, production-grade REST API for a Note-Taking platform featuring role-based access control (User and Admin), strict MongoDB indexing, and optimized aggregation pipelines.

*Note: The API is hosted on Render free tier. Cold starts may take approximately 30 to 60 seconds.*

---

## 1. Local Setup

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- MongoDB (Atlas cluster or local instance)

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd notes-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Running Locally
```bash
# Start server in development mode (with file watching)
npm run dev

# Start server in production mode
npm start

# Run automated test suite
npm test
```

---

## 2. Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the HTTP server | `4000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/secure_notes` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 characters) | *(required)* |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | `http://localhost:5173` |
| `SEED_ADMIN_EMAIL` | Default admin email for seeding | `admin@example.com` |
| `SEED_ADMIN_PASSWORD` | Default admin password for seeding | `Password123!` |
