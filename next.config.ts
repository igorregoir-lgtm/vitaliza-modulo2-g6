import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // onnxruntime-node é um addon nativo: não empacotar, exigir em runtime.
  serverExternalPackages: ["onnxruntime-node"],
  // garante o model.onnx no bundle da função de inferência (lido via fs).
  outputFileTracingIncludes: {
    "/api/infer-onnx": ["./lib/onnx/**"],
  },
};

export default nextConfig;
