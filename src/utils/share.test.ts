import { describe, expect, it } from "vitest";
import { buildSharePayload, decodeShare, encodeShare, readSharePayload } from "./share";

describe("encodeShare / decodeShare", () => {
  it("ida e volta em ASCII", () => {
    const s = "++++++++[>++++<-]>++.";
    expect(decodeShare(encodeShare(s))).toBe(s);
  });

  it("ida e volta com acentos e emoji (UTF-8)", () => {
    for (const s of ["Olá, mundo!", "cação", "😀🎉", "linha1\nlinha2\ttab"]) {
      expect(decodeShare(encodeShare(s))).toBe(s);
    }
  });

  it("string vazia", () => {
    expect(encodeShare("")).toBe("");
    expect(decodeShare("")).toBe("");
  });

  it("não usa caracteres proibidos em URL", () => {
    const s = "????>>>>++++" + "ÿ".repeat(50);
    expect(encodeShare(s)).not.toMatch(/[+/=]/);
  });

  it("devolve null para base64 inválido", () => {
    expect(decodeShare("!!!não é base64!!!")).toBeNull();
  });
});

describe("readSharePayload", () => {
  it("recupera código e entrada", () => {
    const hash = "#c=" + buildSharePayload("+++.", "abc");
    expect(readSharePayload(hash)).toEqual({ code: "+++.", input: "abc" });
  });

  it("aceita hash sem o #", () => {
    const p = buildSharePayload("+++", "");
    expect(readSharePayload("c=" + p)).toEqual({ code: "+++", input: "" });
  });

  it("entrada ausente vira string vazia", () => {
    const raw = encodeShare(JSON.stringify({ v: 1, code: "+" }));
    expect(readSharePayload("#c=" + raw)).toEqual({ code: "+", input: "" });
  });

  it("hash que não é do BF Studio é ignorado", () => {
    expect(readSharePayload("#outracousa")).toBeNull();
    expect(readSharePayload("")).toBeNull();
    expect(readSharePayload("#c=lixo")).toBeNull();
  });

  it("payload sem code é rejeitado", () => {
    const raw = encodeShare(JSON.stringify({ v: 1, input: "x" }));
    expect(readSharePayload("#c=" + raw)).toBeNull();
  });

  it("código longo sobrevive à viagem", () => {
    const code = "+>-<[]".repeat(3000);
    expect(readSharePayload("#c=" + buildSharePayload(code, "entrada"))).toEqual({ code, input: "entrada" });
  });
});
