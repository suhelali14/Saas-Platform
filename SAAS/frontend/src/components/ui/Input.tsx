import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className={`input-group ${className}`}>
        {label && <label className="input-label">{label}</label>}
        <div className="relative">
          {icon && <span className="header-search-icon">{icon}</span>}
          <input
            ref={ref}
            className={`input ${error ? 'input-error' : ''} ${icon ? 'pl-10' : ''}`}
            {...props}
          />
        </div>
        {error && <span className="input-error-text">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className={`input-group ${className}`}>
        {label && <label className="input-label">{label}</label>}
        <textarea
          ref={ref}
          className={`input ${error ? 'input-error' : ''}`}
          {...props}
        />
        {error && <span className="input-error-text">{error}</span>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
