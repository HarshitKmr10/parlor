# Duplicate Meeting Detection Feature

## Overview

This feature prevents duplicate bots from joining the same meeting when multiple requests are made with the same meeting URL. Instead of creating a new bot, the system links the duplicate request to the existing ongoing meeting and provides transcripts from the request time onwards.

## How It Works

### 1. URL Normalization

When a meeting request is received, the system normalizes the meeting URL to extract the core meeting identifier, removing tracking parameters and other non-essential parts:

**Examples:**

- **Zoom:**
  - `https://zoom.us/j/123456789?pwd=abc&trackingId=xyz` → `zoom://123456789?pwd=abc`
  - `https://us02web.zoom.us/j/123456789?pwd=abc` → `zoom://123456789?pwd=abc`

- **Teams:**
  - `https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc?context=...` → `teams://19%3ameeting_abc`
  - `https://teams.live.com/l/meetup-join/19%3ameeting_abc` → `teams://19%3ameeting_abc`

- **Google Meet:**
  - `https://meet.google.com/abc-defg-hij?authuser=0` → `googlemeet://abc-defg-hij`
  - `https://meet.google.com/abc-defg-hij?hs=224` → `googlemeet://abc-defg-hij`

### 2. Duplicate Detection

When creating a new meeting:

1. The system normalizes the incoming meeting URL
2. Checks if there's an existing **ongoing** meeting with the same normalized URL (for the same organization)
3. If found:
   - Creates a new `meeting_joiner` record linked to the original
   - Sets `is_duplicate: true` and `original_meeting_id` pointing to the original meeting
   - Immediately marks status as `ongoing` (since bot is already in the meeting)
   - Records `bot_join_time` as the current timestamp (duplicate request time)
4. If not found:
   - Creates a new original meeting record normally
   - Bot will join the meeting as usual

### 3. Transcript Filtering

For duplicate meetings:

- Transcripts are filtered to only include entries **from the duplicate request time onwards**
- The `bot_join_time` field stores when the duplicate request was made
- Transcript updates automatically filter based on this timestamp
- Original meeting receives full transcripts; duplicates receive time-filtered transcripts

### 4. Transcript Synchronization

When the original meeting's transcript is updated:

1. The update is applied to the original meeting normally
2. System automatically syncs transcript to all linked duplicate meetings
3. Each duplicate receives only transcript entries after their respective `bot_join_time`
4. Participants list is also synced to all duplicates

## Database Schema Changes

### New Fields in `meeting_joiner` Table

```sql
normalized_meeting_url  VARCHAR     -- Normalized URL for matching
is_duplicate            BOOLEAN     -- Whether this is a duplicate request
original_meeting_id     UUID        -- Reference to original meeting (if duplicate)
```

### New Indexes

```sql
meeting_joiner_normalized_meeting_url_idx  -- For fast duplicate lookup
meeting_joiner_original_meeting_id_idx     -- For finding linked duplicates
```

### Self-Referencing Relationship

```prisma
model meeting_joiner {
  // ...
  original_meeting meeting_joiner?   @relation("DuplicateMeetings", fields: [original_meeting_id], references: [id])
  duplicates       meeting_joiner[]  @relation("DuplicateMeetings")
  // ...
}
```

## API Changes

### POST `/meetings` - Create Meeting

**Response includes new fields:**

