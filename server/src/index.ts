import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
const port = Number(process.env.PORT || 4000);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const demoReceipts = new Map<string, { data: Buffer; mimeType: string }>();
type Loan = { id: string; friendName: string; amount: number; dueDate: string; repaid: boolean; repaidAt?: string | null; hasReceipt: boolean; createdAt: string };
const demoLoans: Loan[] = [
  { id: 'demo-1', friendName: 'Aarav Sharma', amount: 1200, dueDate: '2026-10-20', repaid: false, hasReceipt: false, createdAt: '2026-10-10' },
  { id: 'demo-2', friendName: 'Meera Patel', amount: 650, dueDate: '2026-10-29', repaid: false, hasReceipt: false, createdAt: '2026-10-21' },
  { id: 'demo-3', friendName: 'Kabir Rao', amount: 900, dueDate: '2026-10-18', repaid: true, repaidAt: '2026-10-19', hasReceipt: false, createdAt: '2026-10-01' },
];

async function initDb() {
  if (!pool) return;
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), friend_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), due_date DATE NOT NULL,
    repaid BOOLEAN NOT NULL DEFAULT FALSE, repaid_at TIMESTAMPTZ,
    receipt_data BYTEA, receipt_mime TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('ALTER TABLE loans ADD COLUMN IF NOT EXISTS repaid_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_data BYTEA');
  await pool.query('ALTER TABLE loans ADD COLUMN IF NOT EXISTS receipt_mime TEXT');
}
function mapLoan(row: any): Loan {
  return { id: row.id, friendName: row.friend_name ?? row.friendName, amount: Number(row.amount),
    dueDate: String(row.due_date).slice(0, 10), repaid: row.repaid,
    repaidAt: row.repaid_at ? new Date(row.repaid_at).toISOString().slice(0, 10) : null,
    hasReceipt: Boolean(row.receipt_data),
    createdAt: String(row.created_at).slice(0, 10) };
}
async function allLoans(): Promise<Loan[]> {
  if (!pool) return demoLoans;
  const { rows } = await pool.query('SELECT * FROM loans ORDER BY created_at DESC');
  return rows.map(mapLoan);
}

