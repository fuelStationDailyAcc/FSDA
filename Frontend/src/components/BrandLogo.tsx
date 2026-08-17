type BrandLogoProps = {
  className?: string
  alt?: string
  size?: number
}

function BrandLogo({ className, alt = 'FuelSNC', size = 192 }: BrandLogoProps) {
  const src = size >= 256 ? '/pwa-512x512.png' : '/pwa-192x192.png'
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
    />
  )
}

export default BrandLogo
