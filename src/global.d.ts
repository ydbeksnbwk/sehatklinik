declare module "next" {
  export type Metadata = {
    title?: string | { default: string; template: string }
    description?: string
    [key: string]: any
  }
  export type NextConfig = any
  const next: any
  export default next
}

declare module "next/types.js" {
  export type ResolvingMetadata = any
  export type ResolvingViewport = any
}
