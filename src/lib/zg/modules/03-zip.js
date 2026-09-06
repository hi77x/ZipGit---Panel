/* == zip == */
async function inflateRaw(u8){
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream unsupported — serve over https/localhost');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(buf){
  const bytes = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--){
    if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .zip archive (EOCD not found)');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder('utf-8');
  const files = [];
  for (let i = 0; i < count; i++){
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const flags = dv.getUint16(off + 8, true);
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const comLen = dv.getUint16(off + 32, true);
    const lOff = dv.getUint32(off + 42, true);
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + comLen;
    if (name.endsWith('/') || name.split('/').some(s => s === '.git')) continue;
    if (flags & 1) throw new Error('Archive is encrypted — unpack it first');
    const lnLen = dv.getUint16(lOff + 26, true);
    const leLen = dv.getUint16(lOff + 28, true);
    const dataStart = lOff + 30 + lnLen + leLen;
    const raw = bytes.subarray(dataStart, dataStart + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error('Unsupported compression method: ' + method);
    files.push({ path: name, u8: data, size: data.length });
  }
  return files;
}
function zipCommonRoot(files){
  if (!files.length) return null;
  const root = files[0].path.split('/')[0];
  if (!files.every(f => f.path.split('/')[0] === root)) return null;
  if (!files.every(f => f.path.includes('/'))) return null;
  return root;
}
async function readFolder(dirHandle){
  const files = [];
  const SKIP = new Set(['.git','node_modules','.DS_Store','__pycache__','.venv','dist','build']);
  async function walk(handle, prefix){
    for await (const h of handle.values()){
      if (SKIP.has(h.name)) continue;
      if (h.kind === 'directory') await walk(h, prefix + h.name + '/');
      else {
        const f = await h.getFile();
        const u8 = new Uint8Array(await f.arrayBuffer());
        files.push({ path: prefix + h.name, u8, size: u8.length });
      }
    }
  }
  await walk(dirHandle, '');
  return files;
}
