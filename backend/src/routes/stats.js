import express from 'express';
import * as repo from '../db/repository.js';

const router = express.Router();

// POST /api/stats/visit
router.post('/visit', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await repo.upsertPlatformVisit(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking visit:', error);
    res.status(500).json({ error: 'Failed to track visit' });
  }
});

// GET /api/stats/global
router.get('/global', async (req, res) => {
  try {
    const stats = await repo.getGlobalPlatformStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({ error: 'Failed to fetch global statistics' });
  }
});

export default router;
