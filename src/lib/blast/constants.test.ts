import {
  isAllowedDatabase,
  isAllowedFlavour,
  COMPOSITIONAL_ADJUSTMENTS,
  COMP_BASED_STATS,
  BLASTN_TASK_PRESETS,
  BLASTN_TASKS,
  PROGRAMS,
} from "./constants";

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

describe("COMP_BASED_STATS", () => {
  it("has a -comp_based_stats code for every compositional adjustment", () => {
    for (const adj of COMPOSITIONAL_ADJUSTMENTS) {
      expect(COMP_BASED_STATS[adj]).toMatch(/^[0-3]$/);
    }
  });
});

describe("BLASTN_TASK_PRESETS", () => {
  it("is keyed by the blastn program options and maps each to a -task", () => {
    const programs = PROGRAMS.get("blastn") ?? [];
    expect(Object.keys(BLASTN_TASK_PRESETS).sort()).toEqual([...programs].sort());
    for (const program of programs) {
      expect(BLASTN_TASKS[program]).toBe(BLASTN_TASK_PRESETS[program].task);
    }
  });

  it("includes each preset's default word size in its own option list", () => {
    for (const preset of Object.values(BLASTN_TASK_PRESETS)) {
      expect(preset.wordSizes).toContain(preset.wordSize);
    }
  });
});
