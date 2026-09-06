export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ok: true, name: 'ziptogit-backend', version: '3.3.0' });
}
