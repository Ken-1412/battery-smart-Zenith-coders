# AI Ops Copilot - Frontend Dashboard

React dashboard for operations managers to monitor and manage station alerts.

## Features

- ✅ Fetch alerts from backend API
- ✅ Severity badges (LOW/MEDIUM/HIGH/CRITICAL) with color coding
- ✅ Alert detail modal with full information
- ✅ Approve / Reject buttons for pending alerts
- ✅ Auto-refresh every 10 seconds
- ✅ Status filtering (All, Pending, Executed, Dismissed)
- ✅ Responsive design
- ✅ Simple CSS (no heavy UI library)

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx      # Main dashboard component
│   │   ├── AlertCard.jsx      # Individual alert card
│   │   └── AlertModal.jsx     # Alert detail modal
│   ├── services/
│   │   └── api.js             # API service (Axios)
│   ├── App.jsx                 # Root component
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Environment Variables

Create `.env` file:

```bash
VITE_API_URL=http://localhost:3001
```

Or set the API URL in `vite.config.js` proxy configuration.

### Development

```bash
npm run dev
```

Dashboard will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory, ready for S3 + CloudFront deployment.

## Usage

### Viewing Alerts

- Dashboard automatically fetches alerts on load
- Alerts refresh every 10 seconds
- Use filter buttons to view alerts by status

### Making Decisions

1. Click "Approve" or "Reject" button on a pending alert card
2. For rejection, provide a reason in the modal
3. Decision is sent to backend and alert status updates
4. Dashboard automatically refreshes

### Viewing Details

- Click "View Details" on any alert card
- Modal shows full alert information, metadata, and decision history

## API Integration

The dashboard expects the following endpoints:

- `GET /alerts?status={status}&limit={limit}` - Fetch alerts
- `POST /alerts/decision` - Make approve/reject decision

See `src/services/api.js` for implementation.

## Styling

- Pure CSS with no external UI libraries
- Responsive grid layout
- Color-coded severity badges
- Smooth transitions and hover effects
- Mobile-friendly design

## Components

### Dashboard
- Main container component
- Handles data fetching and state management
- Implements auto-refresh logic
- Status filtering

### AlertCard
- Displays alert summary
- Shows severity and status badges
- Approve/Reject buttons for pending alerts
- Opens modal on click

### AlertModal
- Full alert details view
- Shows metadata and recommendations
- Decision form with reason input
- Decision history display
