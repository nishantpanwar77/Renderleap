const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS
app.use(
  cors({
    origin: ["http://localhost:4200", "http://localhost:3000"],
    credentials: true,
  })
);

// Add Cross-Origin Isolation headers - CRITICAL FOR WEBCONTAINER
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// Serve static files from Angular build
app.use(
  express.static(path.join(__dirname, "dist/web-ide/browser"))
);

// Proxy WebContainer requests
app.use(
  "/webcontainer",
  createProxyMiddleware({
    target: "https://webcontainers.io",
    changeOrigin: true,
    pathRewrite: {
      "^/webcontainer": "",
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add CORS headers to proxied responses
      proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      proxyRes.headers["Access-Control-Allow-Methods"] =
        "GET, POST, PUT, DELETE, OPTIONS";
      proxyRes.headers["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization";
    },
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Catch-all route to serve Angular app
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "dist/web-ide/browser/index.html")
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("Features:");
  console.log("- Serving Angular WebContainer IDE");
  console.log("- Reverse proxy for WebContainer API");
  console.log("- CORS enabled for development");
});
