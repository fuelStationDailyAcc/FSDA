type BrandLogoProps = {
  className?: string
  alt?: string
  size?: number
}

function BrandLogo({ className, alt = 'PetroBook', size = 192 }: BrandLogoProps) {
  return (
    <img
      className={className}
      src="/logo-mark.png"
      alt={alt}
      width={size}
      height={size}
      decoding="async"
    />
  )
}

export default BrandLogo
