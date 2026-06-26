// netlify/functions/showlub.js

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CSE_ID  = process.env.GOOGLE_CSE_ID;

  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Variables de entorno no configuradas' })
    };
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
    const query = q;
    const url = 'https://www.googleapis.com/customsearch/v1?key=' + GOOGLE_API_KEY +
                '&cx=' + GOOGLE_CSE_ID +
                '&q=' + encodeURIComponent(query) +
                '&num=1';

    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error.message })
      };
    }

    const link = data.items && data.items[0] ? data.items[0].link : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link })
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
