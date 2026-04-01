import { describe, expect, it } from "vitest";
import {
  getAssetUploadPreflight,
  getBackupExportPreflight,
  getBackupImportPreflight,
  getFilesUploadPreflight,
} from "@/shared/lib/db/storagePreflight";

function createFile(size: number, name = "sample.bin") {
  return new File([new Uint8Array(size)], name, { type: "application/octet-stream" });
}

describe("storage preflight", () => {
  it("блокирует слишком тяжёлый одиночный asset", () => {
    const result = getAssetUploadPreflight(createFile(33 * 1024 * 1024), "Файл");
    expect(result.level).toBe("blocked");
  });

  it("предупреждает про тяжёлую пачку файлов", () => {
    const result = getFilesUploadPreflight(
      [createFile(10 * 1024 * 1024, "one.bin"), createFile(15 * 1024 * 1024, "two.bin")],
      "файлов блокнота",
    );
    expect(result.level).toBe("warning");
  });

  it("блокирует импорт backup при недостатке свободного места", () => {
    const result = getBackupImportPreflight(20 * 1024 * 1024, 5 * 1024 * 1024);
    expect(result.level).toBe("blocked");
  });

  it("предупреждает про тяжёлый экспорт backup", () => {
    const result = getBackupExportPreflight(30 * 1024 * 1024, 200 * 1024 * 1024);
    expect(result.level).toBe("warning");
  });
});
