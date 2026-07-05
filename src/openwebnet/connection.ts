import net from "node:net";
import { authenticationResponse, generateClientNonce } from "./hmac";

export const PKT_ACK = "*#*1##";
export const PKT_NACK = "*#*0##";
export const PKT_START_CONFIG = "*99*0##";
export const PKT_START_COMMAND = "*99*9##";
export const PKT_START_MONITOR = "*99*1##";

async function receive(conn: net.Socket) {
  return new Promise<string>((res, rej) => {
    const onData = (data: Buffer) => {
      conn.off("error", onError);
      const s = data.toString();
      console.log("received", s);
      res(s);
    };
    const onError = (err: Error) => {
      conn.off("data", onData);
      rej(err);
    };

    conn.once("data", onData);
    conn.once("error", onError);
  });
}

export type ConnectOptions = {
  host: string;
  port: number;
  password: string;
};

export async function connectAndAuthenticate(
  opts: ConnectOptions,
  startCommand: string
) {
  const { host, port, password } = opts;
  const con = net.connect({ host, port });

  try {
    await receive(con); // ack
    con.write(startCommand);
    const shacmd = await receive(con);
    const sha = /\*98\*(\d+)##/.exec(shacmd)?.at(1);
    console.log("sha", sha);
    con.write(PKT_ACK); //
    const challenge = await receive(con); // ack
    const server_nonce = /\*#(\d+)##/.exec(challenge)?.at(1)!;
    console.log("nonce", server_nonce);
    const client_nonce = generateClientNonce();
    const response = authenticationResponse(password, server_nonce, client_nonce);
    con.write(response);
    await receive(con); // ack//con.end();
    con.write(PKT_ACK);
    return con;
  } catch (err) {
    con.destroy();
    throw err;
  }
}
