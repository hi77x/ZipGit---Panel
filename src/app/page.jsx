'use client';
import { useEffect } from 'react';
import { ZG_MARKUP } from '../lib/zg/markup.js';
import '../lib/zg/bundle.js';
export default function Page() {
  useEffect(() => { if (window.ZGBoot) window.ZGBoot(); }, []);
  return <div dangerouslySetInnerHTML={{ __html: ZG_MARKUP }} />;
}
