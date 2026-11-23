import { describe, expect, it } from "vitest";
import { EMPTY_PAYLOAD_HASH, signature, uriEncode } from "../src/lib/media-store/sigv4";

// The documented AWS Signature Version 4 examples. The credentials are AWS's published example values, not keys.

describe("SigV4 against the AWS test suite (aws-sig-v4-test-suite)", () => {
  const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "service" };
  const date = new Date("2015-08-30T12:36:00Z");

  it("signs get-vanilla", () => {
    const signed = signature({ method: "GET", url: new URL("https://example.amazonaws.com/"), headers: {}, payloadHash: EMPTY_PAYLOAD_HASH }, credentials, date);
    expect(signed.canonical).toBe([
      "GET", "/", "", "host:example.amazonaws.com", "x-amz-date:20150830T123600Z", "", "host;x-amz-date", EMPTY_PAYLOAD_HASH,
    ].join("\n"));
    expect(signed.stringToSign).toBe([
      "AWS4-HMAC-SHA256", "20150830T123600Z", "20150830/us-east-1/service/aws4_request",
      "bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63",
    ].join("\n"));
    expect(signed.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, " +
      "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  });

  it("signs get-vanilla-query-order-key-case (query parameters sorted by name)", () => {
    const signed = signature({ method: "GET", url: new URL("https://example.amazonaws.com/?Param2=value2&Param1=value1"), headers: {}, payloadHash: EMPTY_PAYLOAD_HASH }, credentials, date);
    expect(signed.signature).toBe("b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500");
  });

  it("signs post-vanilla", () => {
    const signed = signature({ method: "POST", url: new URL("https://example.amazonaws.com/"), headers: {}, payloadHash: EMPTY_PAYLOAD_HASH }, credentials, date);
    expect(signed.signature).toBe("5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b");
  });
});

describe("SigV4 against the Amazon S3 documentation example (GET object)", () => {
  it("signs the documented request", () => {
    const signed = signature({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: { range: "bytes=0-9", "x-amz-content-sha256": EMPTY_PAYLOAD_HASH },
      payloadHash: EMPTY_PAYLOAD_HASH,
    }, { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "s3" },
    new Date("2013-05-24T00:00:00Z"));
    expect(signed.signature).toBe("f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
    expect(signed.headers.authorization).toContain("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,");
  });
});

it("encodes as RFC 3986 asks", () => {
  expect(uriEncode("a b+c*(d)!'~._-")).toBe("a%20b%2Bc%2A%28d%29%21%27~._-");
});
