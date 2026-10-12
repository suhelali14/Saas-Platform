import { cn } from "@/lib/utils";

/**
 * A loading placeholder shaped like the thing it stands in for.
 *
 * Generic boxes reserve the wrong height, so the layout still jumps when
 * data lands -- which is the one problem a skeleton exists to prevent.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer rounded-md", className)} {...props} />;
}

/** Wraps a loading region so assistive tech announces it once, rather
 *  than reading out a wall of empty boxes. */
function SkeletonRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { Skeleton, SkeletonRegion };
