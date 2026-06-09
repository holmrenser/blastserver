import { isAllowedDatabase, isAllowedFlavour } from "./constants";

describe("isAllowedFlavour", () => {
  it("accepts the known BLAST flavours", () => {
    expect(isAllowedFlavour("blastp")).toBe(true);
    expect(isAllowedFlavour("tblastx")).toBe(true);
  });

  it("rejects anything else (command-injection guard)", () => {
    expect(isAllowedFlavour("rm")).toBe(false);
    expect(isAllowedFlavour("blastp; rm -rf /")).toBe(false);
    expect(isAllowedFlavour(undefined)).toBe(false);
    expect(isAllowedFlavour(123)).toBe(false);
  });
});

describe("isAllowedDatabase", () => {
  it("accepts a database that belongs to the flavour", () => {
    expect(isAllowedDatabase("blastp", "nr")).toBe(true);
    expect(isAllowedDatabase("blastn", "core_nt")).toBe(true);
  });

  it("rejects a database from a different molecule type", () => {
    expect(isAllowedDatabase("blastp", "core_nt")).toBe(false);
    expect(isAllowedDatabase("blastn", "nr")).toBe(false);
  });

  it("rejects path-traversal attempts (path-traversal guard)", () => {
    expect(isAllowedDatabase("blastp", "../../../etc/passwd")).toBe(false);
    expect(isAllowedDatabase("blastp", "nr/../../../etc")).toBe(false);
    expect(isAllowedDatabase("blastp", undefined)).toBe(false);
  });
});
