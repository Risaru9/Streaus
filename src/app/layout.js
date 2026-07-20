import './globals.css';
import { Inter, Bebas_Neue, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata = {
  title: 'Streaus - WatchParty',
  description: 'Watch videos together in real-time',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Streaus',
  },
};

export const viewport = {
  themeColor: '#0B0E14',
};

import ParticleBackground from '@/components/ParticleBackground';
import CustomCursor from '@/components/CustomCursor';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${bebas.variable} ${jetbrains.variable} font-sans`}>
        <CustomCursor />
        <ParticleBackground />
        {children}
      </body>
    </html>
  );
}
