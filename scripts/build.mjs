import { cp, mkdir, rm, readdir } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const f of await readdir("."))
  if (
    /\.(html|css|js|svg|png|webp|ico)$/.test(f) ||
    ["assets", "data"].includes(f)
  )
    await cp(f, `dist/${f}`, { recursive: true });
console.log("Built static site in dist/");
