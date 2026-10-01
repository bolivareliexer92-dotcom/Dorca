const DEFAULT_RATES = {
  cv: 3.98,
  vc: 3.00,
  bcv: 857.01,
  colusd: 3330,
  buy: 3150,
  sell: 3360
};

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = "";

    req.on("data", chunk => {
      s += chunk;
    });

    req.on("end", () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
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

module.exports = async (req, res) => {
  try {

    // CONSULTAR TASAS PUBLICADAS
    if (req.method === "GET") {

      const rows = await supabaseRequest(
        "dorca_rates?select=id,cv,vc,bcv,colusd,buy,sell,updated_at,from_date,to_date&order=id.asc&limit=1"
      );

      return send(res, 200, {
        ok: true,
        rates: rows?.[0] || {
          id: 1,
          ...DEFAULT_RATES
        }
      });
    }

    // SOLO ACEPTAMOS POST PARA ADMINISTRACIÓN
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");

      return send(res, 405, {
        ok: false,
        error: "Método no permitido."
      });
    }

    const body = await readBody(req);

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return send(res, 500, {
        ok: false,
        error: "ADMIN_PASSWORD no está configurada en Vercel."
      });
    }

    // COMPROBAR CONTRASEÑA
    if (
      String(body.password || "") !==
      String(adminPassword)
    ) {
      return send(res, 401, {
        ok: false,
        error: "Contraseña incorrecta."
      });
    }

    // ENTRAR AL ADMINISTRADOR
    if ((body.action || "login") === "login") {

      const rows = await supabaseRequest(
        "dorca_rates?select=id,cv,vc,bcv,colusd,buy,sell,updated_at,from_date,to_date&order=id.asc&limit=1"
      );

      return send(res, 200, {
        ok: true,
        authenticated: true,
        rates: rows?.[0] || {
          id: 1,
          ...DEFAULT_RATES
        }
      });
    }

    // GUARDAR NUEVAS TASAS
    if (body.action === "save") {

      const r = body.rates || {};

      const next = {
        id: 1,

        cv: Number(r.cv) || DEFAULT_RATES.cv,
        vc: Number(r.vc) || DEFAULT_RATES.vc,
        bcv: Number(r.bcv) || DEFAULT_RATES.bcv,
        colusd: Number(r.colusd) || DEFAULT_RATES.colusd,
        buy: Number(r.buy) || DEFAULT_RATES.buy,
        sell: Number(r.sell) || DEFAULT_RATES.sell,

        updated_at: new Date().toISOString(),

        from_date: r.from_date || null,
        to_date: r.to_date || null
      };

      const saved = await supabaseRequest(
        "dorca_rates?on_conflict=id",
        {
          method: "POST",

          headers: {
            Prefer:
              "resolution=merge-duplicates,return=representation"
          },

          body: JSON.stringify(next)
        }
      );

      return send(res, 200, {
        ok: true,

        saved: saved?.[0] || next,

        message:
          "Tasas publicadas correctamente."
      });
    }

    return send(res, 400, {
      ok: false,
      error: "Acción no reconocida."
    });

  } catch (error) {

    console.error(error);

    return send(res, 500, {
      ok: false,
      error:
        error.message ||
        "Error interno del servidor."
    });
  }
};
