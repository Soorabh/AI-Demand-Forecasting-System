// Public lookup routes for the forecast form (country and state dropdowns).
// They forward to the Python service so the browser only ever talks to Node.

const express = require('express');
const axios = require('axios');

const router = express.Router();
const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://python-service:8000';

const forward = (pathFor) => async (req, res) => {
  try {
    const response = await axios.get(`${AI_BACKEND_URL}${pathFor(req)}`, { timeout: 15000 });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error proxying geo request to AI backend:', error.message);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(504).json({ message: 'Gateway Timeout: No response from AI service.' });
    }
  }
};

router.get('/countries', forward(() => '/api/countries'));
router.get(
  '/subdivisions/:countryCode',
  forward((req) => `/api/subdivisions/${encodeURIComponent(req.params.countryCode)}`)
);

module.exports = router;
