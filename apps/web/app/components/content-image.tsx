import Image, { type ImageProps } from "next/image";

// Keep arbitrary catalog URLs working; only configured public sources use the optimizer.
export function ContentImage(props: ImageProps & { src: string }) {
  let optimized = props.src.startsWith("/") && !props.src.startsWith("//");
  try {
    const url = new URL(props.src);
    optimized =
      url.protocol === "https:" &&
      !url.port &&
      (url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        (url.hostname === "images.unsplash.com" &&
          url.pathname.startsWith("/photo-")));
  } catch {
    // Relative assets are handled by Next; data URLs bypass optimization.
  }
  return (
    <Image
      {...props}
      unoptimized={!optimized}
      loading={props.loading ?? "lazy"}
      decoding="async"
    />
  );
}
