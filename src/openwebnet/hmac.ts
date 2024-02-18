import { createHash, randomBytes } from "node:crypto";

// https://developer.legrand.com/uploads/2019/12/Hmac.pdf

export function generateClientNonce() {
  return randomBytes(32);
}

export function bufToOWInt(buf: Buffer) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return Array.from(buf)
    .map((b) => pad(b >> 4) + pad(b % 16))
    .join("");
}

export function owIntToBuf(val: string): Buffer {
  const result = new Uint8Array(val.length / 4);
  for (let i = 0; i < result.length; i += 1) {
    const chunk = val.slice(i * 4, i * 4 + 4);
    result[i] = parseInt(chunk.slice(0, 2)) * 16 + parseInt(chunk.slice(2, 4));
  }
  return Buffer.from(result);
}

export function hashPassword(
  password: string,
  server_nonce: string,
  client_nonce: Buffer
) {
  const hashHex = (s: string) => createHash("sha256").update(s).digest("hex");
  const msg =
    owIntToBuf(server_nonce).toString("hex") +
    client_nonce.toString("hex") +
    "736F70653E" +
    "636F70653E" +
    hashHex(password);
  // console.log(msg);
  const result = bufToOWInt(Buffer.from(hashHex(msg), "hex"));
  return result;
}

// serverNonce format: openwebnet int, just as received from the socket
export function authenticationResponse(
  password: string,
  serverNonce: string,
  clientNonce: Buffer
) {
  const passwordHash = hashPassword(password, serverNonce, clientNonce);
  return `*#${bufToOWInt(clientNonce)}*${passwordHash}##`;
}