```json
{
  "meeting_id": "660f9511-f30c-52e5-b827-557766551111",
  "status": "ongoing",
  "queued_at": "2024-01-15T10:05:00Z",
  "message": "Linked to existing ongoing meeting - transcripts will be provided from request time onwards",
  "is_duplicate": true,
  "original_meeting_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Key Points:**
- `is_duplicate: true` indicates this request was linked to an existing meeting
- `status: "ongoing"` shows the meeting is already active
- `original_meeting_id` references the original meeting
- Message clearly explains what happened

### GET `/meetings?meeting_id={id}` - Get Meeting Status

**Response includes duplicate information:**

```json
{
  "meeting_id": "660f9511-f30c-52e5-b827-557766551111",
  "status": "ongoing",
  "meeting_url": "https://zoom.us/j/123456789?pwd=abc",
  "created_at": "2024-01-15T10:05:00Z",
  "bot_join_time": "2024-01-15T10:05:00Z",
  "participant_count": 5,
  "transcript_entries": 12,
  "is_duplicate": true,
  "original_meeting_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Implementation Files

### JavaScript (Node.js Service)

- **`src/shared/urlNormalizer.js`** - URL normalization logic
- **`src/services/meetingJoinerService.js`** - Duplicate detection and transcript syncing
- **`tests/test_url_normalizer.js`** - JavaScript tests

### Python (FastAPI Service)

- **`src/shared/url_normalizer.py`** - URL normalization logic
- **`src/api/database/connection.py`** - Database operations with duplicate detection
- **`src/api/models/schemas.py`** - Updated response schemas
- **`src/main.py`** - API endpoints with duplicate response handling
- **`tests/test_url_normalizer.py`** - Python tests

### Database

- **`db/bootstrap.sql`** - `is_duplicate` / `original_meeting_id` columns and indexes on `meeting_joiner`

## Usage Example

### Scenario: Two requests for the same Zoom meeting

**Request 1** (10:00 AM):
```bash
POST /meetings
{
  "meeting_url": "https://zoom.us/j/123456789?pwd=abc",
  "org_id": "org-uuid",
  "bot_name": "Meeting Bot"
}
```

**Response 1:**
```json
{
  "meeting_id": "meeting-uuid-1",
  "status": "not_joined",
  "message": "Meeting created and queued for processing",
  "is_duplicate": false
}
```

Bot joins at 10:01 AM, transcript starts recording.

---

**Request 2** (10:05 AM) - Same meeting URL:
```bash
POST /meetings
{
  "meeting_url": "https://zoom.us/j/123456789?pwd=abc&trackingId=xyz",
  "org_id": "org-uuid",
  "bot_name": "Meeting Bot"
}
```

**Response 2:**
```json
{
  "meeting_id": "meeting-uuid-2",
  "status": "ongoing",
  "message": "Linked to existing ongoing meeting - transcripts will be provided from request time onwards",
  "is_duplicate": true,
  "original_meeting_id": "meeting-uuid-1"
}
```

- No second bot joins the meeting
- `meeting-uuid-2` receives transcripts only from 10:05 AM onwards
- `meeting-uuid-1` continues to receive full transcripts from 10:01 AM

## Benefits

1. **Cost Savings** - Prevents unnecessary duplicate bots
2. **Meeting Quality** - Avoids confusion from multiple bots in the same meeting
3. **Flexibility** - Multiple requesters can receive transcripts independently
4. **Customization** - Each requester receives transcripts from their request time
5. **Scalability** - Handles high-volume duplicate requests efficiently

## Applying This Schema

Already included in `db/bootstrap.sql` — re-running it against an existing
database is safe (idempotent) and will add the `is_duplicate` /
`original_meeting_id` columns if they're missing:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bootstrap.sql
```

Then restart the backend service for the change to take effect.

## Testing

### Run Unit Tests

**JavaScript:**
```bash
cd meeting-joiner
npm test tests/test_url_normalizer.js
```

**Python:**
```bash
cd meeting-joiner
pytest tests/test_url_normalizer.py -v
```

### Manual Testing

1. Create a meeting with a Zoom/Teams URL
2. Wait for bot to join (status becomes "ongoing")
3. Create another meeting with the same URL (with different tracking params)
4. Verify response shows `is_duplicate: true` and references original meeting
5. Check transcripts - duplicate should only have entries from its request time

## Monitoring

### Key Metrics to Track

- **Duplicate detection rate** - How often duplicates are detected
- **Transcript sync performance** - Time to sync transcripts to duplicates
- **Storage savings** - Reduction in duplicate meeting data

### Log Messages

Look for these log entries:

```
Found existing ongoing meeting {id}, creating linked duplicate record
Created duplicate meeting record: {duplicate_id} linked to original: {original_id}
Filtered transcript for duplicate meeting {id}: {filtered}/{total} entries
Syncing transcript from original meeting {id} to {count} duplicates
```

## Known Limitations

1. **Organization Scoping** - Duplicate detection only works within the same organization
2. **Status Requirement** - Only detects duplicates of "ongoing" meetings
3. **URL Variations** - Extremely different URL formats for the same meeting might not be detected
4. **Timezone Handling** - All timestamps use UTC

## Future Enhancements

1. Cross-organization duplicate detection (with permission controls)
2. Support for additional meeting platforms
3. Configurable transcript filtering (full vs. time-filtered)
4. Duplicate detection for "not_joined" meetings
5. Analytics dashboard for duplicate patterns
