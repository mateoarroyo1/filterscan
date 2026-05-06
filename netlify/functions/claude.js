// netlify/functions/claude.js

exports.handler = async function(event) {

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no configurada");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key no configurada" })
    };
  }

  let imageBase64;
  try {
    const body = JSON.parse(event.body);
    imageBase64 = body.imageBase64;
  } catch(e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Body inválido" })
    };
  }

  if (!imageBase64) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Falta imageBase64" })
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
            },
            {
              type: "text",
              text: "Esta imagen es la etiqueta de un filtro automotriz o industrial.\nTu única tarea: encontrar el código alfanumérico del filtro (puede contener letras, números y a veces slash /).\nEjemplos de códigos: H601/4, P550309, FF5488, HF6162, 1457429820, BD7T3K758A, WK954/1X\n\nRESPONDE ÚNICAMENTE con el código del filtro, sin texto extra, sin explicación.\nSi detectás varios candidatos, elegí el más probable (suele ser el más prominente o grande en la etiqueta).\nSi no hay ningún código visible, responde: NO_DETECTADO"
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log("Respuesta Anthropic:", JSON.stringify(data));

    if (data.error) {
      console.error("Error Anthropic:", data.error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error.message })
      };
    }

    const codigo = data.content?.[0]?.text?.trim() || "NO_DETECTADO";
    console.log("Código detectado:", codigo);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo })
    };

  } catch(err) {
    console.error("Error general:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
