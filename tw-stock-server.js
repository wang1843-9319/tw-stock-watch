const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8787);

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "tw-stock-watch/1.0" } }, (response) => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function chart(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const symbol = String(url.searchParams.get("symbol") || "2330.TW").toUpperCase();
  const range = String(url.searchParams.get("range") || "6mo");
  const interval = String(url.searchParams.get("interval") || "1d");
  if (!/^[0-9A-Z.]+$/.test(symbol)) {
    send(res, 400, JSON.stringify({ error: "Bad symbol" }));
    return;
  }
  const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const quote = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  try {
    const json = await fetchJson(yahoo);
    try {
      const quoteJson = await fetchJson(quote);
      const quoteResult = quoteJson.quoteResponse?.result?.[0];
      json.stockName = quoteResult?.shortName || quoteResult?.longName || "";
    } catch {
      json.stockName = "";
    }
    send(res, 200, JSON.stringify(json));
  } catch (error) {
    send(res, 502, JSON.stringify({ error: error.message }));
  }
}

function staticFile(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const file = pathname === "/" ? "tw-stock-watch.html" : pathname.slice(1);
  const target = path.resolve(root, file);
  if (!target.startsWith(root)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const type = target.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    send(res, 200, data, type);
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith("/api/chart")) {
    chart(req, res);
  } else {
    staticFile(req, res);
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`?啗???撌脣???Render URL or http://localhost:${port}`);
});

