# SafarSorted API Backend

Backend API for SafarSorted travel website, deployed on Render.com.

## Setup

1. Push this folder to a separate GitHub repository
2. Connect to Render.com
3. Set environment variables:
   - `ADMIN_USER` - Admin username (default: admin)
   - `ADMIN_PASS` - Admin password (default: safarsorted123)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/inquiry` | Submit new inquiry |
| GET | `/api/admin/inquiries` | Get all inquiries (auth required) |
| PUT | `/api/admin/inquiries/:id` | Update inquiry |
| DELETE | `/api/admin/inquiries/:id` | Delete inquiry |
| GET | `/api/admin/stats` | Get statistics |

## Local Development

```bash
npm install
npm start
```

Server runs on http://localhost:3000
