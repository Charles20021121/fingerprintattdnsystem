'use client';
import dynamic from 'next/dynamic';

const AuthProvider = dynamic(
  () => import('../providers/AuthProvider').then(mod => mod.AuthProvider),
  { ssr: false }
);

export function AuthWrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
} 