import express from "express";
import { supabase } from "../lib/supabase.js";
import { sanitize, dbError, VALID_CAMPUS_IDS } from "../lib/validation.js";

const router = express.Router();

router.get("/api/locations", async (req, res) => {
  const { campus } = req.query;

  let query = supabase
    .from("locations")
    .select("location_id, name, coordinates, campus")
    .order("name", { ascending: true });

  if (campus) {
    const sanitizedCampus = sanitize(campus, 50);
    if (!VALID_CAMPUS_IDS.has(sanitizedCampus)) {
      return res.status(400).json({ error: "Invalid campus" });
    }
    query = query.eq("campus", sanitizedCampus);
  }

  const { data, error } = await query;
  if (error) return dbError(res, error, "GET /api/locations");
  res.json(data);
});

export default router;
