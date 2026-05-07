// netlify/functions/sheets.js
// Proxy para evitar CORS con Google Apps Script

const SHEET_URL = "https://script.google.com/macros/s/AKfycby6yqT-YhUekkn08rEZDlGivKneBl1eGjJmWwJXWaeNsyB_PbqcL6tIHLnQmfFSQAJorw/exec";

exports.handler = async function(event) {

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    let response;

    if (event.httpMethod === "GET") {
      // GET: pasar query params tal cual
      const params = event.queryStringParameters || {};
      const query = new URLSearchParams(params).toString();
      response = await fetch(SHEET_URL + (query ? "?" + query : ""));

    } else if (event.httpMethod === "POST") {
      // POST: pasar body tal cual
      response = await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body
      });

    } else {
      return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch(err) {
    console.error("Error sheets proxy:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
