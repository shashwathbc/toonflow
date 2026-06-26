import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
            {props.required && (
              <span className="text-danger ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input-base',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-required={props.required ? 'true' : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
