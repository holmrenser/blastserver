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
import { gzipSync } from 'zlib';
const prisma = new PrismaClient();
const connection = {
    host: process.env.JOBQUEUE_HOST,
    port: Number(process.env.JOBQUEUE_PORT),
};
function downloadJobProcessor(job) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Started download job ${job.id}`);
        const { data: { sequenceIds, database } } = job;
        const tmpFile = Path.join(tmpdir(), `blastserver.${Crypto.randomBytes(16).toString('hex')}.tmp`);
        const seqidString = sequenceIds.join('\n');
        try {
            yield fs.promises.writeFile(tmpFile, seqidString);
        }
        catch (err) {
            throw new Error(`Writing tmp file failed: ${err}`);
        }
        const dbPath = path.join(process.env.APP_BLAST_DB_PATH || '', database);
        const args = [
            '-db', dbPath,
            '-entry_batch', tmpFile
        ];
        // Very large max buffer so we capture all BLAST output
        const options = { maxBuffer: 1000000000000 };
        console.log(`Running 'blastdmcmd ${args.join(' ')}'`);
        const result = spawnSync('blastdbcmd', args, options);
        const stderr = result.stderr.toString('utf8');
        if (stderr)
            throw new Error(stderr);
        const stdout = result.stdout.toString('utf8');
        const compressedOutput = gzipSync(stdout);
        yield prisma.download.update({
            where: { id: job.id },
            data: {
                results: compressedOutput,
                finished: new Date()
            }
        });
        return 'finished';
    });
}
// HACK: extreme lock duration (2 hours) to prevent multiple workers picking up the same job 
const downloadWorker = new Worker("downloadQueue", downloadJobProcessor, { connection, lockDuration: 7200000 });
console.log("Download worker started");
downloadWorker.on("progress", (job, progress) => {
    console.log(`Progress download job ${job.id}: ${progress}`);
});
downloadWorker.on("completed", (job, returnValue) => {
    console.log(`Completed download job ${job.id}: ${returnValue}`);
});
downloadWorker.on("failed", (job, err) => __awaiter(void 0, void 0, void 0, function* () {
    console.warn(`Failed download job ${job === null || job === void 0 ? void 0 : job.id}: ${err}`);
    yield prisma.download.update({
        where: { id: job === null || job === void 0 ? void 0 : job.id },
        data: {
            err: err.message,
            finished: new Date()
        }
    });
}));
downloadWorker.on("error", (err) => {
    console.warn(`Download job error: ${err}`);
});
