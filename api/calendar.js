// api/calendar.js
// Vercel serverless function — returns a live .ics feed of Michael's pilot schedule.
// Flights only (layovers excluded).

module.exports = async function handler(req, res) {
  // ── 1. Fetch the schedule ────────────────────────────────────────────────
  const SCHEDULE_URL =
    'https://raw.githubusercontent.com/michael-saez/pilot-schedule/main/schedule-complete.json';

  let schedule;
  try {
    const r = await fetch(SCHEDULE_URL);
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    schedule = await r.json();
  } catch (err) {
    res.status(502).send(`Failed to fetch schedule: ${err.message}`);
    return;
  }

  // ── 2. Helpers ───────────────────────────────────────────────────────────

  // Convert MM/DD/YY + HH:MM  →  20YYMMDDTHHMMSSZ
  function toICS(date, time) {
    const [mm, dd, yy] = date.split('/');
    const [hh, min] = time.split(':');
    return `20${yy}${mm}${dd}T${hh}${min}00Z`;
  }

  // Fold long ICS lines at 75 chars (RFC 5545 §3.1)
  function fold(line) {
    if (line.length <= 75) return line;
    const chunks = [];
    chunks.push(line.slice(0, 75));
    let i = 75;
    while (i < line.length) {
      chunks.push(' ' + line.slice(i, i + 74));
      i += 74;
    }
    return chunks.join('\r\n');
  }

  const POSITION_LABEL = {
    'F/O': 'First Officer',
    'R/O': 'Relief Officer',
    'DH':  'Deadhead',
    'JS':  'Jumpseat',
  };

  // ── 3. Build the calendar ────────────────────────────────────────────────
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Michael Saez//Pilot Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Pilot Schedule',
    'X-WR-CALDESC:Flight schedule – Michael Saez (ANC base)',
    'X-WR-TIMEZONE:UTC',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const trip of schedule.trips) {
    for (const event of trip.events) {
      if (event.type !== 'flight') continue;

      const [orig, dest] = event.route.split('-');
      const posLabel = POSITION_LABEL[event.position] || event.position;
      const aircraft = event.aircraft ? ` · ${event.aircraft}` : '';

      const dtstart = toICS(event.startDateUTC, event.startTimeUTC);
      const dtend   = toICS(event.endDateUTC,   event.endTimeUTC);
      const uid     = `${trip.tripId}-${event.flightNumber}-${dtstart}@michaelsaez.com`;

      const summary     = `${event.flightNumber} ${orig}→${dest} (${event.position})`;
      const description = `${posLabel}${aircraft}\\nBlock: ${event.blockHours}\\nTrip: ${trip.tripId}`;

      lines.push('BEGIN:VEVENT');
      lines.push(fold(`UID:${uid}`));
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(fold(`SUMMARY:${summary}`));
      lines.push(fold(`DESCRIPTION:${description}`));
      lines.push(`LOCATION:${dest}`);
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');

  const body = lines.join('\r\n') + '\r\n';

  // ── 4. Respond ───────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pilot-schedule.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(body);
};
