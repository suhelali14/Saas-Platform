// Makes one Ed25519 key pair for server-to-server calls (src/lib/s2s.ts).
//
//   node scripts/s2s-keygen.mjs
//
// The private key goes in the environment of the server that signs (the
// console's CONSOLE_SIGNING_KEY, or Growth's GROWTH_SIGNING_KEY) and nowhere
// else. The public key goes to the other side (Growth's CONSOLE_PUBLIC_KEY,
// or the console's GROWTH_PUBLIC_KEY). Run it once per signing server.
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
console.log("SIGNING_KEY (private, this server only):");
console.log(privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"));
console.log("");
console.log("PUBLIC_KEY (give to the other server):");
console.log(publicKey.export({ format: "der", type: "spki" }).toString("base64"));
