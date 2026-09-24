import { Router } from 'express';
import { pool } from '../utils/db';

const router = Router();

function generateMeetingCode(): string {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `MTG-${random}`;
}

function generatePassword(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create a new meeting
router.post('/', async (req, res) => {
  try {
    const { hostId, customerName, customerEmail, customerPhone, scheduledDate, scheduledTime } = req.body;

    if (!customerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const meetingCode = generateMeetingCode();
    const password = generatePassword();

    const result = await pool.query(
      `INSERT INTO meetings (meeting_code, host_id, customer_name, customer_email, customer_phone, scheduled_date, scheduled_time, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [meetingCode, hostId, customerName, customerEmail, customerPhone, scheduledDate, scheduledTime, password]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all meetings
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM meetings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Customer join: verify meeting code + password
router.post('/join', async (req, res) => {
  try {
    const { meetingCode, password } = req.body;

    if (!meetingCode || !password) {
      return res.status(400).json({ message: 'Meeting ID and password are required' });
    }

    const result = await pool.query(
      'SELECT * FROM meetings WHERE meeting_code = $1',
      [meetingCode.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const meeting = result.rows[0];

    if (meeting.password !== password.trim().toUpperCase()) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    res.json(meeting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;