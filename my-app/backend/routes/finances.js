import express from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, require2FA, requireOwner } from "../middleware/auth.js";
import { dbError } from "../lib/validation.js";

const router = express.Router();

router.get("/api/finances/summary", requireAuth, require2FA, requireOwner, async (_req, res) => {
  const month = new Date().toISOString().slice(0, 7);
  const { data: visionRow } = await supabase
    .from("vision_usage")
    .select("call_count")
    .eq("month", month)
    .single();
  const vision = { month, callCount: visionRow?.call_count ?? 0, freeLimit: 1000 };

  let railway = null;
  if (process.env.RAILWAY_API_TOKEN) {
    try {
      const railwayFetch = async (query, variables = {}) => {
        const r = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.RAILWAY_API_TOKEN}` },
          body: JSON.stringify({ query, variables }),
        });
        return r.json();
      };

      // Step 1: get workspaceId from projects
      const projectsData = await railwayFetch(`{ projects { edges { node { name workspaceId } } } }`);
      const projects = projectsData?.data?.projects?.edges ?? [];
      const workspaceId = projects[0]?.node?.workspaceId;

      // Step 2: get billing from workspace (parameterized — no string interpolation)
      if (workspaceId) {
        const billingData = await railwayFetch(
          `query($wid: String!) {
            workspace(workspaceId: $wid) {
              name plan
              customer { currentUsage remainingUsageCreditBalance state }
            }
          }`,
          { wid: workspaceId }
        );
        const ws = billingData?.data?.workspace;
        if (ws) {
          const currentUsage = ws.customer?.currentUsage ?? 0;
          const now = new Date();
          const dayOfMonth = now.getDate();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const estimatedUsage = currentUsage * (daysInMonth / dayOfMonth);
          railway = {
            workspaceName: ws.name,
            plan: ws.plan,
            currentUsage,
            estimatedUsage,
            remainingCredit: ws.customer?.remainingUsageCreditBalance ?? null,
            state: ws.customer?.state ?? null,
          };
        }
      }
    } catch (err) {
      console.error("[Finances] Railway API error:", err.message);
    }
  }

  const { data: cfgData } = await supabase
    .from("finance_config")
    .select("overrides")
    .eq("id", "singleton")
    .single();
  const push = { month, sentCount: cfgData?.overrides?.push_count || 6, freeLimit: 10000 };

  res.json({ vision, railway, push });
});

router.get("/api/finances/config", requireAuth, require2FA, requireOwner, async (_req, res) => {
  const { data, error } = await supabase
    .from("finance_config")
    .select("overrides, updated_by, updated_at")
    .eq("id", "singleton")
    .single();
  if (error && error.code !== "PGRST116") return res.status(500).json({ error: error.message });
  res.json(data ?? { overrides: {}, updated_by: null, updated_at: null });
});

router.patch("/api/finances/config", requireAuth, require2FA, requireOwner, async (req, res) => {
  const { overrides } = req.body;
  if (!overrides || typeof overrides !== "object") return res.status(400).json({ error: "overrides object required" });
  const { data, error } = await supabase
    .from("finance_config")
    .upsert({ id: "singleton", overrides, updated_by: req.user.id, updated_at: new Date().toISOString() })
    .select("overrides, updated_by, updated_at")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get("/api/finances/expenses", requireAuth, require2FA, requireOwner, async (_req, res) => {
  const { data, error } = await supabase
    .from("finance_expenses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

router.post("/api/finances/expenses", requireAuth, require2FA, requireOwner, async (req, res) => {
  const { name, amount, type, date, notes } = req.body;
  if (!name || amount == null || !type) return res.status(400).json({ error: "name, amount, type required" });
  const { data, error } = await supabase
    .from("finance_expenses")
    .insert({ name, amount: parseFloat(amount), type, date: date || null, notes: notes || null, created_by: req.user.id })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch("/api/finances/expenses/:id", requireAuth, require2FA, requireOwner, async (req, res) => {
  const { name, amount, type, date, notes } = req.body;
  if (!name || amount == null || !type) return res.status(400).json({ error: "name, amount, type required" });
  const { data, error } = await supabase
    .from("finance_expenses")
    .update({ name, amount: parseFloat(amount), type, date: date || null, notes: notes || null })
    .eq("id", req.params.id)
    .eq("created_by", req.user.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Expense not found" });
  res.json(data);
});

router.delete("/api/finances/expenses/:id", requireAuth, require2FA, requireOwner, async (req, res) => {
  const { error } = await supabase
    .from("finance_expenses")
    .delete()
    .eq("id", req.params.id)
    .eq("created_by", req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
