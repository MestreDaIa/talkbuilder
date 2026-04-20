import { FieldErrors, UseFormRegister } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type FormInputFieldProps = {
  label: string
  name: string
  register?: UseFormRegister<any>
  errors: FieldErrors<any>
  type?: string
  placeholder: string
  // value: string
  // onChange: (value: string) => void
}

export function FormInputField({
  label,
  name,
  register,
  errors,
  type,
  placeholder,
  // value,
  // onChange
} : FormInputFieldProps) {
  return (
    <div className="">
        <Label>{label}</Label>
        <Input
          type={type}
          placeholder={placeholder}
          // value={value}
          // onChange={(e) => onChange(e.target.value)}
          {...(register?.(name) ?? {})}
        />
        {errors[name] && (
          <p>
            {errors[name]?.message as string}
          </p>
        )}
    </div>
  )
}
