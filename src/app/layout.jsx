import './globals.css';
export const metadata = { title: 'ZipToGit Pro — GitHub Dashboard', description: 'Client-side GitHub dashboard' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; img-src 'self' data: https://*.githubusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://api.github.com; font-src 'self' data: https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; base-uri 'none'; form-action 'none'" />
      </head>
      <body style={{background:'#0a0d12'}}>{children}</body>
    </html>
  );
}
