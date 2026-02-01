# Frontend-Backend Integration Guide

## Complete Integration Overview

The React dashboard is fully integrated with the backend APIs with comprehensive error handling and loading states.

## API Service (`src/services/api.js`)

### Features:
- ✅ Axios-based HTTP client with timeout (30s)
- ✅ Centralized error handling
- ✅ Network error detection
- ✅ Consistent response format: `{ success: boolean, data/error }`

### Endpoints:

**GET /alerts**
```javascript
const result = await alertsApi.getAlerts(status, limit);
// Returns: { success: true, data: { alerts: [...], count, total } }
// Or: { success: false, error: { message, status, data } }
```

**POST /alerts/decision**
```javascript
const result = await alertsApi.makeDecision(alertId, decision, reason);
// Returns: { success: true, data: { message, alert, decision } }
// Or: { success: false, error: { message, status, data } }
```

## Dashboard Component (`src/components/Dashboard.jsx`)

### State Management:
- `alerts`: Array of alert objects
- `loading`: Initial load state
- `refreshing`: Auto-refresh state (every 10s)
- `error`: Error message for display
- `statusFilter`: Current filter (null, 'PENDING', 'EXECUTED', 'DISMISSED')
- `decisionProcessing`: Set of alertIds being processed

### Features:
1. **Fetch Alerts**
   - Fetches on mount and filter change
   - Auto-refreshes every 10 seconds
   - Shows loading state on initial load
   - Shows refreshing indicator during auto-refresh

2. **Error Handling**
   - Displays error message with retry button
   - Handles network errors gracefully
   - Logs errors to console for debugging

3. **Decision Processing**
   - Tracks processing state per alert
   - Prevents duplicate submissions
   - Refreshes alerts after successful decision
   - Shows error alert on failure

## AlertCard Component (`src/components/AlertCard.jsx`)

### Features:
- Displays alert summary
- Shows severity and status badges
- Approve/Reject buttons for pending alerts
- Processing state with disabled buttons
- Opens modal for details

### Loading States:
- Buttons show "Processing..." when `isProcessing` is true
- Buttons disabled during processing
- Prevents multiple clicks

## AlertModal Component (`src/components/AlertModal.jsx`)

### Features:
- Full alert details view
- Decision form with reason input
- Validation for rejection reason
- Processing states on buttons
- Closes automatically after successful decision

## Error Handling Flow

### Network Errors:
```
User Action → API Call → Network Error
  ↓
Error Handler → User-friendly message
  ↓
Display error with retry button
```

### Validation Errors:
```
User Action → API Call → 400 Bad Request
  ↓
Error Handler → Extract error message
  ↓
Alert user with specific error
```

### Server Errors:
```
User Action → API Call → 500 Server Error
  ↓
Error Handler → Generic error message
  ↓
Log to console + Alert user
```

## Loading States

### Initial Load:
```jsx
{loading && <div className="loading">Loading alerts...</div>}
```

### Auto-Refresh:
```jsx
{refreshing ? 'Refreshing...' : `Last refresh: ${time}`}
```

### Decision Processing:
```jsx
<button disabled={isProcessing}>
  {isProcessing ? 'Processing...' : 'Approve'}
</button>
```

## Complete Data Flow

### Fetching Alerts:
```
Dashboard mounts
  ↓
fetchAlerts() called
  ↓
alertsApi.getAlerts() → API request
  ↓
Response: { success: true, data: {...} }
  ↓
setAlerts(data.alerts)
  ↓
Render AlertCards
```

### Making Decision:
```
User clicks Approve/Reject
  ↓
handleDecision(alertId, decision, reason)
  ↓
setDecisionProcessing(alertId) → Disable buttons
  ↓
alertsApi.makeDecision() → API request
  ↓
Response: { success: true, data: {...} }
  ↓
fetchAlerts() → Refresh list
  ↓
setDecisionProcessing(clear) → Enable buttons
```

## Error Recovery

### Retry Mechanism:
- Error display includes retry button
- Clicking retry calls `fetchAlerts(true)`
- Shows loading state during retry

### Network Resilience:
- Auto-refresh continues even after errors
- Errors don't block future requests
- User can manually retry failed requests

## Testing the Integration

### 1. Test Fetch Alerts:
```javascript
// Should fetch and display alerts
// Check browser console for API calls
// Verify loading state appears initially
```

### 2. Test Error Handling:
```javascript
// Disconnect network or use wrong API URL
// Should show error message with retry
// Verify error doesn't crash app
```

### 3. Test Decision Making:
```javascript
// Click Approve on pending alert
// Button should show "Processing..."
// Alert should update to EXECUTED
// List should refresh automatically
```

### 4. Test Auto-Refresh:
```javascript
// Wait 10 seconds
// Status indicator should update
// New alerts should appear automatically
```

## Environment Configuration

### Development:
```bash
# .env file
VITE_API_URL=http://localhost:3001
```

### Production:
```bash
# Set in build environment
VITE_API_URL=https://api.yourdomain.com
```

## API Response Formats

### GET /alerts Response:
```json
{
  "alerts": [
    {
      "alertId": "...",
      "stationId": "STATION_001",
      "alertType": "CONGESTION",
      "severity": "MEDIUM",
      "status": "PENDING",
      "title": "...",
      "description": "...",
      "recommendedAction": "...",
      "createdAt": 1704067200000,
      "decisions": []
    }
  ],
  "count": 1,
  "total": 1,
  "filters": {
    "status": "all",
    "limit": 50
  }
}
```

### POST /alerts/decision Response:
```json
{
  "message": "Alert approved successfully",
  "alert": {
    "alertId": "...",
    "status": "EXECUTED",
    "decisionId": "..."
  },
  "decision": {
    "decisionId": "...",
    "alertId": "...",
    "decision": "APPROVE",
    "status": "EXECUTED",
    "userId": "ops-manager",
    "timestamp": 1704067200000
  }
}
```

## Integration Checklist

- ✅ API service with error handling
- ✅ Loading states (initial, refresh, processing)
- ✅ Error display with retry
- ✅ Decision processing with feedback
- ✅ Auto-refresh every 10 seconds
- ✅ Network error handling
- ✅ Validation error handling
- ✅ Server error handling
- ✅ User-friendly error messages
- ✅ Console logging for debugging

## Troubleshooting

### Alerts not loading:
1. Check API URL in `.env`
2. Verify backend is running
3. Check browser console for errors
4. Verify CORS is configured

### Decisions not working:
1. Check alert status (must be PENDING)
2. Verify API endpoint is correct
3. Check network tab for request/response
4. Verify backend decision endpoint

### Auto-refresh not working:
1. Check browser console for errors
2. Verify interval is not cleared
3. Check if component unmounted
