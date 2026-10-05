const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Serve everything in this project folder
app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    // WASM needs the correct MIME type
    if (filePath.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }

    // Service workers generally shouldn't be heavily cached
    if (filePath.endsWith(".sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

// Simple health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Engine server is running"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
