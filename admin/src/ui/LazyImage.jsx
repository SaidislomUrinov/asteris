import { useEffect, useRef, useState } from "react";

function LazyImage({ src, alt, className = "", ...props }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.1 },
    );

    if (imgRef.current) obs.observe(imgRef.current);

    return () => obs.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={visible ? src : undefined}
      alt={alt}
      className={`${className} transition-opacity duration-300 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      {...props}
    />
  );
}

export default LazyImage;
