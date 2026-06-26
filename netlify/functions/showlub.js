// netlify/functions/showlub.js
// Busca directamente en showlub sin Google CSE

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { q } = event.queryStringParameters || {};
  if (!q) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Falta el parámetro q' })
    };
  }

  try {
    // Buscar en showlub directamente
    const searchUrl = 'https://www.showlub.com.br/busca?q=' + encodeURIComponent(q);
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await res.text();

    // Extraer el primer link de producto
    // Los productos tienen pattern: href="/SLUG-filtro-de-..."
    const match = html.match(/href="(\/[a-z0-9\-]+(?:filtro|oleo|combustivel|ar|hidraulico|cabine|secador)[^"]*?)"/i);

    if (match && match[1]) {
      const link = 'https://www.showlub.com.br' + match[1];
      console.log('Encontrado:', link);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      };
    }

    // Segundo intento: cualquier link de producto con slug largo
    const match2 = html.match(/href="(\/[a-z0-9]{6,}[a-z0-9\-]{10,}?)"/i);
    if (match2 && match2[1] && !match2[1].includes('busca') && !match2[1].includes('marca') && !match2[1].includes('conta')) {
      const link = 'https://www.showlub.com.br' + match2[1];
      console.log('Encontrado (2):', link);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      };
    }

    console.log('No encontrado para:', q);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: null })
    };

  } catch(err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
