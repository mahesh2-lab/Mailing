import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mailing App',
    short_name: 'Mailing',
    description: 'A modern email client built with Next.js',
    start_url: '/inbox',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      }
    ],
  };
}
