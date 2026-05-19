import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Regístrate en VYLTA y empieza a administrar tu negocio.',
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterForm />
    </Suspense>
  );
}
