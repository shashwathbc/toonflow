'use client'

import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type = 'text', ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined

    // Password fields get our own eye toggle instead of the browser's native
    // reveal control (which is hidden via CSS in globals.css). Flipping to
    // type="text" is what reveals the characters.
    const isPassword = type === 'password'
    const [reveal, setReveal] = useState(false)
    const effectiveType = isPassword && reveal ? 'text' : type

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className={cn(
              'input-base',
              isPassword && 'pr-11',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className
            )}
            {...(error ? { 'aria-invalid': 'true' } : {})}
            {...(props.required ? { 'aria-required': 'true' } : {})}
            aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
            {...props}
          />
          {isPassword && (
            <Tooltip label={reveal ? 'Hide password' : 'Show password'} side="left">
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={reveal}
                className="absolute inset-y-0 right-0 flex items-center px-3 rounded-r-lg text-text-muted
                           hover:text-text transition-colors
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {reveal
                  ? <EyeOff size={16} aria-hidden="true" />
                  : <Eye size={16} aria-hidden="true" />}
              </button>
            </Tooltip>
          )}
        </div>
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