app.get('/health', (_req, res) => res.json({ ok: true, storage: pool ? 'postgres' : 'demo-memory' }));
app.post('/api/auth/request-otp', (req, res) => {
  const body = z.object({ phone: z.string().regex(/^\+?[0-9]{10,15}$/) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a valid phone number.' });
  const otp = '123456';
  console.log(`[mock OTP] ${body.data.phone}: ${otp}`);
  return res.json({ message: 'Mock OTP sent. Check the API terminal.' });
});
app.post('/api/auth/verify-otp', (req, res) => {
  const body = z.object({ phone: z.string(), otp: z.string() }).safeParse(req.body);
  if (!body.success || body.data.otp !== '123456') return res.status(400).json({ error: 'Incorrect OTP. Use 123456 for this demo.' });
  return res.json({ token: 'demo-session-token', phone: body.data.phone });
});
app.get('/api/loans', async (_req, res, next) => {
  try { res.json(await allLoans()); } catch (err) { next(err); }
});
app.delete('/api/loans/:id', async (req, res, next) => {
  try {
    if (pool) {
      const result = await pool.query('DELETE FROM loans WHERE id = $1', [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Loan not found.' });
    } else {
      const index = demoLoans.findIndex((loan) => loan.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: 'Loan not found.' });
      demoLoans.splice(index, 1);
      demoReceipts.delete(req.params.id);
    }
    return res.json({ deleted: true });
  } catch (err) { return next(err); }
});
app.delete('/api/loans', async (_req, res, next) => {
  try {
    let deletedCount: number;
    if (pool) {
      const result = await pool.query('DELETE FROM loans');
      deletedCount = result.rowCount ?? 0;
    } else {
      deletedCount = demoLoans.length;
      demoLoans.splice(0, demoLoans.length);
      demoReceipts.clear();
    }
    return res.json({ deletedCount });
  } catch (err) { return next(err); }
});
app.post('/api/loans', upload.single('receipt'), async (req, res, next) => {
  const body = z.object({ friendName: z.string().trim().min(1).max(80), amount: z.coerce.number().positive().max(10000000), dueDate: z.iso.date() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Enter a name, positive amount, and valid due date.' });
  if (req.file && !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Receipt must be a JPEG, PNG, WebP, or HEIC image.' });
  }
  const receiptBase64 = req.body.receiptBase64;
  let receiptBuffer = req.file?.buffer;
  let receiptMime = req.file?.mimetype;
  if (receiptBase64 !== undefined) {
    if (typeof receiptBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(receiptBase64)) {
      return res.status(400).json({ error: 'Receipt image data is invalid.' });
    }
    if (Buffer.byteLength(receiptBase64, 'base64') > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Receipt image must be 5 MB or smaller.' });
    }
    receiptBuffer = Buffer.from(receiptBase64, 'base64');
    receiptMime = req.body.receiptMimeType === 'image/jpeg' ? 'image/jpeg' : undefined;
    if (!receiptMime) return res.status(400).json({ error: 'Receipt must be a JPEG image.' });
  }
  try {
    let loan: Loan;
    if (pool) {
      const { rows } = await pool.query(
        'INSERT INTO loans(friend_name, amount, due_date, receipt_data, receipt_mime) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [body.data.friendName, body.data.amount, body.data.dueDate, receiptBuffer ?? null, receiptMime ?? null]
      );
      loan = mapLoan(rows[0]);
    } else {
      loan = { id: crypto.randomUUID(), ...body.data, repaid: false, hasReceipt: Boolean(receiptBuffer), createdAt: new Date().toISOString().slice(0, 10) };
      demoLoans.unshift(loan);
      if (receiptBuffer && receiptMime) demoReceipts.set(loan.id, { data: receiptBuffer, mimeType: receiptMime });
    }
    res.status(201).json(loan);
  } catch (err) { next(err); }
});
app.get('/api/loans/:id/receipt', async (req, res, next) => {
  try {
    let receipt: { data: Buffer; mimeType: string } | undefined;
    if (pool) {
      const { rows } = await pool.query('SELECT receipt_data, receipt_mime FROM loans WHERE id = $1', [req.params.id]);
      if (rows[0]?.receipt_data) receipt = { data: rows[0].receipt_data, mimeType: rows[0].receipt_mime || 'image/jpeg' };
    } else {
      receipt = demoReceipts.get(req.params.id);
    }
    if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });
    res.setHeader('Content-Type', receipt.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(receipt.data);
  } catch (err) { return next(err); }
});
app.patch('/api/loans/:id/repaid', async (req, res, next) => {
  try {
    if (pool) {
      const { rows } = await pool.query('UPDATE loans SET repaid = TRUE, repaid_at = COALESCE(repaid_at, NOW()) WHERE id = $1 RETURNING *', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Loan not found.' });
      return res.json(mapLoan(rows[0]));
    }
    const loan = demoLoans.find((item) => item.id === req.params.id);
    if (!loan) return res.status(404).json({ error: 'Loan not found.' });
    if (!loan.repaid) {
      loan.repaid = true;
      loan.repaidAt = new Date().toISOString().slice(0, 10);
    }
    return res.json(loan);
  } catch (err) { next(err); }
});
app.get('/api/summary', async (_req, res, next) => {
  try {
    const loans = await allLoans();
    const today = new Date().toISOString().slice(0, 10);
    const totalLent = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const totalRepaid = loans.filter((loan) => loan.repaid).reduce((sum, loan) => sum + loan.amount, 0);
    const overdueAmount = loans.filter((loan) => !loan.repaid && loan.dueDate < today).reduce((sum, loan) => sum + loan.amount, 0);
    res.json({ totalLent, totalRepaid, overdueAmount });
  } catch (err) { next(err); }
});
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: 'Receipt image must be 5 MB or smaller.' });
  }
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Receipt image must be 5 MB or smaller.' : 'Could not upload receipt image.' });
  }
  console.error(err); res.status(500).json({ error: 'Server error. Check the API terminal.' });
});
initDb().then(() => app.listen(port, '0.0.0.0', () => console.log(`MiniLedger API listening on http://0.0.0.0:${port} (${pool ? 'PostgreSQL' : 'demo memory mode'})`))).catch((err) => { console.error('Database startup failed:', err); process.exit(1); });
