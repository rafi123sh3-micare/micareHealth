const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.SUPABASE_URL, process.env.ANON_KEY);
(async () => {
  const { data, error } = await sb.from("appointments").select("id, date, serial_number, booked_by").eq("booked_by", "Nafe").limit(3);
  console.log("ANON read:", error ? "ERROR: " + error.message : "OK rows=" + data.length);
  const { data: d, error: e2 } = await sb.from("appointments").select("id, date").eq("date", "2026-08-02").limit(3);
  console.log("ANON date query:", e2 ? "ERROR: " + e2.message : "OK rows=" + d.length);
})();
