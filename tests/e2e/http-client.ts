import { request as httpRequest } from "node:http";
// Real socket clients: tests never spoof the application's internal identity proof.
export function socketClient(
  address: string,
  useProxy = process.env.TRUST_PROXY_IP === "1",
) {
  async function send(
    method: string,
    path: string,
    options: { headers?: Record<string, string>; data?: unknown } = {},
  ) {
    const body =
      options.data === undefined
        ? undefined
        : Buffer.isBuffer(options.data)
          ? options.data
          : Buffer.from(JSON.stringify(options.data));
    return new Promise<{
      status(): number;
      headers(): Record<string, string>;
      json(): Promise<ReturnType<typeof JSON.parse>>;
      text(): Promise<string>;
    }>((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: "127.0.0.1",
          port: 3000,
          path,
          method,
          localAddress: useProxy ? "127.0.0.10" : address,
          headers: {
            host: "localhost:3000",
            "content-type": "application/json",
            ...options.headers,
            ...(useProxy ? { "x-real-ip": address } : {}),
            ...(body ? { "content-length": String(body.length) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            resolve({
              status: () => res.statusCode!,
              headers: () => res.headers as Record<string, string>,
              json: async () => JSON.parse(text),
              text: async () => text,
            });
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(15000, () => req.destroy(new Error("TEST_HTTP_TIMEOUT")));
      req.end(body);
    });
  }
  return {
    post: (
      path: string,
      options: { headers?: Record<string, string>; data?: unknown },
    ) => send("POST", path, options),
    get: (path: string) => send("GET", path),
  };
}
