import { expect } from "chai";
import { EventEmitter } from "node:events";
import net from "node:net";
import {
  connectAndAuthenticate,
  PKT_ACK,
  PKT_START_COMMAND,
} from "./connection";

class FakeSocket extends EventEmitter {
  destroyed = false;
  writes: string[] = [];
  onWrite?: (msg: string) => void;

  write(msg: string, cb?: (err?: Error) => void) {
    this.writes.push(msg);
    this.onWrite?.(msg);
    cb?.();
    return true;
  }

  destroy() {
    this.destroyed = true;
    this.emit("close");
    return this;
  }
}

describe("OpenWebNet connection", () => {
  let originalConnect: typeof net.connect;

  beforeEach(() => {
    originalConnect = net.connect;
  });

  afterEach(() => {
    net.connect = originalConnect;
  });

  it("authenticates and leaves the socket open", async () => {
    const socket = new FakeSocket();
    let sentChallenge = false;

    socket.onWrite = (msg) => {
      if (msg === PKT_START_COMMAND) {
        process.nextTick(() => socket.emit("data", Buffer.from("*98*2##")));
        return;
      }

      if (msg === PKT_ACK && !sentChallenge) {
        sentChallenge = true;
        process.nextTick(() =>
          socket.emit("data", Buffer.from("*#01020304##"))
        );
        return;
      }

      if (msg !== PKT_ACK) {
        process.nextTick(() => socket.emit("data", Buffer.from(PKT_ACK)));
      }
    };

    net.connect = (() => {
      process.nextTick(() => socket.emit("data", Buffer.from(PKT_ACK)));
      return socket;
    }) as unknown as typeof net.connect;

    const result = await connectAndAuthenticate(
      { host: "127.0.0.1", port: 20000, password: "secret" },
      PKT_START_COMMAND
    );

    expect(result).to.equal(socket);
    expect(socket.destroyed).to.equal(false);
    expect(socket.writes[0]).to.equal(PKT_START_COMMAND);
    expect(socket.writes[1]).to.equal(PKT_ACK);
    expect(socket.writes[2]).to.match(/^\*#\d+\*\d+##$/);
    expect(socket.writes[3]).to.equal(PKT_ACK);
  });

  it("destroys and rejects when the socket errors during authentication", async () => {
    const socket = new FakeSocket();
    const socketError = new Error("read ETIMEDOUT");

    socket.onWrite = (msg) => {
      if (msg === PKT_START_COMMAND) {
        process.nextTick(() => socket.emit("error", socketError));
      }
    };

    net.connect = (() => {
      process.nextTick(() => socket.emit("data", Buffer.from(PKT_ACK)));
      return socket;
    }) as unknown as typeof net.connect;

    let thrown: unknown;
    try {
      await connectAndAuthenticate(
        { host: "127.0.0.1", port: 20000, password: "secret" },
        PKT_START_COMMAND
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown).to.equal(socketError);
    expect(socket.destroyed).to.equal(true);
  });
});
