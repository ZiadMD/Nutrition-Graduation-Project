import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { inputCls } from '../constants'

export function PasswordInput(props: ComponentProps<'input'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-14`} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1 size-11 grid place-items-center rounded-lg text-ink-2 hover:text-ink cursor-pointer"
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}
