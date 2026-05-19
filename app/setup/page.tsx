import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetupWizard } from '@/components/setup-wizard';

export const metadata: Metadata = {
  title: 'Configura tu negocio',
  description: 'Configura tu negocio en VYLTA en 4 pasos.',
};

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-vylta-black" />}>
      <SetupWizard />
    </Suspense>
  );
}
