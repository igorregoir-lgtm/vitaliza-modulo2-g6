// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock da inferência client-side (não roda WASM no teste).
const { inferMock } = vi.hoisted(() => ({ inferMock: vi.fn() }));
vi.mock("./client-infer", () => ({ inferChurnProbBrowser: inferMock }));

import { useOnlineProjection } from "./use-online-projection";
import type { CustomerFeatures } from "@/lib/types";

const FEATURES: CustomerFeatures = {
  gender: 1,
  Near_Location: 1,
  Partner: 0,
  Promo_friends: 0,
  Phone: 1,
  Contract_period: 1,
  Group_visits: 0,
  Age: 28,
  Avg_additional_charges_total: 100,
  Month_to_end_contract: 1,
  Lifetime: 2,
  Avg_class_frequency_total: 2,
  Avg_class_frequency_current_month: 1,
};
const DELTA = { Avg_class_frequency_current_month: 3 };

describe("useOnlineProjection — ONNX no navegador (ligado por padrão)", () => {
  beforeEach(() => inferMock.mockReset());

  it("usa o score do ONNX quando a inferência resolve", async () => {
    inferMock.mockResolvedValue(0.83);
    const { result } = renderHook(() => useOnlineProjection(FEATURES, DELTA));
    await waitFor(() => expect(result.current.status).toBe("ok"));
    expect(result.current.prob).toBe(0.83);
    expect(inferMock).toHaveBeenCalledTimes(1);
  });

  it("cai no fallback (status error, prob null) quando a inferência não dá número válido", async () => {
    // Resultado inválido (NaN) → o hook reporta 'error' e prob null, igual ao
    // caminho de exceção (try/catch) — o simulador volta à heurística ancorada.
    inferMock.mockResolvedValue(Number.NaN);
    const { result } = renderHook(() => useOnlineProjection(FEATURES, DELTA));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.prob).toBeNull();
  });

  it("não infere em repouso (sem intervenção)", () => {
    inferMock.mockResolvedValue(0.5);
    const { result } = renderHook(() => useOnlineProjection(FEATURES, {}));
    expect(inferMock).not.toHaveBeenCalled();
    expect(result.current.prob).toBeNull();
  });
});
