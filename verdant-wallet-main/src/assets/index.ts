import logo from "./velvato-logo.webp";
import product from "./velvato-product.webp";

export const logoSrc = logo;
export const productSrc = product;

/** Single common product image used across every plan/product. */
export const flavorImages = {
  default: product,
} as const;

export const bannerSlides = [
  { src: product, alt: "Velvato vanilla ice cream tub and pack" },
  { src: logo, alt: "Velvato ice cream brand logo" },
];
