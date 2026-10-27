# CallPilot — Cold Call Assistant

CallPilot is a web application designed to guide callers through the eight stages of a cold call. It helps users structure conversations, record prospect responses, receive AI-powered recommendations, and maintain a history of completed calls.

## Live Application

- **Frontend:** https://cold-call-assistant-five.vercel.app
- **Backend API:** https://callpilot-api-odtr.onrender.com
- **Health Check:** https://callpilot-api-odtr.onrender.com/api/health
- **GitHub Repository:** https://github.com/RohanThakur1927/cold-call-assistant

## Features

- **Eight-stage call guidance:** Navigate through the stages of a cold call.
- **AI-powered recommendations:** Use Gemini to receive suggestions based on the prospect's responses.
- **Call outcome tracking:** Record the outcome of each conversation.
- **Call history:** Save and review previously completed calls.
- **Follow-up management:** Track calls that require follow-up.
- **Prospect details:** Record prospect names and company information.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | Supabase |
| AI integration | Google Gemini API |
| Frontend deployment | Vercel |
| Backend deployment | Render |

## Architecture

1. The React frontend provides the interface for guiding and recording calls.
2. The frontend communicates with the Express backend through REST API endpoints.
3. The backend interacts with Supabase to store and retrieve call information.
4. The backend uses the Gemini API to generate AI-powered recommendations.

The Gemini API key and Supabase service-role key are configured on the backend and should never be exposed in frontend code or committed to the repository.

## Running Locally

### Prerequisites

- Node.js and npm
- A Supabase project
- A Gemini API key

### Frontend

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

### Backend

Navigate to the backend directory:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables in `server/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend:

```bash
npm start
```

**Security note:** Replace the example values with your own credentials. Never commit `.env` files or secret API keys to GitHub.

## API Health Check

The backend health endpoint is:

`https://callpilot-api-odtr.onrender.com/api/health`

It can be used to check whether the deployed backend is responding.

## Future Improvements

- More detailed call analytics.
- Enhanced follow-up reminders.
- Improved call summaries and reporting.
- Additional AI-assisted insights.

---

*CallPilot is a project demonstrating a full-stack application with AI integration, database persistence, and cloud deployment.*
