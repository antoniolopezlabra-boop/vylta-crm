import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea tu cuenta VYLTA y comienza a gestionar tu negocio.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterForm />
    </Suspense>
  );
}
