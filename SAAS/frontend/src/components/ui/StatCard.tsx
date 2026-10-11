import { ReactNode } from 'react';

type StatVariant = 'revenue' | 'orders' | 'customers' | 'growth';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: ReactNode;
  variant?: StatVariant;
  className?: string;
}

export function StatCard({ title, value, change, icon, variant = 'revenue', className = '' }: StatCardProps) {
  return (
    <div className={`stat-card ${variant} ${className}`}>
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>
        {change !== undefined && (
          <div className={`stat-card-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{title}</div>
    </div>
  );
}
