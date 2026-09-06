import { scanText } from '../../../lib/scanner.server.js';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { files } = await req.json(); // [{path, text}]
    if (!Array.isArray(files)) return Response.json({ message: 'files array required' }, { status: 400 });
    const findings = files
      .slice(0, 2000)
      .map(f => scanText(String(f.path || ''), String(f.text || '')))
      .filter(Boolean);
    return Response.json({ findings });
  } catch (e) {
    return Response.json({ message: 'bad request' }, { status: 400 });
  }
}
