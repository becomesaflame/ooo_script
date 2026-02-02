# Auto-Create Out of Office Events from #OOO Tag

A Google Apps Script that automatically creates Google Calendar "Out of Office" events for any calendar event containing `#OOO` in the title or description. This integrates with Grafana OnCall, which syncs Out of Office events to automatically generate shift swap requests for on-call coverage.

When a user has events in their personal Google Calendar that they can't be on call for, they can tag them with `#OOO` and invite their work calendar account. The script will create a corresponding Out of Office event that can trigger Grafana OnCall's shift swap request. 

## How It Works

1. Scans your work account's primary Google Calendar for events in the next 90 days
2. Looks for `#OOO` in event titles or descriptions (including recurring events)
3. Creates matching Out of Office events if they don't already exist
4. Grafana OnCall syncs these OOO events within approximately 1 hour

## Setup in Google Apps Script

### 1. Create a New Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Name your project (e.g., "OOO Event Creator")

### 2. Add the Google Calendar API Service

1. In the Apps Script editor, click **Editor** (code icon) in the left sidebar
2. Next to **Services**, click **Add a service** (+)
3. Select **Google Calendar API**
4. Click **Add**

> **Note:** If you are using a standard Google Cloud project (not the default Apps Script project), you must also enable the Google Calendar API in the [Google Cloud Console](https://console.developers.google.com/apis/dashboard). Search for "Google Calendar API" and click **Enable**.

### 3. Add the Script Code

1. Delete any default code in the editor
2. Copy the contents of `ooo_script.js` and paste it into the editor
3. Click **Save** (or press Ctrl+S / Cmd+S)

### 4. Authorize the Script

1. Select the function `createOOOEventsFromHashtag` from the function dropdown at the top
2. Click **Run**
3. When prompted, click **Review permissions**
4. Choose your Google account
5. Click **Advanced** → **Go to [project name] (unsafe)** (this is safe—it's your own script)
6. Click **Allow**

### 5. Set Up a Time-Based Trigger (Recommended)

1. Click the **Triggers** icon (clock) in the left sidebar
2. Click **+ Add Trigger**
3. Configure:
   - **Choose which function to run:** `createOOOEventsFromHashtag`
   - **Choose which deployment should run:** Head
   - **Select event source:** Time-driven
   - **Select type of time-based trigger:** Hour timer
   - **Select hour interval:** Every hour (or Every 6 hours if preferred)
4. Click **Save**
5. Authorize the trigger if prompted

### 6. Manual Run (Optional)

To run the script manually at any time:

1. Select `createOOOEventsFromHashtag` from the function dropdown
2. Click **Run**
3. View execution logs via **Executions** in the left sidebar

---

## Google Calendar Integration

Grafana OnCall allows you to connect your Google user to your OnCall user, giving read-only access to your Google Calendar's Out of Office events. Grafana OnCall periodically checks your Out of Office events to see if these overlap with any of your on-call shifts. If so, it will automatically generate a shift swap request for you.

> **Note:** A Google account can only be connected to one Grafana Cloud instance at a time. If you need to use the same Google account on a new instance, you will first need to disconnect the account from the previously connected instance.

### Connecting Your Google Calendar

To link your Google user, go to **View my profile** on the OnCall **Users** page. From there, follow the steps under the **Google Calendar** tab. Once linked, you can further configure which OnCall schedules you would like Grafana OnCall to consider for automatic shift swap generation. By default, it will consider all of the schedules that you are involved in.

### Updating Out of Office Events

When you update an existing Out of Office event in your Google Calendar (for example, extending or shortening its duration), Grafana OnCall will automatically update any corresponding **open** shift swap requests to match the new time range. This ensures your shift swap requests always stay in sync with your Out of Office calendar events.

For example:

- If you extend an Out of Office event from 45 minutes to 90 minutes, the corresponding shift swap request will be automatically extended to cover the full 90 minutes.
- If you shorten an Out of Office event, the shift swap request will be shortened accordingly.
- If you delete a shift swap request that was automatically created from an Out of Office event, Grafana OnCall will respect that decision and not recreate the request, even if the Out of Office event still exists.

### Ignoring Events

If you would like Grafana OnCall to ignore a specific Out of Office event from being considered for shift swap request generation, add `#grafana-oncall-ignore` to the Out of Office event's title.

Additionally, if Grafana OnCall generates a shift swap request for you from a Google Calendar event, and you delete the shift swap request, it will not attempt to regenerate a new shift swap request.

### Configuring for Open Source (Grafana OnCall OSS)

If you are using Grafana OnCall OSS:

1. Follow the instructions to set up your Google OAuth2 application
2. Create a Client ID for your OAuth2 app and set the `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY` and `SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET` environment variables accordingly

---

## Usage

- Add `#OOO` to any calendar event title or description to create a corresponding Out of Office event
- To skip an event, remove the `#OOO` tag
- The script handles both all-day and timed events
- Recurring events are expanded into individual instances

## Notes

- Out of Office events cannot have descriptions (Google Calendar restriction)
- Out of Office events cannot be all-day in Google Calendar. When an all-day event is tagged with `#OOO`, the script converts it to a timed event: **12:00am on the first day** through **12:00am on the day following the last day**
- The script checks for existing OOO events to avoid duplicates
- Grafana OnCall typically syncs within approximately 1 hour
