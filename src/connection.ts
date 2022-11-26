import net, { Socket } from "node:net";
import { authenticationResponse, generateClientNonce } from "./hmac";

export const PKT_ACK = "*#*1##";
export const PKT_NACK = "*#*0##";
export const PKT_START_CONFIG = "*99*0##";
export const PKT_START_COMMAND = "*99*9##";
export const PKT_START_MONITOR = "*99*1##";

async function receive(conn: net.Socket) {
  return new Promise<string>((res, rej) => {
    conn.once("data", (data) => {
      const s = data.toString();
      console.log("received", s);
      res(s);
    });
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
}

// Handles disconnects
export class ConnectionManager {
  con?: Socket;

  public constructor(
    public opts: ConnectOptions,
    public startCommand: string
  ) {}

  async getSocket() {
    if (!this.con) {
      const con = await connectAndAuthenticate(this.opts, this.startCommand);
      con.on("close", () => {
        this.con = undefined;
      });
      this.con = con;
    }
    return this.con!;
  }
}
//connect(host, port, password);
//testHmac();
