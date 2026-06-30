const SUPABASE_URL =
  globalThis.process?.env?.SUPABASE_URL ||
  globalThis.process?.env?.VITE_SUPABASE_PROJECT_URL;
const SERVICE_KEY = globalThis.process?.env?.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const id = String(req.query?.id || "").trim();
  if (!id) return res.status(400).json({ error: "missing id" });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "supabase is not configured" });
  }

  const url =
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/storygraph_ratings` +
    `?select=hardcover_id,slug,rating,rating_count,updated_at` +
    `&hardcover_id=eq.${encodeURIComponent(id)}&limit=1`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const rows = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: "cache lookup failed" });
    }
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "rating not found" });
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json({
      hardcover_id: row.hardcover_id,
      slug: row.slug,
      rating: row.rating,
      ratingCount: row.rating_count,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
