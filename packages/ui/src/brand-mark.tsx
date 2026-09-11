export interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={className} aria-label="EaziCart">
      Eazi<span aria-hidden="true">Cart</span>
    </span>
  );
}
