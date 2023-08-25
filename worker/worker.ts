import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';
import Crypto from 'crypto';
import {tmpdir} from 'os';
import Path from 'path';
import fs from 'fs';

import type { FormData, BlastFlavour } from '../src/app/[blastFlavour]/blastflavour';

const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

export default async function jobProcessor(job: Job) {
  console.log(`Started job ${job.id}`);
  const { data: { 
    flavour, program, query, expectThreshold, database,
    gapCosts, maxTargetSeqs, queryTo, queryFrom,
    taxids, excludeTaxids, filterLowComplexity, lcaseMasking
  }}: { data: FormData<BlastFlavour> } = job;

  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('No query provided')
  }

  const [gapOpen,gapExtend] = gapCosts.split(',');
  const dbPath = path.join(process.env.APP_BLAST_DB_PATH || '', database);
  const numThreads = process.env.NUM_BLAST_THREADS || '4';
  const args: string[] = [
    '-db', dbPath,
    '-evalue', String(expectThreshold),
    '-outfmt', '16',
    '-gapopen', gapOpen,
    '-gapextend', gapExtend,
    '-num_threads', numThreads,
    '-max_target_seqs', String(maxTargetSeqs),
    '-query_loc', `${queryFrom || 1}-${queryTo || query.length}`
  ];

  if (flavour === 'blastp') {
    const { data: { matrix, wordSize }} = job;
    args.push(
      '-matrix', matrix,
      '-word_size', String(wordSize)
    )
  }

  if (taxids) {
    const allTaxids = (await prisma.taxonomy.findMany({
      where: { ancestors: { hasSome: taxids }},
      select: { id: true }
    })).map(({ id }) => id)
    const tmpFile = Path.join(tmpdir(), `blastserver.${Crypto.randomBytes(16).toString('hex')}.tmp`)
    const taxidString = allTaxids.join('\n')
    try {
      await fs.promises.writeFile(tmpFile, taxidString);
    } catch (err) {
      throw new Error(`Writing tmp file failed: ${err}`)
    }
    if (excludeTaxids) {
      args.push('-negative_taxidlist', tmpFile)
    } else {
      args.push('-taxidlist', tmpFile)
    }
  }

  // Very large max buffer so we capture all BLAST output
  const options = { input: query, maxBuffer: 1_000_000_000_000 };

  console.log(`Running '${program} ${args.join(' ')}'`)

  const result = spawnSync(program, args, options);
  const stderr = result.stderr.toString('utf8');
  if (stderr) throw new Error(stderr);
  const stdout = result.stdout.toString('utf8');
  await prisma.blastjob.update({
    where: {id: job.id},
    data: { 
      results: stdout,
      finished: new Date()
     }
  });
  return 'finished'
}

// HACK: extreme lock duration (2 hours) to prevent multiple workers picking up the same job 
const worker = new Worker("jobqueue", jobProcessor, { connection, lockDuration: 7_200_000 });

console.log("worker started");

worker.on("progress", (job, progress) => {
  console.log(`Progress job ${job.id}: ${progress}`);
});

worker.on("completed", (job, returnValue) => {
  console.log(`Completed job ${job.id}: ${returnValue}`);
});

worker.on("failed", async (job, err) => {
  console.warn(`Failed job ${job?.id}: ${err}`);
  await prisma.blastjob.update({
    where: {id: job?.id},
    data: { 
      err: err.message,
      finished: new Date()
    }
  })
});

worker.on("error", (err) => {
  console.warn(`Error: ${ err }`);
});