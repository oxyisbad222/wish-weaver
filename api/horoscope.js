// File: /api/horoscope.js

export default async function handler(request, response) {
  // Get the 'sign' and 'type' (daily, weekly, monthly) from the request URL
  const { sign, type, day } = request.query;

  if (!sign || !type) {
    return response.status(400).json({ error: 'Sign and type are required' });
  }

  // Construct the correct API URL based on the type
  let apiUrl;
  if (type === 'daily') {
    apiUrl = `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=${day || 'TODAY'}`;
  } else {
    apiUrl = `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/${type}?sign=${sign}`;
  }
  
  try {
    const apiResponse = await fetch(apiUrl);

    // If the API call wasn't successful, forward the error
    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json(await apiResponse.json());
    }

    const data = await apiResponse.json();
    
    // Set caching headers
    response.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');
    
    // Send the data back to the frontend
    return response.status(200).json(data);

  } catch (error) {
    return response.status(500).json({ error: 'Failed to fetch from horoscope API' });
  }
}