/**
 * Device chrome around a preview.
 *
 * Two reasons this is not decoration:
 *
 * 1. **It says what you are looking at.** A bare 390px iframe floating in a
 *    white box does not read as "this is your phone layout" -- it reads as
 *    a broken desktop one. The frame removes that ambiguity without a
 *    caption.
 * 2. **It fixes a real bug.** The white ground was on the full-width shell,
 *    so a 390px phone preview sat in a large empty white rectangle. The
 *    ground now belongs to the device, which is exactly as wide as the
 *    viewport being previewed.
 *
 * Drawn in CSS rather than shipped as a PNG or SVG asset: it scales to any
 * size without blurring, follows the portal's theme, costs no network
 * request, and cannot go stale against a redesign.
 */

interface DeviceFrameProps {
  device: 'desktop' | 'phone';
  /** CSS width of the viewport being previewed, after scaling. */
  width: number;
  /** CSS height of the viewport being previewed, after scaling. */
  height: number;
  /** Shown in the browser chrome's address bar. Desktop only. */
  url?: string;
  children: React.ReactNode;
}

export function DeviceFrame({ device, width, height, url, children }: DeviceFrameProps) {
  if (device === 'phone') {
    const BEZEL = 10;
    return (
      <div className="flex justify-center py-4">
        <div
          className="relative rounded-[36px] bg-[#1c1f26] shadow-2xl ring-1 ring-white/10"
          style={{ padding: BEZEL, width: width + BEZEL * 2 }}
        >
          {/* Dynamic island. Drawn over the content, as on the real device,
              so the preview shows what it actually obscures. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10 rounded-full bg-[#1c1f26]"
            style={{ top: BEZEL + 6, width: Math.max(52, width * 0.24), height: 18 }}
          />
          <div className="overflow-hidden rounded-[27px] bg-white" style={{ width, height }}>
            {children}
          </div>
          {/* Home indicator. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/25"
            style={{ bottom: BEZEL + 5, width: Math.max(80, width * 0.34), height: 4 }}
          />
        </div>
      </div>
    );
  }

  // Browser chrome. The address bar carries the real URL, so the preview
  // also answers "which page is this" -- useful once the patient site and
  // the portal live on separate domains.
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-xl bg-[#1c1f26]" style={{ width: width + 2 }}>
      <div className="flex items-center gap-2 px-3 h-9 bg-[#23272f] border-b border-black/30">
        <div className="flex gap-1.5 shrink-0" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        {url && (
          <div className="flex-1 min-w-0 mx-2">
            <div className="h-5 rounded-md bg-black/30 flex items-center px-2.5">
              <span className="text-[10px] text-muted-foreground/70 truncate">{url}</span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white overflow-hidden" style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}
