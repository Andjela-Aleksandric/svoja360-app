// Tiny Supabase-style API gateway for local testing only.
const http = require("http");
const routes = [["/rest/v1", 54330], ["/auth/v1", 9999], ["/storage/v1", 5000]];
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-upsert, range, prefer, accept-profile, content-profile, x-supabase-api-version, cache-control, x-retry-count",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range, content-length, x-supabase-api-version",
};
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const r = routes.find(([p]) => req.url.startsWith(p + "/") || req.url === p || req.url.startsWith(p + "?"));
  if (!r) { res.writeHead(404); return res.end("no route"); }
  const path = req.url.slice(r[0].length) || "/";
  const headers = { ...req.headers, host: "localhost:" + r[1] };
  const up = http.request({ host: "127.0.0.1", port: r[1], path, method: req.method, headers }, (u) => {
    const h = { ...u.headers }; for (const k of Object.keys(h)) if (k.startsWith("access-control-")) delete h[k];
    res.writeHead(u.statusCode, { ...h, ...cors });
    u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, "127.0.0.1", () => console.log("gateway on 54321"));
