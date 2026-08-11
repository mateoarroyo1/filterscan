/*
 * Guarda database.json directamente en el repositorio de GitHub.
 *
 * El token de GitHub vive acá, en el servidor, y nunca llega al navegador.
 * La contraseña también se verifica acá: por eso es un login de verdad y no
 * un cartel que se puede saltear mirando el código de la página.
 *
 * Variables de entorno necesarias (Netlify → Site settings → Environment variables):
 *
 *   ADMIN_PASSWORD   la contraseña para entrar a admin.html
 *   GITHUB_TOKEN     token de GitHub con permiso de escritura en el repositorio
 *   GITHUB_REPO      usuario/repositorio   (por ejemplo: mateoarroyo1/filterscan)
 *   GITHUB_BRANCH    opcional, por defecto "main"
 */

/* Esta función escribe dos archivos distintos según lo que le pidan:
   la base de filtros o la configuración visual (logo, nombre, tema). */
const ARCHIVOS = { database: 'database.json', config: 'config.json' };
const MAX_LOGO = 300 * 1024;   // 300 KB de logo en base64

exports.handler = async (event) => {
  const cors = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const CLAVE  = process.env.ADMIN_PASSWORD;
  const TOKEN  = process.env.GITHUB_TOKEN;
  const REPO   = process.env.GITHUB_REPO;
  const RAMA   = process.env.GITHUB_BRANCH || 'main';

  let cuerpo;
  try { cuerpo = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Pedido mal formado' }) }; }

  /* Consulta sin contraseña: solo dice si el servidor está listo para publicar.
     Sirve para que el editor abra igual cuando todavía no se configuró nada,
     en vez de dejar a la persona afuera sin poder hacer nada. */
  const configurado = !!(CLAVE && TOKEN && REPO);
  if (cuerpo.accion === 'estado') {
    return { statusCode: 200, headers: cors, body: JSON.stringify({
      configurado,
      falta: configurado ? [] : [
        !CLAVE && 'ADMIN_PASSWORD', !TOKEN && 'GITHUB_TOKEN', !REPO && 'GITHUB_REPO'
      ].filter(Boolean)
    }) };
  }

  if (!configurado) {
    return { statusCode: 503, headers: cors, body: JSON.stringify({
      error: 'Falta configurar el servidor. Revisá las variables ADMIN_PASSWORD, GITHUB_TOKEN y GITHUB_REPO en Netlify.'
    }) };
  }

  /* Comparación en tiempo constante, para que no se pueda adivinar la
     contraseña midiendo cuánto tarda en responder. */
  const iguales = (a, b) => {
    const x = String(a || ''), y = String(b || '');
    let dif = x.length ^ y.length;
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      dif |= x.charCodeAt(i % x.length || 0) ^ y.charCodeAt(i % y.length || 0);
    }
    return dif === 0;
  };

  if (!iguales(cuerpo.clave, CLAVE)) {
    await new Promise(r => setTimeout(r, 600));   // frena los intentos a repetición
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Contraseña incorrecta' }) };
  }

  // Solo verificar la contraseña, sin guardar nada
  if (cuerpo.accion === 'verificar') {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  }

  /* ── Revisar que lo que llega tenga sentido ── */
  const cual = cuerpo.archivo === 'config' ? 'config' : 'database';
  const ARCHIVO = ARCHIVOS[cual];
  let contenidoJson, resumen;

  if (cual === 'config') {
    const c = cuerpo.config;
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'La configuración no tiene el formato esperado' }) };
    }
    if (typeof c.logo === 'string' && c.logo.length > MAX_LOGO) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({
        error: `El logo pesa ${Math.round(c.logo.length / 1024)} KB y el máximo son ${MAX_LOGO / 1024} KB. Probá con una imagen más chica.`
      }) };
    }
    if (typeof c.logo === 'string' && c.logo && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(c.logo)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'El logo tiene que ser una imagen PNG, JPG, WEBP o SVG' }) };
    }
    contenidoJson = JSON.stringify(c, null, 1);
    resumen = { empresa: c.empresa || '', conLogo: !!c.logo, tema: c.tema || 'claro' };

  } else {
    const base = cuerpo.database;
    if (!base || typeof base !== 'object' || Array.isArray(base)) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'La base no tiene el formato esperado' }) };
    }
    const claves = Object.keys(base);
    if (claves.length < 10) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({
        error: `Solo llegaron ${claves.length} grupos. Por seguridad no se guarda una base tan chica; parece un error.`
      }) };
    }
    let totalCodigos = 0;
    for (const k of claves) {
      const g = base[k];
      if (!g || typeof g.tipo !== 'string' || !Array.isArray(g.modelos) || !Array.isArray(g.codigos)) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `El grupo "${k}" está mal formado` }) };
      }
      totalCodigos += g.codigos.length;
    }
    if (totalCodigos < 100) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({
        error: `Solo llegaron ${totalCodigos} códigos. Por seguridad no se guarda; parece un error.`
      }) };
    }
    contenidoJson = JSON.stringify(base, null, 1);
    resumen = { grupos: claves.length, codigos: totalCodigos };
  }

  /* ── Guardar en GitHub ── */
  const api = `https://api.github.com/repos/${REPO}/contents/${ARCHIVO}`;
  const cabeceras = {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'RepSearch'
  };

  try {
    // GitHub exige el identificador de la versión actual para no pisar cambios ajenos
    const actual = await fetch(`${api}?ref=${encodeURIComponent(RAMA)}`, { headers: cabeceras });
    if (!actual.ok && actual.status !== 404) {
      const t = await actual.text();
      return { statusCode: 502, headers: cors, body: JSON.stringify({
        error: `GitHub rechazó la lectura (${actual.status}). Revisá el token y el nombre del repositorio.`,
        detalle: t.slice(0, 200)
      }) };
    }
    const sha = actual.ok ? (await actual.json()).sha : undefined;

    const contenido = Buffer.from(contenidoJson, 'utf8').toString('base64');
    const quien = (cuerpo.autor || 'admin').toString().slice(0, 40);
    const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const mensaje = cual === 'config'
      ? `Actualizar configuración (${quien}, ${fecha})`
      : `Actualizar filtros — ${resumen.grupos} grupos, ${resumen.codigos} códigos (${quien}, ${fecha})`;

    const guardado = await fetch(api, {
      method: 'PUT',
      headers: cabeceras,
      body: JSON.stringify({
        message: mensaje,
        content: contenido,
        branch: RAMA,
        ...(sha ? { sha } : {})
      })
    });

    if (!guardado.ok) {
      const t = await guardado.text();
      return { statusCode: 502, headers: cors, body: JSON.stringify({
        error: `GitHub rechazó el guardado (${guardado.status}). Puede que el token no tenga permiso de escritura.`,
        detalle: t.slice(0, 200)
      }) };
    }

    const r = await guardado.json();
    return { statusCode: 200, headers: cors, body: JSON.stringify({
      ok: true, archivo: cual, ...resumen,
      commit: r.commit && r.commit.sha ? r.commit.sha.slice(0, 7) : null
    }) };

  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({
      error: 'No se pudo contactar a GitHub. Revisá la conexión e intentá de nuevo.'
    }) };
  }
};
