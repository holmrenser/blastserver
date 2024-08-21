import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';
import Crypto from 'crypto';
import {tmpdir} from 'os';
import Path from 'path';
import fs from 'fs';
import { gzipSync } from 'zlib';

import type { BlastParameters } from '../src/app/[blastFlavour]/parameters.ts';

const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

/**
 * BLASTWORKER SECTION
 */

async function blastJobProcessor(job: Job) {
  console.log(`Started BLAST job ${job.id}`);
  const { data: { 
    flavour, program, query, expectThreshold, database,
    gapCosts, maxTargetSeqs, queryTo, queryFrom,
    // eslint-disable-next-line no-unused-vars
    taxids, excludeTaxids, filterLowComplexity, lcaseMasking, softMasking, shortQueries
  }}: { data: BlastParameters } = job;

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
    '-query_loc', `${queryFrom || 1}-${queryTo || query.length}`,
  ];

  if (lcaseMasking) {
    args.push('-lcase_masking')
  }

  if (flavour === 'blastp' || flavour === 'blastx' || flavour === 'tblastn') {
    const { data: { matrix, wordSize, compositionalAdjustment }} = job;
    args.push(
      '-matrix', matrix,
      '-word_size', String(wordSize)
    )
  }
  
  if (taxids && taxids.length) {
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
const blastWorker = new Worker("blastQueue", blastJobProcessor, { connection, lockDuration: 7_200_000 });

console.log("BLAST worker started");

blastWorker.on("progress", (job, progress) => {
  console.log(`Progress BLAST job ${job.id}: ${progress}`);
});

blastWorker.on("completed", (job, returnValue) => {
  console.log(`Completed BLAST job ${job.id}: ${returnValue}`);
});

blastWorker.on("failed", async (job, err) => {
  console.warn(`Failed BLAST job ${job?.id}: ${err}`);
  await prisma.blastjob.update({
    where: {id: job?.id},
    data: { 
      err: err.message,
      finished: new Date()
    }
  })
});

blastWorker.on("error", (err) => {
  console.warn(`BLAST job error: ${ err }`);
});

/**
 * DOWNLOADWORKER SECTION
 */

async function downloadJobProcessor(job: Job) {
  console.log(`Started download job ${job.id}`);
  const { data: { sequenceIds, database }}: { data: { sequenceIds: string[], database: string }} = job;

  const tmpFile = Path.join(tmpdir(), `blastserver.${Crypto.randomBytes(16).toString('hex')}.tmp`)
  const seqidString = sequenceIds.join('\n')
  try {
    await fs.promises.writeFile(tmpFile, seqidString);
  } catch (err) {
    throw new Error(`Writing tmp file failed: ${err}`)
  }

  const dbPath = path.join(process.env.APP_BLAST_DB_PATH || '', database);

  const args = [
    '-db', dbPath,
    '-entry_batch', tmpFile
  ]

  // Very large max buffer so we capture all BLAST output
  const options = { maxBuffer: 1_000_000_000_000 };

  console.log(`Running 'blastdmcmd ${args.join(' ')}'`)

  const result = spawnSync('blastdbcmd', args, options);
  const stderr = result.stderr.toString('utf8');
  if (stderr) throw new Error(stderr);
  const stdout = result.stdout.toString('utf8');

  const compressedOutput = gzipSync(stdout);

  await prisma.download.update({
    where: {id: job.id},
    data: { 
      results: compressedOutput,
      finished: new Date()
     }
  });
  return 'finished'
}

// HACK: extreme lock duration (2 hours) to prevent multiple workers picking up the same job 
const downloadWorker = new Worker("downloadQueue", downloadJobProcessor, { connection, lockDuration: 7_200_000 });

console.log("Download worker started");

downloadWorker.on("progress", (job, progress) => {
  console.log(`Progress download job ${job.id}: ${progress}`);
});

downloadWorker.on("completed", (job, returnValue) => {
  console.log(`Completed download job ${job.id}: ${returnValue}`);
});

downloadWorker.on("failed", async (job, err) => {
  console.warn(`Failed download job ${job?.id}: ${err}`);
  await prisma.download.update({
    where: {id: job?.id},
    data: { 
      err: err.message,
      finished: new Date()
    }
  })
});

downloadWorker.on("error", (err) => {
  console.warn(`Download job error: ${ err }`);
});