"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface WidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  design?: "mumbai" | "default"
  size?: "sm" | "md" | "lg"
}

const Widget = React.forwardRef<HTMLDivElement, WidgetProps>(
  ({ className, design = "default", size = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          design === "mumbai" && "border-border/50",
          size === "sm" && "p-3",
          size === "md" && "p-4",
          size === "lg" && "p-6",
          className
        )}
        {...props}
      />
    )
  }
)
Widget.displayName = "Widget"

const WidgetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5", className)}
      {...props}
    />
  )
})
WidgetHeader.displayName = "WidgetHeader"

const WidgetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex", className)}
      {...props}
    />
  )
})
WidgetContent.displayName = "WidgetContent"

const WidgetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
})
WidgetFooter.displayName = "WidgetFooter"

const WidgetTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
})
WidgetTitle.displayName = "WidgetTitle"

export { Widget, WidgetHeader, WidgetContent, WidgetFooter, WidgetTitle }

