import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "motion/react"
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { cn } from "cn"

type TabValue = string | number

interface TabsFrame {
  x: number
  y: number
  w: number
  h: number
}

const TabsContext = createContext<{
  value: unknown
  els: Map<TabValue, HTMLElement>
  register: (value: TabValue, el: HTMLElement | null) => void
} | null>(null)

function Tabs({
  className,
  orientation = "horizontal",
  value,
  ...props
}: TabsPrimitive.Root.Props) {
  const els = useRef(new Map<TabValue, HTMLElement>())
  const register = useCallback((tabValue: TabValue, el: HTMLElement | null) => {
    if (el) els.current.set(tabValue, el)
    else els.current.delete(tabValue)
  }, [])
  return (
    <TabsContext.Provider value={{ value, els: els.current, register }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        value={value}
        {...props}
      />
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        pills: "gap-2 bg-transparent p-0",
        line: "gap-1 bg-transparent",
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
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const ctx = useContext(TabsContext)
  const listRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<TabsFrame | null>(null)

  const measure = useCallback(() => {
    const list = listRef.current
    const current = ctx?.value
    if (!list || current === undefined || current === null) {
      setFrame(null)
      return
    }
    const el = ctx?.els.get(current as TabValue)
    if (!el || !el.isConnected) {
      setFrame(null)
      return
    }
    const next = {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
    }
    setFrame((prev) =>
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.w === next.w &&
      prev.h === next.h
        ? prev
        : next
    )
  }, [ctx])

  useLayoutEffect(() => {
    measure()
  }, [measure, children])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant !== "line" && frame && (
        <motion.span
          aria-hidden="true"
          data-slot="tabs-indicator"
          initial={false}
          animate={{ x: frame.x, y: frame.y, width: frame.w, height: frame.h }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            "pointer-events-none absolute top-0 left-0 z-0",
            variant === "pills"
              ? "rounded-full bg-primary"
              : "rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30 dark:shadow-none"
          )}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

const tabsTriggerVariants = cva("", {
  variants: {
    variant: {
      default: "",
      pills:
        "rounded-full border-input bg-[#FFFFFF0D] data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground data-active:hover:text-primary-foreground dark:bg-[#FFFFFF0D] dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:hover:text-primary-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function TabsTrigger({
  className,
  variant = "default",
  value,
  ...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
  const { children } = props
  const tabs = useContext(TabsContext)
  const tabRef = useCallback(
    (el: HTMLButtonElement | null) => {
      if (value === undefined || !tabs) return
      tabs.register(value, el)
    },
    [tabs, value]
  )
  // When the group is controlled, the sliding indicator paints the
  // background — suppress the trigger's own instant active background
  // so the two don't overlap mid-flight.
  const indicatorOwnsBg =
    tabs !== null && tabs.value !== undefined && tabs.value !== null
  return (
    <TabsPrimitive.Tab
      ref={tabRef}
      data-slot="tabs-trigger"
      data-variant={variant}
      value={value}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-transparent dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        tabsTriggerVariants({ variant }),
        indicatorOwnsBg && "data-active:bg-transparent dark:data-active:bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
