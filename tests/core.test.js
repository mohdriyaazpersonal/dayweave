import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEvent,
  eventsOnDate,
  monthGrid,
  weekGrid,
  exportICS,
  importICS,
  localDateTime,
  isValidDateTime,
} from "../core.js";
const event = {
  id: "test-1",
  title: "Plan, build; repeat",
  start: "2026-10-02T09:00",
  end: "2026-10-02T10:00",
  category: "Work",
  allDay: false,
  notes: "First line\nSecond line with \\ a slash",
  location: "Studio",
};
const wrap = (body) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
test("validates real dates and positive event duration", () => {
  assert.equal(isValidDateTime("2026-02-29T09:00"), false);
  assert.equal(isValidDateTime("2024-02-29T24:00"), false);
  assert.throws(() => validateEvent({ ...event, end: event.start }), /after/);
  assert.throws(
    () => validateEvent({ ...event, start: "2026-10-02T25:00" }),
    /valid/,
  );
});
test("calendar weeks begin Monday and cover six complete weeks", () => {
  const days = monthGrid("2026-10-02");
  assert.equal(days.length, 42);
  assert.equal(days[0], "2026-09-28");
  assert.equal(weekGrid("2026-10-04")[0], "2026-09-28");
});
test("all-day end dates are exclusive and overnight events span dates", () => {
  const all = validateEvent({
      ...event,
      allDay: true,
      start: "2026-10-02",
      end: "2026-10-04",
    }),
    overnight = validateEvent({
      ...event,
      id: "two",
      start: "2026-10-02T23:00",
      end: "2026-10-03T01:00",
    });
  assert.equal(eventsOnDate([all, overnight], "2026-10-03").length, 2);
  assert.equal(eventsOnDate([all], "2026-10-04").length, 0);
  assert.equal(eventsOnDate([all], "2026-10-02", ["Personal"]).length, 0);
});
test("ICS export and import round-trip escaped text and local times", () => {
  const out = importICS(exportICS([event]));
  assert.deepEqual(out[0], validateEvent(event));
});
test("folded unicode lines round-trip without corrupting characters", () => {
  const long = { ...event, title: "A thoughtful moment 🌱 ".repeat(7) };
  const text = exportICS([long]);
  assert.ok(text.includes("\r\n "));
  for (const line of text.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(importICS(text)[0].title, long.title.trim());
});
test("imports all-day dates and infers default ends", () => {
  const out = importICS(
    wrap("UID:day\r\nSUMMARY:Rest\r\nDTSTART;VALUE=DATE:20261002"),
  );
  assert.equal(out[0].end, "2026-10-03");
  assert.equal(out[0].allDay, true);
});
test("UTC DTSTART is converted to device local time", () => {
  const out = importICS(
    wrap(
      "UID:utc\r\nSUMMARY:Call\r\nDTSTART:20261002T120000Z\r\nDTEND:20261002T130000Z",
    ),
  );
  assert.equal(out[0].start, localDateTime(new Date("2026-10-02T12:00:00Z")));
});
test("rejects recurrence, unsupported time zones and malformed calendar values", () => {
  assert.throws(
    () => importICS(wrap("SUMMARY:Bad\r\nDTSTART:20260230T090000")),
    /Invalid/,
  );
  assert.throws(
    () =>
      importICS(
        wrap("SUMMARY:Repeat\r\nDTSTART:20261002T090000\r\nRRULE:FREQ=DAILY"),
      ),
    /Recurring/,
  );
  assert.throws(
    () =>
      importICS(
        wrap("SUMMARY:Zoned\r\nDTSTART;TZID=America\/New_York:20261002T090000"),
      ),
    /time zones/,
  );
  assert.throws(() => importICS("BEGIN:VCALENDAR"), /complete/);
});
test("all-day export preserves exclusive end and skips event alarms during import", () => {
  const all = {
    ...event,
    allDay: true,
    start: "2026-10-02",
    end: "2026-10-04",
  };
  assert.deepEqual(importICS(exportICS([all]))[0], validateEvent(all));
  const out = importICS(
    wrap(
      "UID:alarm\r\nSUMMARY:Real title\r\nDTSTART:20261002T090000\r\nBEGIN:VALARM\r\nSUMMARY:Alarm title\r\nEND:VALARM",
    ),
  );
  assert.equal(out[0].title, "Real title");
});
