import "dotenv/config";
import express from "express";
import { connectDB } from "./db.js";

const app = express();
const port = process.env.PORT ?? 3001;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

await connectDB();

app.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
