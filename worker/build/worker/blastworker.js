var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { spawnSync } from "child_process";
import path from "path";
import { Worker } from "bullmq";
import { PrismaClient } from '@prisma/client';
import Crypto from 'crypto';
import { tmpdir } from 'os';
import Path from 'path';
import fs from 'fs';
const prisma = new PrismaClient();
const connection = {
    host: process.env.JOBQUEUE_HOST,
    port: Number(process.env.JOBQUEUE_PORT),
};
function blastJobProcessor(job) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Started BLAST job ${job.id}`);
        const { data: { flavour, program, query, expectThreshold, database, gapCosts, maxTargetSeqs, queryTo, queryFrom, 
        // eslint-disable-next-line no-unused-vars
        taxids, excludeTaxids, filterLowComplexity, lcaseMasking, softMasking, shortQueries } } = job;
        if (typeof query !== 'string' || query.length === 0) {
            throw new Error('No query provided');
        }
        const [gapOpen, gapExtend] = gapCosts.split(',');
        const dbPath = path.join(process.env.APP_BLAST_DB_PATH || '', database);
        const numThreads = process.env.NUM_BLAST_THREADS || '4';
        const args = [
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
            args.push('-lcase_masking');
        }
        if (flavour === 'blastp' || flavour === 'blastx' || flavour === 'tblastn') {
            const { data: { matrix, wordSize, compositionalAdjustment } } = job;
            args.push('-matrix', matrix, '-word_size', String(wordSize));
        }
        if (taxids && taxids.length) {
            const allTaxids = (yield prisma.taxonomy.findMany({
                where: { ancestors: { hasSome: taxids } },
                select: { id: true }
            })).map(({ id }) => id);
            const tmpFile = Path.join(tmpdir(), `blastserver.${Crypto.randomBytes(16).toString('hex')}.tmp`);
            const taxidString = allTaxids.join('\n');
            try {
                yield fs.promises.writeFile(tmpFile, taxidString);
            }
            catch (err) {
                throw new Error(`Writing tmp file failed: ${err}`);
            }
            if (excludeTaxids) {
                args.push('-negative_taxidlist', tmpFile);
            }
            else {
                args.push('-taxidlist', tmpFile);
            }
        }
        // Very large max buffer so we capture all BLAST output
        const options = { input: query, maxBuffer: 1000000000000 };
        console.log(`Running '${program} ${args.join(' ')}'`);
        const result = spawnSync(program, args, options);
        const stderr = result.stderr.toString('utf8');
        if (stderr)
            throw new Error(stderr);
        const stdout = result.stdout.toString('utf8');
        yield prisma.blastjob.update({
            where: { id: job.id },
            data: {
                results: stdout,
                finished: new Date()
            }
        });
        return 'finished';
    });
}
// HACK: extreme lock duration (2 hours) to prevent multiple workers picking up the same job 
const blastWorker = new Worker("blastQueue", blastJobProcessor, { connection, lockDuration: 7200000 });
console.log("BLAST worker started");
blastWorker.on("progress", (job, progress) => {
    console.log(`Progress BLAST job ${job.id}: ${progress}`);
});
blastWorker.on("completed", (job, returnValue) => {
    console.log(`Completed BLAST job ${job.id}: ${returnValue}`);
});
blastWorker.on("failed", (job, err) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn(`Failed BLAST job ${job === null || job === void 0 ? void 0 : job.id}: ${err}`);
    yield prisma.blastjob.update({
        where: { id: job === null || job === void 0 ? void 0 : job.id },
        data: {
            err: err.message,
            finished: new Date()
        }
    });
}));
blastWorker.on("error", (err) => {
    console.warn(`BLAST job error: ${err}`);
});
