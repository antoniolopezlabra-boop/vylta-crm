'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function SoloAppSignOut() {
  const router = useRouter();
  return (
    <Button
      className="w-full"
      variant="outline"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/login');
      }}
    >
      Cerrar sesión
    </Button>
  );
}
