export const CATEGORIES = ["Work", "Personal", "Learning"];
export function localDate(d = new Date()) {
  return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localDateTime(d) {
  return `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < 1900 || y > 9999) return false;
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
export function isValidDateTime(s) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) &&
    isValidDate(s.slice(0, 10)) &&
    Number(s.slice(11, 13)) < 24 &&
    Number(s.slice(14, 16)) < 60
  );
}
export function addDays(s, n) {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function validateEvent(raw) {
  if (!raw || typeof raw !== "object")
    throw new Error("Event must be an object.");
  const text = (key, max) => {
    if (raw[key] != null && typeof raw[key] !== "string")
      throw new Error(`${key} must be text.`);
    const value = (raw[key] ?? "").trim();
    if (value.length > max) throw new Error(`${key} is too long.`);
    return value;
  };
  const title = text("title", 180);
  if (!title) throw new Error("An event title is required.");
  const allDay = raw.allDay === true,
    start = text("start", 16),
    end = text("end", 16);
  if (
    !(allDay
      ? isValidDate(start) && isValidDate(end)
      : isValidDateTime(start) && isValidDateTime(end))
  )
    throw new Error("Enter valid start and end dates.");
  if (end <= start) throw new Error("The end must be after the start.");
  if (!CATEGORIES.includes(raw.category))
    throw new Error("Choose a valid calendar.");
  return {
    id: text("id", 240) || crypto.randomUUID(),
    title,
    start,
    end,
    allDay,
    category: raw.category,
    location: text("location", 500),
    notes: text("notes", 8000),
  };
}
export function eventsOnDate(events, date, categories = CATEGORIES) {
  const start = `${date}T00:00`,
    end = `${addDays(date, 1)}T00:00`;
  return events
    .filter(
      (e) =>
        categories.includes(e.category) &&
        (e.allDay
          ? e.start <= date && e.end > date
          : e.start < end && e.end > start),
    )
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
    );
}
export function monthGrid(date) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(1);
  const start = addDays(localDate(d), -((d.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function weekGrid(date) {
  const d = new Date(`${date}T12:00:00`),
    start = addDays(date, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
const escapeICS = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const unescapeICS = (s) =>
  s.replace(/\\([nN,;\\])/g, (_, c) => (/[nN]/.test(c) ? "\n" : c));
function foldLine(line) {
  const encoder = new TextEncoder();
  let out = "",
    current = "",
    bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      out += `${current}\r\n`;
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  return out + current;
}
function toUTC(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
export function exportICS(events, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dayweave//Local Calendar 1.0//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const raw of events) {
    const e = validateEvent(raw);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeICS(e.id)}`,
      `DTSTAMP:${now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z")}`,
      `SUMMARY:${escapeICS(e.title)}`,
      `DTSTART${e.allDay ? ";VALUE=DATE" : ""}:${e.allDay ? e.start.replace(/-/g, "") : toUTC(e.start)}`,
      `DTEND${e.allDay ? ";VALUE=DATE" : ""}:${e.allDay ? e.end.replace(/-/g, "") : toUTC(e.end)}`,
      `X-DAYWEAVE-CATEGORY:${e.category}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`);
    if (e.notes) lines.push(`DESCRIPTION:${escapeICS(e.notes)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
function parseICSDate(property) {
  const { params, value } = property;
  const dateOnly = params["VALUE"] === "DATE" || /^\d{8}$/.test(value);
  if (params.TZID && !["UTC", "Etc/UTC"].includes(params.TZID))
    throw new Error(
      "Named time zones (TZID) are not supported. Export floating local or UTC times.",
    );
  if (dateOnly) {
    if (!/^\d{8}$/.test(value)) throw new Error("Invalid all-day date.");
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    if (!isValidDate(date)) throw new Error("Invalid all-day date.");
    return { value: date, allDay: true };
  }
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/,
  );
  if (!match) throw new Error("Invalid calendar date-time.");
  const [, y, m, d, h, min, sec = "00", z] = match,
    local = `${y}-${m}-${d}T${h}:${min}`;
  if (!isValidDateTime(local) || Number(sec) > 59)
    throw new Error("Invalid calendar date-time.");
  if (z || params.TZID) {
    const parsed = new Date(`${local}:${sec}Z`);
    return { value: localDateTime(parsed), allDay: false };
  }
  return { value: local, allDay: false };
}
export function importICS(source) {
  if (typeof source !== "string" || source.length > 5_000_000)
    throw new Error("Choose an ICS file smaller than 5 MB.");
  const lines = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n[ \t]|\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines[0] !== "BEGIN:VCALENDAR" || lines.at(-1) !== "END:VCALENDAR")
    throw new Error("This is not a complete iCalendar file.");
  let current = null,
    nesting = 0;
  const events = [];
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      if (current) throw new Error("Nested events are invalid.");
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (!current) throw new Error("Unexpected event ending.");
      if (!current.DTSTART) throw new Error("Every event needs DTSTART.");
      const start = parseICSDate(current.DTSTART);
      let end;
      if (current.DTEND) {
        end = parseICSDate(current.DTEND);
        if (end.allDay !== start.allDay)
          throw new Error("Start and end must use the same date type.");
      } else
        end = {
          allDay: start.allDay,
          value: start.allDay
            ? addDays(start.value, 1)
            : localDateTime(
                new Date(new Date(start.value).getTime() + 3600000),
              ),
        };
      events.push(
        validateEvent({
          id: current.UID
            ? unescapeICS(current.UID.value)
            : crypto.randomUUID(),
          title: unescapeICS(current.SUMMARY?.value || "Untitled event"),
          start: start.value,
          end: end.value,
          allDay: start.allDay,
          category: CATEGORIES.includes(current["X-DAYWEAVE-CATEGORY"]?.value)
            ? current["X-DAYWEAVE-CATEGORY"].value
            : "Personal",
          location: unescapeICS(current.LOCATION?.value || ""),
          notes: unescapeICS(current.DESCRIPTION?.value || ""),
        }),
      );
      current = null;
      if (events.length > 2000)
        throw new Error("A calendar can contain up to 2,000 events.");
      continue;
    }
    if (!current) continue;
    if (line.startsWith("BEGIN:")) {
      nesting++;
      continue;
    }
    if (line.startsWith("END:")) {
      nesting--;
      continue;
    }
    if (nesting) continue;
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error("Invalid calendar property.");
    const [key, ...paramStrings] = line.slice(0, colon).split(";"),
      name = key.toUpperCase(),
      params = Object.fromEntries(
        paramStrings.map((p) => {
          const i = p.indexOf("=");
          return [
            p.slice(0, i).toUpperCase(),
            p.slice(i + 1).replace(/^"|"$/g, ""),
          ];
        }),
      );
    if (
      ["RRULE", "RDATE", "EXDATE", "RECURRENCE-ID", "DURATION"].includes(name)
    )
      throw new Error(
        "Recurring events and DURATION are not supported. Export individual events with DTSTART/DTEND.",
      );
    if (current[name] && ["DTSTART", "DTEND", "UID"].includes(name))
      throw new Error(`Duplicate ${name} property.`);
    current[name] = { params, value: line.slice(colon + 1) };
  }
  if (current) throw new Error("An event is missing END:VEVENT.");
  if (!events.length) throw new Error("No supported events were found.");
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new Error("The file contains duplicate event IDs.");
  return events;
}
export function demoEvents(today = localDate()) {
  const month = today.slice(0, 7);
  const base = [
    {
      day: today,
      time: "09:00",
      end: "10:00",
      title: "A clear start",
      category: "Personal",
      notes: "Demo event. A quiet hour to plan the day.",
    },
    {
      day: today,
      time: "11:00",
      end: "12:00",
      title: "Project deep dive",
      category: "Work",
      notes: "Demo event. Make space for your most meaningful work.",
    },
    {
      day: today,
      time: "16:00",
      end: "16:45",
      title: "Learn something new",
      category: "Learning",
      notes: "Demo event. Pick one small thing to explore.",
    },
    {
      day: addDays(today, 2),
      time: "10:00",
      end: "11:30",
      title: "Coffee & catch-up",
      category: "Personal",
      location: "Your favorite café",
    },
    {
      day: addDays(today, 4),
      time: "14:00",
      end: "15:00",
      title: "Portfolio review",
      category: "Work",
    },
    {
      day: `${month}-12`,
      time: "18:00",
      end: "19:00",
      title: "Design reading hour",
      category: "Learning",
    },
    {
      day: `${month}-18`,
      time: "09:30",
      end: "10:30",
      title: "Weekend wander",
      category: "Personal",
    },
    {
      day: `${month}-23`,
      time: "13:00",
      end: "14:00",
      title: "Next chapter planning",
      category: "Work",
    },
  ];
  return base.map((e, i) =>
    validateEvent({
      ...e,
      id: `demo-${i}`,
      start: `${e.day}T${e.time}`,
      end: `${e.day}T${e.end}`,
      allDay: false,
      notes: e.notes || "Demo event.",
    }),
  );
}
