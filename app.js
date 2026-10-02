import {
  $,
  $$,
  escapeHTML as e,
  readStore,
  writeStore,
  download,
  toast,
} from "./lib.js";
import {
  CATEGORIES,
  localDate,
  addDays,
  validateEvent,
  eventsOnDate,
  monthGrid,
  weekGrid,
  exportICS,
  importICS,
  demoEvents,
} from "./core.js";
const KEY = "dayweave-v1",
  today = localDate();
let stored = readStore(KEY, null),
  events,
  isDemo;
try {
  if (stored && (!Array.isArray(stored.events) || stored.version !== 1))
    throw new Error();
  events = stored ? stored.events.map(validateEvent) : demoEvents(today);
  isDemo = stored ? stored.demo === true : true;
} catch {
  events = [];
  isDemo = false;
  toast(
    "Stored events could not be read. Import your .ics backup to recover them.",
  );
}
let selected = today,
  anchor = today,
  miniAnchor = today,
  view = "month",
  categories = [...CATEGORIES];
const form = $("#event-form"),
  editor = $("#editor");
const dateObj = (s) => new Date(`${s}T12:00:00`),
  monthLabel = (s) =>
    dateObj(s).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
function save() {
  writeStore(KEY, { version: 1, demo: isDemo, events });
}
function timeLabel(event) {
  if (event.allDay) return "All day";
  const start = new Date(event.start),
    end = new Date(event.end),
    opts = { hour: "numeric", minute: "2-digit" };
  const prefix =
    event.start.slice(0, 10) !== selected
      ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · `
      : "";
  return `${prefix}${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}${event.end.slice(0, 10) !== event.start.slice(0, 10) ? ` · ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`;
}
function render() {
  const days = view === "month" ? monthGrid(anchor) : weekGrid(anchor);
  $("#calendar-title").textContent =
    view === "month"
      ? monthLabel(anchor)
      : `${dateObj(days[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${dateObj(days[6]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  $("#month-view").setAttribute("aria-pressed", view === "month");
  $("#week-view").setAttribute("aria-pressed", view === "week");
  $("#calendar-grid").classList.toggle("week-mode", view === "week");
  $("#calendar-grid").innerHTML = days
    .map((date) => {
      const list = eventsOnDate(events, date, categories),
        max = view === "week" ? 20 : 2;
      return `<div class="day-cell ${date.slice(0, 7) !== anchor.slice(0, 7) ? "outside" : ""} ${date === selected ? "selected" : ""}"><button class="date-button ${date === today ? "today" : ""}" data-date="${date}" aria-pressed="${date === selected}" aria-label="${dateObj(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${list.length} events">${Number(date.slice(8))}</button>${list
        .slice(0, max)
        .map(
          (event) =>
            `<button class="event-chip cat-${event.category}" data-edit="${e(event.id)}" aria-label="Edit ${e(event.title)}"><span>${event.allDay ? "All day" : event.start.slice(11)}</span>${e(event.title)}</button>`,
        )
        .join(
          "",
        )}${list.length > max ? `<button class="more-events" data-date="${date}">+${list.length - max} more</button>` : ""}</div>`;
    })
    .join("");
  const periodEvents = new Set(
    days.flatMap((date) =>
      eventsOnDate(events, date, categories).map((ev) => ev.id),
    ),
  );
  $("#visible-count").textContent = `${periodEvents.size} events in view`;
  $("#mini-title").textContent = monthLabel(miniAnchor);
  $("#mini-calendar").innerHTML = monthGrid(miniAnchor)
    .map(
      (date) =>
        `<button class="${date === selected ? "selected" : ""} ${date === today ? "is-today" : ""} ${date.slice(0, 7) !== miniAnchor.slice(0, 7) ? "outside" : ""}" data-date="${date}" aria-label="${dateObj(date).toLocaleDateString(undefined, { dateStyle: "long" })}" aria-pressed="${date === selected}">${Number(date.slice(8))}</button>`,
    )
    .join("");
  CATEGORIES.forEach((c) => {
    $(`#count-${c}`).textContent = events.filter(
      (ev) => ev.category === c,
    ).length;
  });
  $("#agenda-date").textContent = dateObj(selected).toLocaleDateString(
    undefined,
    { weekday: "long", month: "short", day: "numeric" },
  );
  const agenda = eventsOnDate(events, selected, categories);
  $("#agenda-count").textContent = agenda.length
    ? `${agenda.length} ${agenda.length === 1 ? "event" : "events"} planned`
    : "A little room to breathe";
  $("#agenda-events").innerHTML =
    agenda
      .map(
        (event) =>
          `<button class="agenda-event cat-${event.category}" data-edit="${e(event.id)}"><span class="agenda-time">${e(timeLabel(event))}</span><strong>${e(event.title)}</strong>${event.location ? `<span class="agenda-location">⌖ ${e(event.location)}</span>` : ""}<span class="agenda-category">● ${event.category}</span></button>`,
      )
      .join("") ||
    '<p class="empty">Nothing planned here yet.<br>What would make this day yours?</p>';
  $("#demo-banner").hidden = !isDemo;
}
function select(date) {
  selected = date;
  anchor = date;
  miniAnchor = date;
  render();
}
function moveMonth(value, delta) {
  const date = dateObj(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  return localDate(date);
}
function syncDateInputs(allDay) {
  form.elements.start.type = allDay ? "date" : "datetime-local";
  form.elements.end.type = allDay ? "date" : "datetime-local";
  $("#end-label").textContent = allDay ? "Ends before (exclusive)" : "Ends";
  $("#date-hint").textContent = allDay
    ? "The end date is exclusive. For one full day, choose the following day as the end."
    : "Times use your device’s local time zone.";
}
function edit(id) {
  form.reset();
  $("#form-error").textContent = "";
  const event = events.find((ev) => ev.id === id);
  $("#editor-title").textContent = event
    ? "Edit your plans"
    : "Make a little space";
  $("#delete").hidden = !event;
  syncDateInputs(event?.allDay || false);
  if (event) {
    for (const [k, v] of Object.entries(event))
      if (form.elements[k]) {
        if (k === "allDay") form.elements[k].checked = v;
        else form.elements[k].value = v;
      }
  } else {
    form.elements.start.value = `${selected}T09:00`;
    form.elements.end.value = `${selected}T10:00`;
  }
  editor.showModal();
  form.elements.title.focus();
}
form.elements.allDay.onchange = () => {
  const allDay = form.elements.allDay.checked,
    start = form.elements.start.value.slice(0, 10) || selected,
    end = form.elements.end.value.slice(0, 10) || start;
  syncDateInputs(allDay);
  form.elements.start.value = allDay ? start : `${start}T09:00`;
  form.elements.end.value = allDay
    ? end > start
      ? end
      : addDays(start, 1)
    : `${start}T10:00`;
};
$("#today-weekday").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "short",
});
$("#today-day").textContent = new Date().getDate();
$("#new-event").onclick = () => edit();
$("#add-selected").onclick = () => edit();
$$(".close").forEach((b) => (b.onclick = () => editor.close()));
for (const id of ["#calendar-grid", "#mini-calendar", "#agenda-events"])
  $(id).onclick = (ev) => {
    const day = ev.target.closest("[data-date]"),
      event = ev.target.closest("[data-edit]");
    if (day) select(day.dataset.date);
    if (event) edit(event.dataset.edit);
  };
