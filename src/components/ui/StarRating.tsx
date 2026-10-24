import React, { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: number
  interactive?: boolean
  onChange?: (rating: number) => void
  className?: string
  showValue?: boolean
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 18,
  interactive = false,
  onChange,
  className = '',
  showValue = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  const currentRating = interactive && hoverRating !== null ? hoverRating : rating

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`${rating} out of ${maxStars} stars`}
    >
      <div className="inline-flex items-center gap-0.5">
        {Array.from({ length: maxStars }, (_, i) => {
          const starNumber = i + 1
          const isFilled = starNumber <= Math.round(currentRating)

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={starNumber === rating}
                aria-label={`${starNumber} star${starNumber > 1 ? 's' : ''}`}
                onClick={() => onChange?.(starNumber)}
                onMouseEnter={() => setHoverRating(starNumber)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-1 rounded hover:scale-110 transition-transform cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Star
                  size={size}
                  className={
                    isFilled
                      ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                      : 'text-line hover:text-amber-300'
                  }
                  strokeWidth={isFilled ? 1.5 : 1.5}
                />
              </button>
            )
          }

          return (
            <Star
              key={i}
              size={size}
              aria-hidden="true"
              className={
                isFilled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-line fill-transparent'
              }
              strokeWidth={1.5}
            />
          )
        })}
      </div>

      {showValue && (
        <span className="num font-bold text-[14px] text-ink ms-1">
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  )
}
