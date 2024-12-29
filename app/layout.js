import { AuthWrapper } from './components/AuthWrapper';

export const metadata = {
  title: '指紋打卡系統',
  description: 'ESP32 指紋識別系統',
  manifest: '/manifest.json',
  themeColor: '#4f46e5',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '指紋打卡系統'
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script src="/registerSW.js" defer></script>
      </head>
      <body className="bg-gray-100">
        <AuthWrapper>
          <nav className="bg-white shadow mb-4 p-4">
            <div className="max-w-4xl mx-auto flex space-x-4">
              <a href="/" className="text-gray-700 hover:text-gray-900">指紋管理</a>
              <a href="/attendance" className="text-gray-700 hover:text-gray-900">打卡系統</a>
              <a href="/employees" className="text-gray-700 hover:text-gray-900">員工管理</a>
            </div>
          </nav>
          {children}
        </AuthWrapper>
      </body>
    </html>
  );
} 