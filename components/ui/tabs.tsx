"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const TabsListContext = React.createContext<{
  variant: "default" | "line"
}>({
  variant: "default",
})

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "inline-flex items-center text-muted-foreground select-none",
  {
    variants: {
      variant: {
        default:
          "h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 border border-border/40 gap-1",
        line:
          "h-10 w-full justify-start border-b border-border bg-transparent p-0 gap-6 rounded-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const resolvedVariant = variant || "default"
  return (
    <TabsListContext.Provider value={{ variant: resolvedVariant }}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={resolvedVariant}
        className={cn(tabsListVariants({ variant: resolvedVariant }), className)}
        {...props}
      />
    </TabsListContext.Provider>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const { variant } = React.useContext(TabsListContext)

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-xs sm:text-sm font-medium transition-all outline-none cursor-pointer select-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "default" && [
          "h-7 rounded-md px-3 py-1 text-muted-foreground",
          "hover:text-foreground",
          "data-active:bg-background data-active:text-foreground data-active:shadow-xs data-active:font-semibold",
        ],
        variant === "line" && [
          "relative h-10 px-1 pb-3 pt-2 text-muted-foreground",
          "hover:text-foreground",
          "data-active:text-foreground data-active:font-semibold",
          "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity",
          "data-active:after:opacity-100",
        ],
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "flex-1 text-sm outline-none focus-visible:outline-none animate-in fade-in-0 duration-150 ease-out",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
