/** Minimal uncompressed ZIP writer. Used only for local collection backups. */
export function zipFiles(files) {
    // ZIP format STORE without third-party dependencies
    const crcTable = Array.from({
        length: 256
    }, (_, n) => {
        for (let i = 0; i < 8; i++) {
            n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
        }
        return n >>> 0;
    });
    const crc32 = buf => {
        let c = 0xffffffff;
        for (const x of buf) {
            c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
        }
        return (c ^ 0xffffffff) >>> 0;
    };
    const local = [], central = [];
    let offset = 0;
    for (const [name, buf] of files) {
        const nm = Buffer.from(name.replace(/\\/g, '/'));
        const crc = crc32(buf);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(buf.length, 18);
        lh.writeUInt32LE(buf.length, 22);
        lh.writeUInt16LE(nm.length, 26);
        local.push(lh, nm, buf);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0);
        ch.writeUInt16LE(20, 4);
        ch.writeUInt16LE(20, 6);
        ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(buf.length, 20);
        ch.writeUInt32LE(buf.length, 24);
        ch.writeUInt16LE(nm.length, 28);
        ch.writeUInt32LE(offset, 42);
        central.push(ch, nm);
        offset += lh.length + nm.length + buf.length;
    }
    const centralSize = central.reduce((x, b) => x + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, ...central, end]);
}
