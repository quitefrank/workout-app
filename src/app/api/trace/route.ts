/**
 * Receives the temporary frame recorder's batches (src/lib/trace.ts) and writes them to the Vercel logs in lines short
 * enough not to be cut. Remove with the recorder.
 */
export async function POST(req: Request) {
  const text = (await req.text()).slice(0, 200_000);
  const id = Math.random().toString(36).slice(2, 8);
  const parts = Math.ceil(text.length / 3000);
  for (let i = 0; i < parts; i++) console.log(`TRACE ${id} ${i + 1}/${parts} ${text.slice(i * 3000, (i + 1) * 3000)}`);
  return new Response(null, { status: 204 });
}
