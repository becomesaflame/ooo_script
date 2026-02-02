/**
 * AUTO-CREATE OUT OF OFFICE EVENTS FROM #OOO TAG
 * 
 * Purpose:
 * Automatically creates Google Calendar "Out of Office" events for any calendar
 * event that contains "#OOO" in the title or description. This integrates with
 * Grafana OnCall, which syncs Out of Office events to automatically generate
 * shift swap requests for on-call coverage.
 * 
 * How it works:
 * 1. Scans your primary Google Calendar for events in the next 90 days
 * 2. Looks for "#OOO" in event titles or descriptions (including recurring events)
 * 3. Creates matching Out of Office events if they don't already exist
 * 4. Grafana OnCall syncs these OOO events within ~1 hour
 * 
 * Setup:
 * - Run manually: Select createOOOEventsFromHashtag() and click Run
 * - Run automatically: Set up a time-based trigger (recommended: hourly)
 * - Requires: Google Calendar API enabled (Services > + > Google Calendar API)
 * 
 * Usage:
 * - Add "#OOO" to any calendar event title or description
 * - Script will create a corresponding Out of Office event
 * - To skip an event, remove the #OOO tag
 * 
 * Notes:
 * - Out of Office events cannot have descriptions (Google Calendar restriction)
 * - Out of Office events cannot be all-day; all-day #OOO events are converted to
 *   timed events (12:00am first day → 12:00am day after last day)
 * - Handles recurring events by expanding them into individual instances
 * - Checks for existing OOO events to avoid duplicates
 */

function createOOOEventsFromHashtag() {
    const calendarId = 'primary';

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    Logger.log(`Scanning from ${startDate} to ${endDate}`);

    let allEvents = [];
    let pageToken = null;

    do {
        const response = Calendar.Events.list(calendarId, {
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500,
            pageToken: pageToken,
            fields: 'items(id,summary,description,start,end,eventType,recurringEventId),nextPageToken'
        });

        allEvents = allEvents.concat(response.items || []);
        pageToken = response.nextPageToken;
        Logger.log(`Fetched ${response.items ? response.items.length : 0} events, total so far: ${allEvents.length}`);
    } while (pageToken);

    Logger.log(`\n========== ALL EVENTS FOUND ==========`);
    for (let i = 0; i < allEvents.length; i++) {
        const event = allEvents[i];
        const title = event.summary || '(no title)';
        const description = event.description || '(no description)';
        const startTime = event.start.dateTime || event.start.date;

        Logger.log(`\nEvent ${i + 1}:`);
        Logger.log(`  Title: ${title}`);
        Logger.log(`  Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);
        Logger.log(`  Start: ${startTime}`);
        Logger.log(`  Has #OOO in title: ${title.includes('#OOO')}`);
        Logger.log(`  Has #OOO in description: ${description.includes('#OOO')}`);
    }
    Logger.log(`\n========== END OF EVENT LIST ==========\n`);

    const calendar = CalendarApp.getDefaultCalendar();

    let created = 0;
    let skipped = 0;
    let foundOOOEvents = 0;

    for (let event of allEvents) {
        const title = event.summary || '';
        const description = event.description || '';

        if (title.includes('#OOO') || description.includes('#OOO')) {
            foundOOOEvents++;
            const isAllDay = !event.start.dateTime;
            let eventStart, eventEnd;

            if (isAllDay) {
                // Out of Office events cannot be all-day. Convert to timed:
                // 12:00am on first day → 12:00am on day following last day.
                // event.end.date is already exclusive (day after last day) in Google's format.
                const startDateStr = event.start.date;
                const endDateStr = event.end.date;
                eventStart = new Date(startDateStr + 'T00:00:00');
                eventEnd = new Date(endDateStr + 'T00:00:00');
            } else {
                eventStart = new Date(event.start.dateTime);
                eventEnd = new Date(event.end.dateTime);
            }

            Logger.log(`#${foundOOOEvents}: Found #OOO event: "${title}" at ${eventStart.toLocaleString()}`);

            if (!hasExactOOOEvent(calendarId, eventStart, eventEnd)) {
                const oooEvent = {
                    summary: 'Out of Office',
                    eventType: 'outOfOffice',
                    start: {},
                    end: {}
                };

                const tz = event.start.timeZone || calendar.getTimeZone();
                if (isAllDay) {
                    // Use date strings directly so API interprets as midnight in the timezone
                    oooEvent.start.dateTime = event.start.date + 'T00:00:00';
                    oooEvent.end.dateTime = event.end.date + 'T00:00:00';
                } else {
                    oooEvent.start.dateTime = eventStart.toISOString();
                    oooEvent.end.dateTime = eventEnd.toISOString();
                }
                oooEvent.start.timeZone = tz;
                oooEvent.end.timeZone = event.end.timeZone || tz;

                Calendar.Events.insert(oooEvent, calendarId);
                created++;
                Logger.log(`  -> Created OOO event`);
            } else {
                skipped++;
                Logger.log(`  -> OOO already exists, skipping`);
            }
        }
    }

    Logger.log(`Summary: Found ${foundOOOEvents} events with #OOO, created ${created} OOO events, skipped ${skipped}`);
    return { created: created, skipped: skipped };
}

function hasExactOOOEvent(calendarId, startTime, endTime) {
    const searchStart = new Date(startTime.getTime() - 60000);
    const searchEnd = new Date(endTime.getTime() + 60000);

    const events = Calendar.Events.list(calendarId, {
        timeMin: searchStart.toISOString(),
        timeMax: searchEnd.toISOString(),
        singleEvents: true
    });

    if (events.items) {
        for (let event of events.items) {
            if (event.eventType === 'outOfOffice') {
                const existingStart = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);

                if (existingStart.getTime() === startTime.getTime()) {
                    return true;
                }
            }
        }
    }
    return false;
}