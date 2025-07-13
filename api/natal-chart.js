// File: /api/natal-chart.js

const axios = require('axios');

// API Keys
const ASTROLOGY_API_KEY = 'QXfRyay2C83YyJ4DI69x73GF1CFNGXYR9acURhku';
const GEOCODE_API_KEY = '687377023db4e495403833dpge29980';
// You will need to sign up for a free TimeZoneDB API key at https://timezonedb.com/register
const TIMEZONEDB_API_KEY = process.env.TIMEZONEDB_API_KEY || 'YZGKWWZ1KR8E';

// API URLs
const GEOCODE_API_URL = 'https://geocode.maps.co/search';
const ASTROLOGY_API_URL = 'https://json.freeastrologyapi.com/western/planets';
const TIMEZONEDB_URL = 'http://api.timezonedb.com/v2.1/get-time-zone';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { date, time, location } = request.body;

    if (!date || !time || !location) {
        return response.status(400).json({ error: 'Birth date, time, and location are required.' });
    }

    try {
        // 1. Geocode the location to get latitude and longitude
        const geocodeResponse = await axios.get(GEOCODE_API_URL, {
            params: { q: location, api_key: GEOCODE_API_KEY }
        });

        if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
            return response.status(400).json({ error: 'Could not find coordinates for the location provided.' });
        }
        const { lat, lon } = geocodeResponse.data[0];

        // 2. Get the timezone offset from TimeZoneDB
        const timezoneResponse = await axios.get(TIMEZONEDB_URL, {
            params: {
                key: TIMEZONEDB_API_KEY,
                format: 'json',
                by: 'position',
                lat: lat,
                lng: lon,
            }
        });

        if (timezoneResponse.data.status !== 'OK') {
            throw new Error(timezoneResponse.data.message || 'Failed to get timezone information.');
        }
        const gmtOffset = timezoneResponse.data.gmtOffset / 3600;

        // 3. Call the Free Astrology API with all the data
        const [year, month, day] = date.split('-');
        const [hour, minute] = time.split(':');

        const apiResponse = await axios.post(ASTROLOGY_API_URL, {
            year: parseInt(year),
            month: parseInt(month),
            date: parseInt(day),
            hours: parseInt(hour),
            minutes: parseInt(minute),
            seconds: 0,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            timezone: gmtOffset,
            config: {
                observation_point: "topocentric",
                ayanamsha: "tropical"
            }
        }, {
            headers: {
                'x-api-key': ASTROLOGY_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // Set cache headers for Vercel
        response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');

        return response.status(200).json(apiResponse.data);

    } catch (error) {
        const errorDetails = error.response ? error.response.data : error.message;
        console.error('Error in natal-chart handler:', errorDetails);
        return response.status(error.response?.status || 500).json({
            error: 'Failed to generate natal chart.',
            details: errorDetails
        });
    }
}