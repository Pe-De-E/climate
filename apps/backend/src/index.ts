import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import { weatherRouter } from "./routes/weather.js";

const app = express();
const port = process.env.PORT ?? 3001;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(cors({ origin: frontendUrl }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/weather", weatherRouter);

await connectDB();

app.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
