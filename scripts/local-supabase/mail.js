// Minimal SMTP sink (port 2500) storing mails as files in /opt/sb/mails, and a template server (2501).
const net = require("net"), fs = require("fs"), http = require("http");
fs.mkdirSync("/opt/sb/mails", { recursive: true });
net.createServer((s) => {
  let data = "", inData = false;
  s.write("220 local\r\n");
  s.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r\n/)) {
      if (inData) { if (line === ".") { inData = false; fs.writeFileSync(`/opt/sb/mails/${Date.now()}.eml`, data); data = ""; s.write("250 OK\r\n"); } else data += line + "\n"; continue; }
      if (!line) continue;
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") s.write("250-local\r\n250 AUTH PLAIN LOGIN\r\n");
      else if (cmd === "AUTH") s.write("235 ok\r\n");
      else if (cmd === "DATA") { inData = true; s.write("354 go\r\n"); }
      else if (cmd === "QUIT") { s.write("221 bye\r\n"); s.end(); }
      else s.write("250 OK\r\n");
    }
  });
}).listen(2500, "127.0.0.1");
const tpl = (type, next) => `<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}">LINK</a></p>`;
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(req.url.includes("invite") ? tpl("invite", "/nova-lozinka") : tpl("recovery", "/nova-lozinka"));
}).listen(2501, "127.0.0.1");
