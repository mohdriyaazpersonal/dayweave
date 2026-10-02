export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];
export const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    document.querySelector("#storage-error")?.remove();
    return true;
  } catch {
    let alert = document.querySelector("#storage-error");
    if (!alert) {
      alert = document.createElement("div");
      alert.id = "storage-error";
      alert.setAttribute("role", "alert");
      alert.style.cssText =
        "position:fixed;bottom:16px;right:16px;z-index:2000;max-width:min(440px,calc(100vw - 32px));padding:16px;border:1px solid #b83a32;border-radius:10px;background:#fff1ef;color:#74251f;box-shadow:0 8px 30px #0002;font:14px/1.5 sans-serif";
      document.body.append(alert);
    }
    alert.textContent =
      "Browser storage is unavailable. Changes are only in memory. Export a backup before leaving.";
    return false;
  }
}
export function download(name, data, type = "application/json") {
  const url = URL.createObjectURL(
    new Blob(
      [typeof data === "string" ? data : JSON.stringify(data, null, 2)],
      { type },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toast(message) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove("visible"), 3500);
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
