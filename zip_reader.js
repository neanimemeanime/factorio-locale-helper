import fs from 'fs';
import zlib from 'zlib';

/**
 * Fast seek-based zip entries extractor.
 * Reads only the Central Directory from the end of the ZIP file and extracts
 * matching files directly into memory using zlib without temporary files on disk.
 *
 * @param {string} zipPath - Path to the .zip archive.
 * @param {function(string): boolean} [filterFn] - Optional predicate to filter entry filenames.
 * @returns {Array<{name: string, content: string}>}
 */
export function readZipEntries(zipPath, filterFn = null) {
    if (!fs.existsSync(zipPath)) {
        return [];
    }

    const fd = fs.openSync(zipPath, 'r');
    try {
        const stat = fs.fstatSync(fd);
        const fileSize = stat.size;
        if (fileSize < 22) return [];

        // Read last 65KB to locate End of Central Directory (EOCD) signature 0x06054b50
        const readLen = Math.min(fileSize, 65557);
        const tailBuf = Buffer.alloc(readLen);
        fs.readSync(fd, tailBuf, 0, readLen, fileSize - readLen);

        let eocdOffsetInTail = -1;
        for (let i = readLen - 22; i >= 0; i--) {
            if (tailBuf.readUInt32LE(i) === 0x06054b50) {
                eocdOffsetInTail = i;
                break;
            }
        }
        if (eocdOffsetInTail === -1) return [];

        const totalEntries = tailBuf.readUInt16LE(eocdOffsetInTail + 10);
        const cdSize = tailBuf.readUInt32LE(eocdOffsetInTail + 12);
        const cdOffset = tailBuf.readUInt32LE(eocdOffsetInTail + 16);

        // Read Central Directory
        const cdBuf = Buffer.alloc(cdSize);
        fs.readSync(fd, cdBuf, 0, cdSize, cdOffset);

        let offset = 0;
        const results = [];

        for (let i = 0; i < totalEntries; i++) {
            if (cdBuf.readUInt32LE(offset) !== 0x02014b50) break;
            const compression = cdBuf.readUInt16LE(offset + 10);
            const compSize = cdBuf.readUInt32LE(offset + 20);
            const fnameLen = cdBuf.readUInt16LE(offset + 28);
            const extraLen = cdBuf.readUInt16LE(offset + 30);
            const commentLen = cdBuf.readUInt16LE(offset + 32);
            const localHeaderOffset = cdBuf.readUInt32LE(offset + 42);

            const filename = cdBuf.toString('utf-8', offset + 46, offset + 46 + fnameLen);
            offset += 46 + fnameLen + extraLen + commentLen;

            if (filterFn && !filterFn(filename)) continue;

            // Read Local File Header (30 bytes fixed) to calculate exact payload offset
            const localHeadBuf = Buffer.alloc(30);
            fs.readSync(fd, localHeadBuf, 0, 30, localHeaderOffset);
            if (localHeadBuf.readUInt32LE(0) !== 0x04034b50) continue;

            const localFnameLen = localHeadBuf.readUInt16LE(26);
            const localExtraLen = localHeadBuf.readUInt16LE(28);
            const dataOffset = localHeaderOffset + 30 + localFnameLen + localExtraLen;

            const rawData = Buffer.alloc(compSize);
            fs.readSync(fd, rawData, 0, compSize, dataOffset);

            let fileData;
            if (compression === 0) {
                fileData = rawData;
            } else if (compression === 8) {
                try {
                    fileData = zlib.inflateRawSync(rawData);
                } catch (_) {
                    continue;
                }
            } else {
                continue;
            }

            // Factorio cfg files are UTF-8 (with optional BOM)
            let text = fileData.toString('utf-8');
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }

            results.push({ name: filename, content: text });
        }

        return results;
    } finally {
        fs.closeSync(fd);
    }
}
