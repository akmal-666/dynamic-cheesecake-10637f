// netlify/functions/whatsapp.js
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { token, target, message, countryCode } = JSON.parse(event.body);

    if (!token || !target || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'token, target, message required' }),
      };
    }

    const formData = new FormData();
    formData.append('target', target);
    formData.append('message', message);
    if (countryCode) formData.append('countryCode', countryCode);

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });

    const result = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
