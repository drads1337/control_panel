import * as React from "react"
import { motion, useMotionValue, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

interface HighlightContextValue {
  highlight: {
    x: number
    y: number
    width: number
    height: number
  } | null
  setHighlight: (highlight: { x: number; y: number; width: number; height: number } | null) => void
}

const HighlightContext = React.createContext<HighlightContextValue | null>(null)

interface HighlightProps {
  enabled?: boolean
  hover?: boolean
  controlledItems?: boolean
  mode?: "parent" | "child"
  containerClassName?: string
  transition?: any
  forceUpdateBounds?: boolean
  children: React.ReactNode
}

export function Highlight({
  enabled = true,
  hover = false,
  controlledItems = false,
  mode = "parent",
  containerClassName,
  transition = { type: "spring", stiffness: 150, damping: 15 },
  forceUpdateBounds,
  children,
}: HighlightProps) {
  const [highlight, setHighlight] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const width = useMotionValue(0)
  const height = useMotionValue(0)

  const springConfig = { stiffness: 150, damping: 15, ...transition }
  const xSpring = useSpring(x, springConfig)
  const ySpring = useSpring(y, springConfig)
  const widthSpring = useSpring(width, springConfig)
  const heightSpring = useSpring(height, springConfig)

  React.useEffect(() => {
    if (highlight && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      x.set(highlight.x - containerRect.left)
      y.set(highlight.y - containerRect.top)
      width.set(highlight.width)
      height.set(highlight.height)
    } else {
      x.set(0)
      y.set(0)
      width.set(0)
      height.set(0)
    }
  }, [highlight, x, y, width, height])

  if (!enabled) {
    return <div className={cn("relative", containerClassName)}>{children}</div>
  }

  return (
    <HighlightContext.Provider value={{ highlight, setHighlight }}>
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden", containerClassName)}
        onMouseLeave={() => hover && setHighlight(null)}
      >
        {hover && (
          <motion.div
            className="pointer-events-none absolute rounded-md bg-sidebar-accent/50"
            style={{
              x: xSpring,
              y: ySpring,
              width: widthSpring,
              height: heightSpring,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: highlight ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
        {children}
      </div>
    </HighlightContext.Provider>
  )
}

interface HighlightItemProps {
  activeClassName?: string
  children: React.ReactNode
  className?: string
}

export function HighlightItem({
  activeClassName,
  children,
  className,
}: HighlightItemProps) {
  const context = React.useContext(HighlightContext)
  const itemRef = React.useRef<HTMLElement>(null)

  const handleMouseEnter = React.useCallback(() => {
    if (context && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      context.setHighlight({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      })
    }
  }, [context])

  const handleMouseLeave = React.useCallback(() => {
    if (context) {
      context.setHighlight(null)
    }
  }, [context])

  if (!React.isValidElement(children)) {
    return <>{children}</>
  }

  const child = children as React.ReactElement<any>
  const childProps = child.props as any

  return React.cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      itemRef.current = node
      if (typeof childProps?.ref === "function") {
        childProps.ref(node)
      } else if (childProps?.ref) {
        (childProps.ref as React.MutableRefObject<HTMLElement | null>).current = node
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter()
      childProps?.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave()
      childProps?.onMouseLeave?.(e)
    },
    className: cn(className, childProps?.className),
    "data-highlight": true,
  } as any)
}

