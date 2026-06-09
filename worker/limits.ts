/** Output buffer cap (bytes) for spawnSync; bounded to avoid unbounded memory. */
export const MAX_BUFFER =
  Number(process.env.BLAST_MAX_BUFFER) || 1024 * 1024 * 1024; // 1 GiB
