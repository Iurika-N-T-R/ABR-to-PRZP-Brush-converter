// Browser stand-ins for the two Node built-ins the converter uses; wired in by the `build:web` script
// (esbuild --inject for the global Buffer, --alias for node:crypto).
import { blake2b } from '@noble/hashes/blake2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export { Buffer } from 'buffer';

// ponytail: only the one call infinite-painter.ts makes, createHash('blake2b512').update(data).digest('hex').
export const createHash = () => ({ update: (data) => ({ digest: () => bytesToHex(blake2b(data)) }) });
