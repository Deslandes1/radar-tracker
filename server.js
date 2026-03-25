const express = require('express');
const axios = require('axios');
const app = express();

// Serve static files (index.html, etc.)
app.use(express.static('.'));

// Proxy endpoint for OpenSky Network
app.get('/api/aircraft', async (req, res) => {
  const { lat, lon, radius } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing lat, lon, or radius' });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radiusNum = parseFloat(radius);

  try {
    const response = await axios.get('https://opensky-network.org/api/states/all');
    const allStates = response.data.states || [];

    const aircraftInRange = [];
    for (const state of allStates) {
      const icao24 = state[0];
      const callsign = state[1] ? state[1].trim() : null;
      const longitude = state[5];
      const latitude = state[6];
      const geoAltitude = state[7];
      const onGround = state[8];
      const velocity = state[9];
      const heading = state[10];
      const verticalRate = state[11];

      if (latitude === null || longitude === null) continue;

      // Haversine distance
      const R = 6371;
      const dLat = (latitude - latNum) * Math.PI / 180;
      const dLon = (longitude - lonNum) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 +
                Math.cos(latNum * Math.PI/180) * Math.cos(latitude * Math.PI/180) *
                Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      if (distance <= radiusNum) {
        aircraftInRange.push({
          icao24,
          callsign: callsign || `FLT${icao24.slice(-4)}`,
          lat: latitude,
          lon: longitude,
          geoAltitude: geoAltitude || null,
          velocity: velocity || null,
          heading: heading || null,
          verticalRate: verticalRate || null,
          onGround: onGround || false,
          distance: distance
        });
      }
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const ac of aircraftInRange) {
      if (!seen.has(ac.icao24)) {
        seen.add(ac.icao24);
        unique.push(ac);
      }
    }

    res.json({ success: true, aircraft: unique });
  } catch (error) {
    console.error('OpenSky API error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch flight data' });
  }
});

// Use the port provided by Render, or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Radar server running on port ${PORT}`);
});
