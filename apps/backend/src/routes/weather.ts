import { Router } from "express";

export const weatherRouter = Router();

weatherRouter.get("/current", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params must be numbers" });
    return;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`;
  const upstream = await fetch(url);

  if (!upstream.ok) {
    res.status(502).json({ error: "failed to fetch weather data" });
    return;
  }

  const data = await upstream.json();
  res.json({
    temperature: data.current.temperature_2m,
    unit: data.current_units.temperature_2m,
    time: data.current.time,
  });
});
