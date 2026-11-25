import { Router } from "express";
import {
  CURATED_GROQ_MODELS,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  SERVER_FALLBACK_GROQ_KEY,
} from "../config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "online",
    service: "friday-groq-backend",
    provider: "groq",
    protocol: 3,
    hasServerFallbackKey: Boolean(SERVER_FALLBACK_GROQ_KEY),
    defaultTextModel: DEFAULT_TEXT_MODEL,
    defaultVisionModel: DEFAULT_VISION_MODEL,
    curatedModels: CURATED_GROQ_MODELS,
  });
});
