import { expect } from "chai";
import { EventEmitter } from "node:events";
import { Socket } from "node:net";
import { ConnectOptions } from "./connection";

class FakeSocket extends EventEmitter {
  destroyed = false;
  writes: string[] = [];

  write(msg: string) {
    this.writes.push(msg);
    return true;
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

function loadMonitorSession(
  connectAndAuthenticate: () => Promise<FakeSocket>
) {
  const connectionPath = require.resolve("./connection");
  const monitorPath = require.resolve("./monitor");
  const connectionModule = require(connectionPath);
  const originalConnectAndAuthenticate =
    connectionModule.connectAndAuthenticate;

  connectionModule.connectAndAuthenticate = connectAndAuthenticate;
  delete require.cache[monitorPath];

  const { MonitorSession } = require("./monitor");

  return {
    MonitorSession: MonitorSession as new (opts: ConnectOptions) => {
      init(): Promise<void>;
    },
    restore() {
      connectionModule.connectAndAuthenticate = originalConnectAndAuthenticate;
      delete require.cache[monitorPath];
    },
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("MonitorSession", () => {
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    originalSetTimeout = global.setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  it("retries monitor connection failures after 30 seconds", async () => {
    const timers: Array<{ cb: () => void; delay?: number }> = [];
    const sockets: FakeSocket[] = [];
    let attempts = 0;
    global.setTimeout = ((cb: () => void, delay?: number) => {
      timers.push({ cb, delay });
      return {} as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    const { MonitorSession, restore } = loadMonitorSession(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("read ETIMEDOUT");
      }
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });

    try {
      new MonitorSession(opts);
      await flushPromises();

      expect(attempts).to.equal(1);
      expect(timers).to.have.length(1);
      expect(timers[0].delay).to.equal(30_000);

      timers[0].cb();
      await flushPromises();

      expect(attempts).to.equal(2);
      expect(sockets).to.have.length(1);
    } finally {
      restore();
    }
  });

  it("destroys the monitor socket on error and schedules one reconnect", async () => {
    const timers: Array<{ cb: () => void; delay?: number }> = [];
    const socket = new FakeSocket();
    global.setTimeout = ((cb: () => void, delay?: number) => {
      timers.push({ cb, delay });
      return {} as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;

    const { MonitorSession, restore } = loadMonitorSession(async () => socket);

    try {
      new MonitorSession(opts);
      await flushPromises();

      socket.emit("error", new Error("read ETIMEDOUT"));
      socket.emit("close");

      expect(socket.destroyed).to.equal(true);
      expect(timers).to.have.length(1);
      expect(timers[0].delay).to.equal(30_000);
    } finally {
      restore();
    }
  });
});
