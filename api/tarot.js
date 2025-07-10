// File: /api/tarot.js

export default async function handler(request, response) {
  // Get the number of cards to draw 'n' from the request URL
  const { n } = request.query;

  if (!n) {
    return response.status(400).json({ error: 'Number of cards (n) is required' });
  }

  const apiUrl = `https://tarot-api.onrender.com/api/v1/cards/random?n=${n}`;

  try {
    const apiResponse = await fetch(apiUrl);
    
    // This API can be slow or sleep, so we handle its errors gracefully
    if (!apiResponse.ok) {
      console.error('Tarot API failed with status:', apiResponse.status);
      return response.status(apiResponse.status).json({ error: 'The Tarot API is currently unavailable. Please try again later.' });
    }

    const data = await apiResponse.json();

    // Send the data back to the frontend
    return response.status(200).json(data);

  } catch (error) {
    console.error('Error fetching from Tarot API:', error);
    return response.status(500).json({ error: 'Failed to fetch from the Tarot API.' });
  }
}