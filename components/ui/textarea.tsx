'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════════════
// Textarea — textarea consistente con Input
// ══════════════════════════════════════════════════════════════════════

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:border-vylta-green-500/50 focus-visible:ring-2 focus-visible:ring-vylta-green-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors resize-y',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
