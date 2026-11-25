import { Router } from "express";
import { CURATED_GROQ_MODELS } from "../config.js";
import {
  fetchGroqModels,
  GroqApiError,
  resolveGroqApiKey,
} from "../services/groq.js";

export const modelsRouter = Router();

modelsRouter.get("/models", async (req, res) => {
  try {
    const apiKey = resolveGroqApiKey(req);
    const models = await fetchGroqModels(apiKey);
    res.json({ models, source: "groq-live" });
  } catch (err) {
    if (err instanceof GroqApiError && err.code === "MISSING_API_KEY") {
      res.json({ models: CURATED_GROQ_MODELS, source: "curated-default" });
      return;
    }
    if (err instanceof GroqApiError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

modelsRouter.post("/verify-key", async (req, res) => {
  try {
    const bodyKey =
      typeof req.body?.apiKey === "string" ? req.body.apiKey : undefined;
    const apiKey = resolveGroqApiKey(req, bodyKey);
    const models = await fetchGroqModels(apiKey);
    res.json({
      valid: true,
      message: "Groq API key verified successfully!",
      modelsCount: models.length,
      models,
    });
  } catch (err) {
    if (err instanceof GroqApiError) {
      res.status(err.status).json({
        valid: false,
        error: err.message,
        code: err.code,
      });
      return;
    }
    res.status(500).json({
      valid: false,
      error: "Unexpected error verifying Groq API key.",
    });
  }
});
