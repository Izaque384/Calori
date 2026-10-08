import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageCatalog,
  canManageSettings,
  canManageTables,
  canOperate,
  canViewReports,
} from "../src/lib/permissions.ts";

test("owner has full restaurant permissions", () => {
  assert.equal(canManageSettings("owner"), true);
  assert.equal(canManageCatalog("owner"), true);
  assert.equal(canManageTables("owner"), true);
  assert.equal(canOperate("owner"), true);
  assert.equal(canViewReports("owner"), true);
});

test("manager can operate but cannot manage owner settings", () => {
  assert.equal(canManageSettings("manager"), false);
  assert.equal(canManageCatalog("manager"), true);
  assert.equal(canManageTables("manager"), true);
  assert.equal(canOperate("manager"), true);
  assert.equal(canViewReports("manager"), true);
});

test("staff is restricted to restaurant operation", () => {
  assert.equal(canManageSettings("staff"), false);
  assert.equal(canManageCatalog("staff"), false);
  assert.equal(canManageTables("staff"), false);
  assert.equal(canOperate("staff"), true);
  assert.equal(canViewReports("staff"), false);
});
