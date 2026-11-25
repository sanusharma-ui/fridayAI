import os from "node:os";
import cors from "cors";
import express from "express";
import { PORT } from "./config.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";
import { modelsRouter } from "./routes/models.js";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Groq-Api-Key"],
  })
);

app.use(express.json({ limit: "30mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Friday Assistant Backend (Groq Powered)",
    status: "online",
    endpoints: [
      "GET  /api/health",
      "GET  /api/models",
      "POST /api/verify-key",
      "POST /api/chat",
      "POST /api/chat/stream",
    ],
  });
});

app.use("/api", healthRouter);
app.use("/api", modelsRouter);
app.use("/api", chatRouter);

app.use("/", healthRouter);

app.use(
  (
    err: Error & { status?: number; type?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err.type === "entity.too.large") {
      res.status(413).json({
        error: "Attachments exceed the 30 MB request limit. Try smaller files.",
      });
      return;
    }
    res.status(err.status || 500).json({
      error: err.message || "Unexpected server error.",
    });
  }
);

function getLocalLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

app.listen(PORT, "0.0.0.0", () => {
  const lanIp = getLocalLanIp();
  console.log(`\n✦ Friday Backend (Groq Streaming Ready) is running!`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (lanIp) {
    console.log(`  Network: http://${lanIp}:${PORT}  (Use this on physical mobile devices)`);
  }
  console.log(`  Stream:  http://localhost:${PORT}/api/chat/stream\n`);
});
