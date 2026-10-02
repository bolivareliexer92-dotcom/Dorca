const DEFAULT_RATES = {
  coVe: 3.98,
  veCo: 3.00,
  usdCo: 3330,
  usdVe: 855.66
};

function send(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

async function supabaseRequest(path, options = {}) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase no está configurado en Vercel.");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.hint ||
      text ||
      "Error de Supabase."
    );
  }

  return data;
}

async function getRates() {
  const rows = await supabaseRequest(
    "dorca_rates?select=id,cv,vc,bcv,colusd,buy,sell,updated_at,from_date,to_date&order=id.asc&limit=1"
  );

  const row = rows?.[0];

  if (!row) {
    return {
      co_ve: DEFAULT_RATES.coVe,
      ve_co: DEFAULT_RATES.veCo,
      usd_colombia: DEFAULT_RATES.usdCo,
      usd_venezuela: DEFAULT_RATES.usdVe,
      valid_from: null,
      valid_to: null
    };
  }

  return {
    co_ve: Number(row.cv ?? DEFAULT_RATES.coVe),
    ve_co: Number(row.vc ?? DEFAULT_RATES.veCo),
    usd_colombia: Number(row.colusd ?? DEFAULT_RATES.usdCo),
    usd_venezuela: Number(row.bcv ?? DEFAULT_RATES.usdVe),
    valid_from: row.from_date || null,
    valid_to: row.to_date || null,
    updated_at: row.updated_at || null
  };
}

async function getHistory() {
  const rows = await supabaseRequest(
    "dorca_rates?select=id,cv,vc,bcv,colusd,buy,sell,updated_at,from_date,to_date&order=id.desc"
  );

  return (rows || []).map(row => ({
    id: row.id,
    co_ve: Number(row.cv ?? DEFAULT_RATES.coVe),
    ve_co: Number(row.vc ?? DEFAULT_RATES.veCo),
    usd_colombia: Number(row.colusd ?? DEFAULT_RATES.usdCo),
    usd_venezuela: Number(row.bcv ?? DEFAULT_RATES.usdVe
