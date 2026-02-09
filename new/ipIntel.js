const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post('/ip-intel', async (req, res) => {
    try {
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({ error: "ip missing" });
        }

        const response = await axios.get(
            `https://vpnapi.io/api/${ip}?key=${process.env.VPNAPI_KEY}`,
            { timeout: 5000 }
        );

        const data = response.data;
        const security = data.security || {};

        res.json({
            vpn: Boolean(security.vpn),
            proxy: Boolean(security.proxy),
            hosting: Boolean(security.hosting)
        });

    } catch (error) {
        console.error(error.message);

        if (error.response) {
            res.status(error.response.status).json({
                error: 'API request failed',
                details: error.response.data
            });
        } else if (error.request) {
            res.status(500).json({ error: 'No response from VPN API' });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
