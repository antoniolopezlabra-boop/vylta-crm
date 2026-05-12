import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta VYLTA desde la web',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
