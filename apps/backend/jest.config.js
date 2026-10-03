// Unit-тесты (src, *.spec.ts) и e2e (test, *.e2e-spec.ts) — ни тем, ни другим не нужны Postgres/Redis.
module.exports = {
  rootDir: ".",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testRegex: ".*\\.(spec|e2e-spec)\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testEnvironment: "node",
};
