import { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'purple';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  withDot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'neutral', withDot = false, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${withDot ? 'badge-dot' : ''} ${className}`}>
      {children}
    </span>
  );
}
