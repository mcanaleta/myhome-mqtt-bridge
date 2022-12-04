import { expect } from "chai";
import { bufToOWInt, generateClientNonce, owIntToBuf } from "./hmac";

describe("Hmac tests", () => {
  it("converts buffer -> to OWint format", () => {
    // the single test
    const buf = Buffer.from("15AF", "hex");
    const owint = bufToOWInt(buf);
    expect(owint).to.eq("01051015");
  });

  it("converts buffer -> to OWint format", () => {
    // the single test
    const owint = "011003051513";
    const buf = owIntToBuf(owint);
    expect(buf.toString("hex").toUpperCase()).to.equal("1A35FD");
  });

  it("converts from hex to openwebnet int (we call it OWINT) format", () => {
    const nonce = generateClientNonce();
    const owint = bufToOWInt(nonce);
    const buf = owIntToBuf(owint);
    expect(buf.toString("hex")).to.equal(nonce.toString("hex"));
  });
});
