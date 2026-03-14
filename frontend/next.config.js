/** @type {import('next').NextConfig} */
const nextConfig = {
  /* REMOVALS FOR NEXT.JS 15:
     1. experimental.appDir: The App Router is now the standard; this key is invalid.
     2. swcMinify: SWC is the default minifier; this manual toggle was removed.
     3. type: "module": This is not a valid Next.js config property. 
        If you want to use ES Modules, ensure "type": "module" is in your package.json.
  */
  reactStrictMode: true,
};

export default nextConfig;