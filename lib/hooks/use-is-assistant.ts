'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getAssistantOrgId } from '@/lib/acting-user';

/** true si quien usa el CRM es una asistente (recepción). Para ocultar acciones solo del dueño. */
export function useIsAssistant(): boolean {
  const [isAssistant, setIsAssistant] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    let off = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || off) return;
      const orgId = await getAssistantOrgId(supabase, user.id);
      if (!off) setIsAssistant(!!orgId);
    });
    return () => { off = true; };
  }, []);
  return isAssistant;
}
