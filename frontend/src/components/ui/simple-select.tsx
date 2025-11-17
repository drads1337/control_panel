"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SimpleSelectProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  size?: "sm" | "default"
  className?: string
  children?: React.ReactNode
  // Новые свойства
  error?: boolean
  required?: boolean
  name?: string
  id?: string
}

interface SimpleSelectOptionProps {
  value: string
  children: React.ReactNode
  className?: string
}

const SimpleSelectContext = React.createContext<{
  onSelect: (value: string, label: string) => void
  selectedValue?: string
} | null>(null)

const SimpleSelect = React.forwardRef<HTMLDivElement, SimpleSelectProps>(
  ({ value, onChange, placeholder, disabled, size = "default", className, children, error, required, name, id }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedValue, setSelectedValue] = React.useState(value || "")
    const [selectedLabel, setSelectedLabel] = React.useState<string | undefined>(undefined)
    const selectRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      if (value !== undefined) {
        setSelectedValue(value)
      }
    }, [value])

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelect = (optionValue: string, optionLabel: string) => {
      setSelectedValue(optionValue)
      setSelectedLabel(optionLabel)
      setIsOpen(false)
      onChange?.(optionValue)
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setIsOpen(!isOpen)
      } else if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    return (
      <SimpleSelectContext.Provider value={{ onSelect: handleSelect, selectedValue }}>
        <div ref={selectRef} className="relative">
          <div
            ref={ref}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="simple-select-options"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[lot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              size === "default" ? "h-9" : "h-8",
              disabled && "opacity-50 cursor-not-allowed",
              isOpen && "ring-2 ring-ring ring-ring/50",
              error && "border-destructive ring-destructive/20",
              className
            )}
            id={id}
            aria-required={required}
            aria-invalid={error}
          >
            <span className={cn(
              "flex items-center gap-2",
              !selectedLabel && "text-muted-foreground"
            )}>
              {selectedLabel ? selectedLabel : placeholder}
            </span>
            <ChevronDownIcon 
              className={cn(
                "size-4 opacity-50 transition-transform",
                isOpen && "rotate-180"
              )} 
            />
          </div>

          {isOpen && (
            <div
              id="simple-select-options"
              role="listbox"
              className="absolute z-50 mt-1 max-h-60 min-w-[8rem] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
            >
              {children}
            </div>
          )}
        </div>
      </SimpleSelectContext.Provider>
    )
  }
)

SimpleSelect.displayName = "SimpleSelect"

const SimpleSelectOption = React.forwardRef<HTMLDivElement, SimpleSelectOptionProps>(
  ({ value, children, className }, ref) => {
    const context = React.useContext(SimpleSelectContext)
    const [isSelected, setIsSelected] = React.useState(false)
    
    React.useEffect(() => {
      // Проверяем, выбран ли этот элемент
      if (context?.selectedValue === value) {
        setIsSelected(true)
      } else {
        setIsSelected(false)
      }
    }, [context?.selectedValue, value])
    
    const handleClick = () => {
      context?.onSelect(value, typeof children === 'string' ? children : value)
    }

    return (
      <div
        ref={ref}
        role="option"
        tabIndex={0}
        aria-selected={isSelected}
        className={cn(
          "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground transition-colors duration-150",
          isSelected && "bg-accent text-accent-foreground",
          className
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {children}
      </div>
    )
  }
)

SimpleSelectOption.displayName = "SimpleSelectOption"

// Компонент для группировки опций
const SimpleSelectGroup = React.forwardRef<HTMLDivElement, {
  label?: string
  className?: string
  children?: React.ReactNode
}>(({ label, className, children }, ref) => {
  return (
    <div ref={ref} className={cn("py-1", className)}>
      {label && (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      )}
      {children}
    </div>
  )
})

SimpleSelectGroup.displayName = "SimpleSelectGroup"

export { SimpleSelect, SimpleSelectOption, SimpleSelectGroup } 