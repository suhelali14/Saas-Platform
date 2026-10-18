import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui';

/**
 * The form vocabulary for this app's screens.
 *
 * Every field in the portal was a hand-written `<input>` with the same
 * seven utility classes copied onto it -- 78 of them -- which is how one
 * ends up slightly different from the rest and nobody notices for a
 * month. These wrap the primitives with the label, the help text and the
 * error in the arrangement the screens already use, so a field is one
 * line and they cannot drift apart.
 *
 * `Pick`, the select, is the one that matters most. A native <select> is
 * drawn by the operating system, which ignores the page's colours
 * entirely: the dark theme put white text on a select whose options fell
 * back to the system's white background, and every dropdown in the
 * portal was invisible. That was a live bug across thirteen selects in
 * eight files, patched at the time by styling `option` directly -- which
 * works, but only for as long as every browser keeps honouring it.
 *
 * Radix draws the menu itself, out of real elements, so it inherits the
 * theme like anything else and gains keyboard navigation and type-ahead
 * that a native select on a touch device does not give.
 */

function FieldShell({
  label, htmlFor, hint, error, required, className, children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-ink-danger" aria-hidden="true">*</span>}
        </Label>
      )}
      {children}
      {/* Validation stays beside its own field rather than becoming a
          toast: "phone number is too long" belongs next to the phone
          number, where the correction has to be made. */}
      {error ? (
        <p className="text-[11px] text-ink-danger">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  /** Applied to the wrapper, so a field can span grid columns. */
  className?: string;
  inputClassName?: string;
}

export function TextField({
  label, hint, error, className, inputClassName, id, ...props
}: TextFieldProps) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell label={label} htmlFor={fieldId} hint={hint} error={error} className={className}>
      <Input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(error && 'border-ink-danger/60', inputClassName)}
        {...props}
      />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends Omit<React.ComponentProps<'textarea'>, 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  textareaClassName?: string;
}

export function TextAreaField({
  label, hint, error, className, textareaClassName, id, ...props
}: TextAreaFieldProps) {
  const auto = React.useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell label={label} htmlFor={fieldId} hint={hint} error={error} className={className}>
      <Textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(error && 'border-ink-danger/60', textareaClassName)}
        {...props}
      />
    </FieldShell>
  );
}

export type Option = { value: string; label: string; disabled?: boolean };

export interface PickProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  triggerClassName?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** Shown when nothing is selected. */
  placeholder?: string;
  /** Adds an explicit "no choice" option with this label. Radix cannot
   *  carry an empty-string value, so the empty choice is represented by a
   *  sentinel and translated on both sides -- see below. */
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  /**
   * Marks the field as required for the person reading it. It is
   * deliberately NOT forwarded to the browser.
   *
   * Radix satisfies form semantics by rendering a hidden native select
   * alongside the real one. A `required` control that is invalid and
   * cannot be focused makes the browser refuse to submit the form and
   * show nothing at all -- Chrome logs "an invalid form control is not
   * focusable" to the console and the user sees a button that does
   * nothing. A silent dead submit is far worse than no native
   * validation, so the check belongs in the handler, where it can say
   * which field and why.
   */
  required?: boolean;
}

/**
 * Radix refuses an item whose value is the empty string, because it uses
 * "" internally to mean "nothing selected" and an item with that value
 * could never be distinguished from the placeholder. Several of this
 * app's selects genuinely offer a blank choice ("Unassigned", "Any
 * doctor", "Gender"), so the blank is carried as a sentinel here and
 * converted back to "" before it reaches the caller.
 */
const NONE = '__none__';

export function Pick({
  label, hint, error, className, triggerClassName,
  value, onChange, options, placeholder, emptyLabel, disabled, id, name, required,
}: PickProps) {
  const auto = React.useId();
  const fieldId = id ?? auto;

  const items = emptyLabel ? [{ value: NONE, label: emptyLabel }, ...options] : options;

  return (
    <FieldShell label={label} htmlFor={fieldId} hint={hint} error={error} required={required} className={className}>
      <Select
        value={value === '' ? (emptyLabel ? NONE : undefined) : value}
        onValueChange={(next) => onChange(next === NONE ? '' : next)}
        disabled={disabled}
        name={name}
      >
        <SelectTrigger
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={cn(error && 'border-ink-danger/60', triggerClassName)}
        >
          <SelectValue placeholder={placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
