import { expect } from "chai";
import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { ConnectOptions } from "./connection";

class FakeSocket extends EventEmitter {
  destroyed = false;
  writes: string[] = [];
  writeError?: Error;

  write(msg: string, cb?: (err?: Error) => void) {
    this.writes.push(msg);
    cb?.(this.writeError);
    return !this.writeError;
  }

  destroy() {
    this.destroyed = true;
    this.emit("close");
    return this;
  }
}

const opts: ConnectOptions = {
  host: "127.0.0.1",
  port: 20000,
  password: "secret",
};

function loadCommandSession(
  connectAndAuthenticate: () => Promise<FakeSocket>
) {
  const connectionPath = require.resolve("./connection");
  const commandSessionPath = require.resolve("./commandsession");
  const connectionModule = require(connectionPath);
  const originalConnectAndAuthenticate =
    connectionModule.connectAndAuthenticate;

  connectionModule.connectAndAuthenticate = connectAndAuthenticate;
  delete require.cache[commandSessionPath];

  const { CommandSession } = require("./commandsession");

  return {
    CommandSession: CommandSession as new (opts: ConnectOptions) => {
      con?: Socket;
      getSocket(): Promise<Socket>;
      sendMessage(msg: string): Promise<void>;
    },
    restore() {
      connectionModule.connectAndAuthenticate = originalConnectAndAuthenticate;
      delete require.cache[commandSessionPath];
    },
  };
}

describe("CommandSession", () => {
  it("resets the command socket on socket error and reconnects for the next command", async () => {
    const sockets: FakeSocket[] = [];
    const { CommandSession, restore } = loadCommandSession(async () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });

    try {
      const session = new CommandSession(opts);
      const first = await session.getSocket();

      first.emit("error", new Error("read ETIMEDOUT"));

      expect(sockets[0].destroyed).to.equal(true);
      expect(session.con).to.equal(undefined);

      await session.sendMessage("*1*1*21##");

      expect(sockets).to.have.length(2);
      expect(sockets[1].writes).to.deep.equal(["*1*1*21##"]);
      expect(session.con).to.equal(sockets[1]);
    } finally {
      restore();
    }
  });

  it("resets the command socket when a write callback reports an error", async () => {
    const socket = new FakeSocket();
    socket.writeError = new Error("write failed");
    const { CommandSession, restore } = loadCommandSession(async () => socket);

    try {
      const session = new CommandSession(opts);

      await session.sendMessage("*1*0*21##");

      expect(socket.writes).to.deep.equal(["*1*0*21##"]);
      expect(socket.destroyed).to.equal(true);
      expect(session.con).to.equal(undefined);
    } finally {
      restore();
    }
  });
});
