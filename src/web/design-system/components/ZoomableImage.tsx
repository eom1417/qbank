import type { CSSProperties } from 'react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  /** 1 fits the frame's width; larger values enlarge it without distortion (FR-06-005). */
  zoom: number;
}

/** A picture in a scrolling frame: enlarged, it pans by scrolling or by touch (FR-12-009). */
export function ZoomableImage({ src, alt, zoom }: ZoomableImageProps) {
  const style = { '--qb-zoom': zoom } as CSSProperties;
  return (
    <div className="qb-zoom">
      <img className="qb-zoom__image" src={src} alt={alt} style={style} />
    </div>
  );
}
