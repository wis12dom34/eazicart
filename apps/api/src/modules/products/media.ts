import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import { requireDatabase, userId } from "../shared.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_STORAGE = 2 * 1024 * 1024 * 1024;
const types: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const filePattern = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const isValidImage = (body: Buffer, extension: string) => {
  if (extension === "jpg")
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (extension === "png")
    return body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return (
    body.length >= 12 &&
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  );
};

export function registerProductMedia(
  app: FastifyInstance,
  config: AppConfig,
  client?: PrismaClient,
) {
  const directory = config.REEL_MEDIA_DIRECTORY
    ? join(config.REEL_MEDIA_DIRECTORY, "products")
    : undefined;
  const baseUrl = config.REEL_MEDIA_BASE_URL?.replace(/\/$/, "");
  const attempts = new Map<string, number[]>();
  let active = 0;
  const held = new Set<FastifyRequest>();
  const release = (request: FastifyRequest) => {
    if (held.delete(request)) active--;
  };

  app.addContentTypeParser(
    Object.keys(types),
    { parseAs: "buffer", bodyLimit: MAX_BYTES },
    (_request, body, done) => done(null, body),
  );

  app.post(
    "/seller/products/media",
    {
      bodyLimit: MAX_BYTES,
      onRequest: async (request) => {
        await app.authenticate(request);
        if (!directory || !baseUrl)
          throw new AppError(
            503,
            "MEDIA_UNAVAILABLE",
            "Product photo uploads are temporarily unavailable",
          );
        const seller = await requireDatabase(client).sellerProfile.findUnique({
          where: { userId: userId(request) },
          select: { id: true },
        });
        if (!seller)
          throw new AppError(
            403,
            "SELLER_REQUIRED",
            "Create a seller profile before uploading product photos",
          );

        const now = Date.now();
        for (const [id, entries] of attempts)
          if (entries.at(-1)! < now - 60_000) attempts.delete(id);
        const recent = (attempts.get(seller.id) ?? []).filter(
          (time) => time > now - 60_000,
        );
        if (recent.length >= 12 || active >= 3)
          throw new AppError(
            429,
            "UPLOAD_BUSY",
            "Please wait a moment before uploading more photos",
          );
        attempts.set(seller.id, [...recent, now]);
        active++;
        held.add(request);
      },
      onResponse: (request, _reply, done) => {
        release(request);
        done();
      },
      onRequestAbort: (request, done) => {
        release(request);
        done();
      },
      onError: (request, _reply, _error, done) => {
        release(request);
        done();
      },
      errorHandler: (error, _request, reply) => {
        const value = error as Error & { statusCode?: number };
        if (value.statusCode === 413) {
          reply.code(413).send({
            error: {
              code: "IMAGE_TOO_LARGE",
              message: "Choose a photo smaller than 8 MB",
            },
          });
          return;
        }
        if (error instanceof AppError) {
          reply
            .code(error.statusCode)
            .send({ error: { code: error.code, message: error.message } });
          return;
        }
        if (value.statusCode === 415) {
          reply.code(415).send({
            error: {
              code: "IMAGE_TYPE",
              message: "Choose a JPG, PNG or WebP photo",
            },
          });
          return;
        }
        app.log.error(error);
        reply.code(500).send({
          error: {
            code: "UPLOAD_FAILED",
            message: "Unable to upload this photo. Please try again.",
          },
        });
      },
    },
    async (request, reply) => {
      const mime = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
      const extension = types[mime];
      const body = request.body;
      if (!extension || !Buffer.isBuffer(body) || body.length < 12)
        throw new AppError(
          400,
          "INVALID_IMAGE",
          "Choose a valid JPG, PNG or WebP photo",
        );
      if (!isValidImage(body, extension))
        throw new AppError(
          400,
          "INVALID_IMAGE",
          "The selected file is not a supported photo",
        );

      await mkdir(directory!, { recursive: true, mode: 0o750 });
      let used = 0;
      for (const name of await readdir(directory!)) {
        if (!filePattern.test(name)) continue;
        const path = join(directory!, name);
        const info = await stat(path).catch(() => null);
        if (!info) continue;
        if (info.mtimeMs < Date.now() - 86_400_000) {
          const image = await requireDatabase(client).productImage.findFirst({
            where: { url: `${baseUrl}/products/media/${name}` },
            select: { id: true },
          });
          if (!image) {
            await unlink(path).catch(() => undefined);
            continue;
          }
        }
        used += info.size;
      }
      if (used + body.length > MAX_STORAGE)
        throw new AppError(
          507,
          "MEDIA_FULL",
          "Product photo storage is full. Please contact support.",
        );

      const name = `${randomUUID()}.${extension}`;
      await writeFile(join(directory!, name), body, {
        flag: "wx",
        mode: 0o640,
      });
      return reply.code(201).send({
        data: { imageUrl: `${baseUrl}/products/media/${name}` },
      });
    },
  );

  app.get<{ Params: { name: string } }>(
    "/products/media/:name",
    async (request, reply) => {
      const name = request.params.name;
      if (!directory || !baseUrl || !filePattern.test(name))
        throw new AppError(404, "MEDIA_NOT_FOUND", "Photo not found");
      const path = join(directory, name);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile())
        throw new AppError(404, "MEDIA_NOT_FOUND", "Photo not found");
      const extension = name.split(".").at(-1);
      const mime = Object.entries(types).find(([, ext]) => ext === extension)?.[0];
      if (!mime) throw new AppError(404, "MEDIA_NOT_FOUND", "Photo not found");
      reply
        .type(mime)
        .header("Content-Length", info.size)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("X-Content-Type-Options", "nosniff");
      return reply.send(createReadStream(path));
    },
  );
}