$("#previous").onclick = () => {
  anchor = view === "month" ? moveMonth(anchor, -1) : addDays(anchor, -7);
  miniAnchor = anchor;
  render();
};
$("#next").onclick = () => {
  anchor = view === "month" ? moveMonth(anchor, 1) : addDays(anchor, 7);
  miniAnchor = anchor;
  render();
};
$("#mini-prev").onclick = () => {
  miniAnchor = moveMonth(miniAnchor, -1);
  render();
};
$("#mini-next").onclick = () => {
  miniAnchor = moveMonth(miniAnchor, 1);
  render();
};
$("#today").onclick = () => select(localDate());
$("#month-view").onclick = () => {
  view = "month";
  render();
};
$("#week-view").onclick = () => {
  view = "week";
  render();
};
$$(".calendars input").forEach(
  (input) =>
    (input.onchange = () => {
      categories = $$(".calendars input:checked").map((i) => i.value);
      render();
    }),
);
form.onsubmit = (ev) => {
  ev.preventDefault();
  try {
    const raw = Object.fromEntries(new FormData(form)),
      event = validateEvent({ ...raw, allDay: form.elements.allDay.checked });
    const exists = events.some((e) => e.id === event.id);
    events = exists
      ? events.map((e) => (e.id === event.id ? event : e))
      : [...events, event];
    save();
    select(event.start.slice(0, 10));
    editor.close();
    toast(exists ? "Event updated." : "A little space, saved.");
  } catch (error) {
    $("#form-error").textContent = error.message;
  }
};
$("#delete").onclick = () => {
  if (confirm("Delete this event? This cannot be undone.")) {
    events = events.filter((ev) => ev.id !== form.elements.id.value);
    save();
    render();
    editor.close();
    toast("Event deleted.");
  }
};
$("#export").onclick = () => {
  download(
    `dayweave-${localDate()}.ics`,
    exportICS(events),
    "text/calendar;charset=utf-8",
  );
  toast("Calendar exported. All calendars are included.");
};
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000)
      throw new Error("Choose a file smaller than 5 MB.");
    const incoming = importICS(await file.text()),
      updates = incoming.filter((ev) =>
        events.some((existing) => existing.id === ev.id),
      ).length;
    if (
      confirm(
        `Import ${incoming.length} events? ${updates} matching event IDs will be updated; other existing events will be kept. Recurring and named-time-zone events are unsupported.`,
      )
    ) {
      const map = new Map(events.map((ev) => [ev.id, ev]));
      incoming.forEach((ev) => map.set(ev.id, ev));
      events = [...map.values()];
      save();
      select(incoming[0].start.slice(0, 10));
      toast(`${incoming.length} events imported.`);
    }
  } catch (error) {
    toast(`Import failed: ${error.message}`);
  }
  ev.target.value = "";
};
$("#reset").onclick = () => $("#reset-dialog").showModal();
$("#clear-demo").onclick = () => $("#reset-dialog").showModal();
$("#reset-cancel").onclick = () => $("#reset-dialog").close();
function reset(demo) {
  events = demo ? demoEvents() : [];
  isDemo = demo;
  save();
  select(localDate());
  $("#reset-dialog").close();
  toast(demo ? "Sample events loaded." : "Your calendar is ready.");
}
$("#clear-confirm").onclick = () => reset(false);
$("#demo-confirm").onclick = () => reset(true);
render();
