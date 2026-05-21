import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  model: string;
}

export default function NPCModelTooltip({ data }: { data: TooltipData | null }) {
  const [rendered, setRendered] = useState<TooltipData | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (data && data.visible) {
      setRendered(data);
    } else if (!data || !data.visible) {
      hideTimer.current = setTimeout(() => {
        setRendered(null);
      }, 200);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [data]);

  if (!rendered) return null;

  return createPortal(
    <div
      ref={(el) => {
        if (el) {
          // 边界检测，防止 tooltip 超出视口
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth) {
            el.style.left = `${rendered.x - rect.width - 12}px`;
          }
          if (rect.bottom > window.innerHeight) {
            el.style.top = `${rendered.y - rect.height - 12}px`;
          }
        }
      }}
      className="fixed z-50 pointer-events-none bg-black/80 text-white text-sm px-2 py-1 rounded whitespace-nowrap"
      style={{
        left: rendered.x + 12,
        top: rendered.y + 12,
      }}
    >
      {rendered.name} · {rendered.model}
    </div>,
    document.body,
  );
}
