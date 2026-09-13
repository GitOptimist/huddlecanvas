import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildV8Preview(
  root = repositoryRoot,
  destination = join(root, "dist/v8-preview"),
) {
  await mkdir(destination, { recursive: true });
  await copyFile(join(root, "index.html"), join(destination, "index.html"));
  return join(destination, "index.html");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const path = await buildV8Preview();
  process.stdout.write(`Copied unchanged v8 prototype to ${path}\n`);
}
