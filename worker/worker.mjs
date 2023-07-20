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
const prisma = new PrismaClient();
const connection = {
    host: process.env.JOBQUEUE_HOST,
    port: Number(process.env.JOBQUEUE_PORT),
};
export default function jobProcessor(job) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Started job ${job.id}`);
        const { data: { program, query, expectThreshold, matrix, database, gapCosts, wordSize, maxTargetSeqs, queryTo, queryFrom } } = job;
        // console.dir(job.data, { depth: null });
        const [gapOpen, gapExtend] = gapCosts.split(',');
        const dbPath = path.join(process.env.BLASTDB_PATH || '', database);
        const numThreads = process.env.NUM_BLAST_THREADS || '4';
        const args = [
            '-db', dbPath,
            '-evalue', expectThreshold,
            '-matrix', matrix,
            '-outfmt', '16',
            '-gapopen', gapOpen,
            '-gapextend', gapExtend,
            '-word_size', wordSize,
            '-num_threads', numThreads,
            '-max_target_seqs', maxTargetSeqs,
            '-query_loc', `${queryFrom || 1}-${queryTo || query.length}`
        ];
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
const worker = new Worker("jobqueue", jobProcessor, { connection, lockDuration: 7200000 });
console.log("worker started");
worker.on("progress", (job, progress) => {
    console.log(`Progress job ${job.id}: ${progress}`);
});
worker.on("completed", (job, returnValue) => {
    console.log(`Completed job ${job.id}: ${returnValue}`);
});
worker.on("failed", (job, err) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn(`Failed job ${job === null || job === void 0 ? void 0 : job.id}: ${err}`);
    yield prisma.blastjob.update({
        where: { id: job === null || job === void 0 ? void 0 : job.id },
        data: {
            err: err.message,
            finished: new Date()
        }
    });
}));
worker.on("error", (err) => {
    console.warn(`Error: ${err}`);
});
