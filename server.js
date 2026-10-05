const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

/* =========================================================
   CORS
   ========================================================= */

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://userivet.net");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Range"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================================================
   BODY HANDLING

   Keep request bodies raw so POST requests can be forwarded.
   ========================================================= */

app.use(
  express.raw({
    type: () => true,
    limit: "25mb"
  })
);

/* =========================================================
   PROXY ROUTE

   Usage:

   /proxy?url=https%3A%2F%2Fexample.com
   ========================================================= */

app.all("/proxy", async (req, res) => {
  try {
    const target = req.query.url;

    if (!target || typeof target !== "string") {
      return res.status(400).json({
        error: "Missing url parameter",
        example: "/proxy?url=https%3A%2F%2Fexample.com"
      });
    }

    let targetURL;

    try {
      targetURL = new URL(target);
    } catch {
      return res.status(400).json({
        error: "Invalid target URL"
      });
    }

    if (
      targetURL.protocol !== "http:" &&
      targetURL.protocol !== "https:"
    ) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS URLs are supported"
      });
    }

    /* -----------------------------------------
       Forward selected request headers
       ----------------------------------------- */

    const headers = {};

    const forwardHeaders = [
      "accept",
      "accept-language",
      "content-type",
      "range",
      "user-agent"
    ];

    for (const name of forwardHeaders) {
      if (req.headers[name]) {
        headers[name] = req.headers[name];
      }
    }

    const options = {
      method: req.method,
      headers,
      redirect: "follow"
    };

    /*
     * GET and HEAD requests cannot have bodies.
     */
    if (
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      req.body &&
      req.body.length
    ) {
      options.body = req.body;
    }

    /* -----------------------------------------
       Fetch destination
       ----------------------------------------- */

    const upstream = await fetch(targetURL.href, options);

    /* -----------------------------------------
       Response headers
       ----------------------------------------- */

    const contentType =
      upstream.headers.get("content-type");

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    const contentLength =
      upstream.headers.get("content-length");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const contentRange =
      upstream.headers.get("content-range");

    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }

    const acceptRanges =
      upstream.headers.get("accept-ranges");

    if (acceptRanges) {
      res.setHeader("Accept-Ranges", acceptRanges);
    }

    /*
     * Don't copy frame restrictions from the destination.
     * Your Entry frontend displays the result inside an iframe.
     */

    res.status(upstream.status);

    /* -----------------------------------------
       Send response
       ----------------------------------------- */

    const data = Buffer.from(
      await upstream.arrayBuffer()
    );

    res.send(data);

  } catch (error) {
    console.error("Proxy error:", error);

    res.status(502).json({
      error: "Proxy request failed",
      message: error.message
    });
  }
});

/* =========================================================
   ENGINE STATIC FILES
   ========================================================= */

app.use(
  express.static(path.join(__dirname), {
    extensions: ["html"],

    setHeaders(res, filePath) {
      if (filePath.endsWith(".wasm")) {
        res.setHeader(
          "Content-Type",
          "application/wasm"
        );
      }

      if (filePath.endsWith(".js")) {
        res.setHeader(
          "Content-Type",
          "application/javascript; charset=utf-8"
        );
      }

      if (filePath.endsWith(".sw.js")) {
        res.setHeader(
          "Service-Worker-Allowed",
          "/"
        );

        res.setHeader(
          "Cache-Control",
          "no-store"
        );
      }
    }
  })
);

/* =========================================================
   ROOT
   ========================================================= */

app.get("/", (req, res) => {
  res.type("html").send(`
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>Entry Engine</title>

<style>

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #000;
  color: #fff;
  font-family: system-ui, sans-serif;
}

main {
  text-align: center;
}

h1 {
  margin-bottom: 8px;
}

p {
  opacity: .7;
}

code {
  color: #2ff5c8;
}

</style>

</head>

<body>

<main>

<h1>Entry Engine</h1>

<p>Engine server is online.</p>

<code>/proxy?url=...</code>

</main>

</body>

</html>
  `);
});

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    engine: "entry",
    proxy: "/proxy?url=",
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   404
   ========================================================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.originalUrl
  });
});

/* =========================================================
   START
   ========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("--------------------------------");
  console.log("Entry Engine Online");
  console.log(`Port: ${PORT}`);
  console.log("Proxy: /proxy?url=");
  console.log("--------------------------------");
});
