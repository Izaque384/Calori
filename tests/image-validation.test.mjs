import test from "node:test";
import assert from "node:assert/strict";
import { hasValidImageSignature } from "../src/lib/image-validation.ts";

test("accepts JPEG magic bytes", () => {
  assert.equal(
    hasValidImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    true,
  );
});

test("accepts PNG magic bytes", () => {
  assert.equal(
    hasValidImageSignature(
      "image/png",
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    true,
  );
});

test("accepts WebP RIFF signature", () => {
  const bytes = new TextEncoder().encode("RIFF0000WEBP");
  assert.equal(hasValidImageSignature("image/webp", bytes), true);
});

test("accepts AVIF file type box", () => {
  const bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x61, 0x76, 0x69, 0x66,
    0x00, 0x00, 0x00, 0x00,
  ]);
  assert.equal(hasValidImageSignature("image/avif", bytes), true);
});

test("rejects spoofed image MIME type", () => {
  const bytes = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(hasValidImageSignature("image/png", bytes), false);
  assert.equal(hasValidImageSignature("image/jpeg", bytes), false);
});
