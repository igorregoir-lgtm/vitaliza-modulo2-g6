// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTrilhaProgress } from "./use-trilha-progress";

const KEY = "vitaliza:trilha:v1";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useTrilhaProgress (persistência sessionStorage — reset ao fechar)", () => {
  it("começa vazio e hidrata no cliente", () => {
    const { result } = renderHook(() => useTrilhaProgress());
    expect(result.current.completed).toEqual([]);
    expect(result.current.pct).toBe(0);
    expect(result.current.hydrated).toBe(true);
  });

  it("markComplete persiste no sessionStorage e reflete em isComplete/completed", () => {
    const { result } = renderHook(() => useTrilhaProgress());
    act(() => result.current.markComplete("entender"));
    expect(result.current.isComplete("entender")).toBe(true);
    expect(result.current.completed).toContain("entender");
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]") as string[];
    expect(stored).toContain("entender");
  });

  it("não duplica a mesma missão e reset limpa tudo", () => {
    const { result } = renderHook(() => useTrilhaProgress());
    act(() => {
      result.current.markComplete("entender");
      result.current.markComplete("entender");
    });
    expect(result.current.completed.filter((x) => x === "entender")).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.completed).toEqual([]);
    expect(window.sessionStorage.getItem(KEY)).toBe("[]");
  });

  it("pct = concluídas / total * 100", () => {
    const { result } = renderHook(() => useTrilhaProgress());
    act(() => result.current.markComplete("entender"));
    expect(result.current.pct).toBe(Math.round((1 / 6) * 100)); // 17
  });

  it("lê progresso pré-existente do sessionStorage", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify(["entender", "explicar"]));
    const { result } = renderHook(() => useTrilhaProgress());
    expect(result.current.completed).toEqual(["entender", "explicar"]);
    expect(result.current.pct).toBe(Math.round((2 / 6) * 100)); // 33
  });
});
