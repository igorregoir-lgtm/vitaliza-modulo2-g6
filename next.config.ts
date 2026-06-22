import type { NextConfig } from "next";

// A inferência ONNX roda no NAVEGADOR (onnxruntime-web/WASM, ver lib/onnx/
// client-infer.ts) — não há função serverless de inferência, logo nenhum
// serverExternalPackages/outputFileTracing é necessário aqui.
const nextConfig: NextConfig = {};

export default nextConfig;
