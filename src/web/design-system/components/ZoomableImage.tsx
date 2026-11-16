import type { CSSProperties } from 'react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  /**
   * 1 shows the picture at its own size, never stretched, at most the frame's width (M34 U4);
   * larger values enlarge it without distortion (FR-06-005).
   */
  zoom: number;
}

/** A picture in a scrolling frame: enlarged, it pans by scrolling or by touch (FR-12-009). */
export function ZoomableImage({ src, alt, zoom }: ZoomableImageProps) {
  const style = { '--qb-zoom': zoom } as CSSProperties;
  return (
    <div className="qb-zoom">
      <img
        className={zoom === 1 ? 'qb-zoom__image qb-zoom__image--fit' : 'qb-zoom__image'}
        src={src}
        alt={alt}
        style={style}
      />
    </div>
  );
}
