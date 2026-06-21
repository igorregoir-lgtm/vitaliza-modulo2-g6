// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  useOnlineProjection,
  ONLINE_INFERENCE_ENABLED,
} from "./use-online-projection";
import type { CustomerFeatures } from "@/lib/types";

// Invariante de segurança de produção: sem a env NEXT_PUBLIC_ONLINE_INFERENCE
// (caso no ambiente de teste), o hook deve ser inerte — nenhuma chamada de rede
// e status "off", de modo que o simulador siga 100% na heurística ancorada.

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

describe("useOnlineProjection — flag desligada (padrão)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a flag está desligada no ambiente de teste", () => {
    expect(ONLINE_INFERENCE_ENABLED).toBe(false);
  });

  it("não chama a rede e reporta status 'off' mesmo com intervenção", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() =>
      useOnlineProjection(FEATURES, { Avg_class_frequency_current_month: 3 }),
    );
    expect(result.current.status).toBe("off");
    expect(result.current.prob).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
