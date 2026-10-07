import { cn } from "@/lib/utils"
import { RiLoaderLine } from "@remixicon/react";

// Local fix: shadcn types these props as ComponentProps<"svg">, which allows
// `children` that Remixicon forbids and breaks `tsc`.
function Spinner({ className, ...props }: React.ComponentProps<typeof RiLoaderLine>) {
  return (
    <RiLoaderLine
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
