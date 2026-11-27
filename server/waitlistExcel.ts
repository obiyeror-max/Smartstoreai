import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import type { WaitlistEntry } from '../src/types.ts';

const DATA_DIR =
  process.env.VERCEL || process.env.VERCEL_ENV
    ? '/tmp/smartstore-data'
    : path.resolve(process.cwd(), 'data');

export const WAITLIST_EXCEL_FILE = path.join(DATA_DIR, 'sabi-waitlist.xlsx');

async function buildWaitlistWorkbook(entries: WaitlistEntry[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sabi AI';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Waitlist Signups', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: '#', key: 'position', width: 6 },
    { header: 'Joined At', key: 'createdAt', width: 22 },
    { header: 'Full Name', key: 'fullName', width: 24 },
    { header: 'Shop Name', key: 'shopName', width: 30 },
    { header: 'City / State', key: 'city', width: 24 },
    { header: 'Email Address', key: 'email', width: 30 },
    { header: 'WhatsApp Number', key: 'whatsappNumber', width: 20 },
    { header: 'Store Type', key: 'storeCategory', width: 18 },
    { header: 'Team Size', key: 'staffCountRange', width: 14 },
    { header: 'Reference ID', key: 'id', width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF047857' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  entries.forEach((entry, index) => {
    sheet.addRow({
      position: index + 1,
      createdAt: new Date(entry.createdAt).toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      fullName: entry.fullName,
      shopName: entry.shopName,
      city: entry.city,
      email: entry.email || '—',
      whatsappNumber: entry.whatsappNumber || '—',
      storeCategory: entry.storeCategory,
      staffCountRange: `${entry.staffCountRange} staff`,
      id: entry.id,
    });
  });

  sheet.autoFilter = {
    from: 'A1',
    to: `J${Math.max(1, entries.length + 1)}`,
  };

  return workbook;
}

export async function syncWaitlistExcelFile(entries: WaitlistEntry[]): Promise<void> {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const workbook = await buildWaitlistWorkbook(entries);
    const tmpPath = `${WAITLIST_EXCEL_FILE}.tmp`;
    await workbook.xlsx.writeFile(tmpPath);
    fs.renameSync(tmpPath, WAITLIST_EXCEL_FILE);
  } catch (err) {
    console.warn('Could not sync waitlist Excel file to disk:', err);
  }
}

export async function generateWaitlistExcelBuffer(entries: WaitlistEntry[]): Promise<Buffer> {
  const workbook = await buildWaitlistWorkbook(entries);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
