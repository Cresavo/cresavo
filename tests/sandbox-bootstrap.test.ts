import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createLoginSql, envFile, libpqEnv, loginUrl, parseMigrationUrl, productionSettings, scramVerifier,
} from "../scripts/sandbox/bootstrap-lib.mjs";

const hosted = "postgresql://owner:p%40ss@ep-fictional.example.test:5432/sandbox?sslmode=require&channel_binding=require";

describe("sandbox bootstrap helpers", () => {
  it("builds a SCRAM-SHA-256 verifier that matches the RFC 5802 derivation", () => {
    const salt = Buffer.alloc(16, 7);
    const verifier = scramVerifier("a".repeat(64), salt, 4096);
    const salted = pbkdf2Sync("a".repeat(64), salt, 4096, 32, "sha256");
    const stored = createHash("sha256").update(createHmac("sha256", salted).update("Client Key").digest()).digest("base64");
    const server = createHmac("sha256", salted).update("Server Key").digest("base64");
    expect(verifier).toBe(`SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`);
    expect(() => scramVerifier("lösenord")).toThrow("SCRAM_ASCII_PASSWORD_REQUIRED");
  });

  it("refuses migration URLs that are not a TLS connection to a dedicated database", () => {
    expect(parseMigrationUrl(hosted).database).toBe("sandbox");
    expect(() => parseMigrationUrl("postgresql://owner:pw@db.example.test/sandbox")).toThrow("MIGRATION_URL_TLS_REQUIRED");
    expect(() => parseMigrationUrl("postgresql://owner:pw@db.example.test/postgres?sslmode=require")).toThrow("MIGRATION_URL_DATABASE_REQUIRED");
    expect(() => parseMigrationUrl("postgresql://owner@db.example.test/sandbox?sslmode=require")).toThrow("MIGRATION_URL_INVALID");
    expect(() => parseMigrationUrl("postgresql://owner:pw@db.example.test/sandbox?sslmode=require&host=/tmp")).toThrow("MIGRATION_URL_HOST_PARAMETER_REFUSED");
    expect(parseMigrationUrl("postgresql://owner:pw@127.0.0.1:5432/sandbox_test").local).toBe(true);
  });

  it("passes credentials to libpq through the environment", () => {
    const env = libpqEnv(new URL(hosted));
    expect(env).toMatchObject({ PGHOST: "ep-fictional.example.test", PGUSER: "owner", PGPASSWORD: "p@ss", PGDATABASE: "sandbox", PGSSLMODE: "require" });
    expect(libpqEnv(new URL("postgresql://u:p@db.example.test/s?sslmode=verify-full")).PGSSLROOTCERT).toBe("system");
  });

  it("derives login URLs the hosted sandbox accepts", () => {
    const migration = new URL(hosted + "&sslnegotiation=direct");
    const runtime = new URL(loginUrl(migration, "cresavo_sandbox_runtime", "f".repeat(64), "ep-pooled.example.test"));
    expect(runtime.username).toBe("cresavo_sandbox_runtime");
    expect(runtime.hostname).toBe("ep-pooled.example.test");
    expect(runtime.searchParams.getAll("sslmode")).toEqual(["verify-full"]);
    expect(runtime.searchParams.has("sslnegotiation")).toBe(false);
    expect(new URL(loginUrl(migration, "r", "f".repeat(64))).hostname).toBe("ep-fictional.example.test");
    expect(new URL(loginUrl(new URL("postgresql://o:p@127.0.0.1/s_test"), "r", "x")).searchParams.has("sslmode")).toBe(false);
  });

  it("creates logins without memberships or elevated attributes", () => {
    const sql = createLoginSql("cresavo_sandbox_runtime", scramVerifier("b".repeat(64)));
    expect(sql).toMatch(/^CREATE ROLE "cresavo_sandbox_runtime" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256\$/);
    expect(sql).not.toContain("b".repeat(64));
    expect(() => createLoginSql('x"; DROP', scramVerifier("b".repeat(64)))).toThrow("ROLE_NAME_INVALID");
    expect(() => createLoginSql("x", "plain")).toThrow("SCRAM_VERIFIER_INVALID");
  });

  it("shares one service token between the two projects and nothing else", () => {
    const { sandbox, gateway } = productionSettings({
      installation: "0196a07e-f751-48fa-8a1c-8e53e034a120", runtimeUrl: "postgresql://r@x/s", resetUrl: "postgresql://z@x/s",
      projectId: "prj_fictional", sandboxOrigin: "https://sandbox.example.test", gatewayOrigin: "https://gateway.example.test",
    });
    const value = (list: [string, string, boolean][], name: string) => list.find(([key]) => key === name)?.[1];
    expect(value(sandbox, "GATEWAY_SERVICE_TOKEN")).toMatch(/^[a-f0-9]{64}$/);
    expect(value(gateway, "GATEWAY_SERVICE_TOKEN")).toBe(value(sandbox, "GATEWAY_SERVICE_TOKEN"));
    expect(new Set(["SESSION_SECRET", "BOOKING_SANDBOX_IP_KEY", "CRON_SECRET", "GATEWAY_SERVICE_TOKEN"].map(n => value(sandbox, n))).size).toBe(4);
    expect(value(sandbox, "BOOKING_SANDBOX_PROJECT_ID")).toBe("prj_fictional");
    expect(gateway.map(([name]) => name)).toEqual(["SALON_ORIGIN", "GATEWAY_SERVICE_TOKEN"]);
    expect(sandbox.filter(([, , secret]) => secret).map(([name]) => name)).toEqual([
      "DATABASE_URL", "BOOKING_SANDBOX_RESET_DATABASE_URL", "SESSION_SECRET", "BOOKING_SANDBOX_IP_KEY", "CRON_SECRET", "GATEWAY_SERVICE_TOKEN",
    ]);
    expect(() => envFile([["A", "x\ny", false]])).toThrow("ENV_VALUE_INVALID");
  });
});
