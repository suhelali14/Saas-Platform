import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconOnly?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconOnly = false,
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = size === 'md' ? '' : `btn-${size}`;
  const iconClass = iconOnly ? 'btn-icon' : '';
  const loadingClass = isLoading ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${iconClass} ${loadingClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
      ) : icon && !iconOnly ? (
        <>
          <span className="flex items-center justify-center">{icon}</span>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
