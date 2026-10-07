import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@eazicart/database";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import { requireDatabase, userId } from "../shared.js";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_STORAGE = 5 * 1024 * 1024 * 1024;
const types: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const filePattern = /^[0-9a-f-]{36}\.(mp4|webm|mov)$/;

export function registerReelMedia(
  app: FastifyInstance,
  config: AppConfig,
  client?: PrismaClient,
) {
  const directory = config.REEL_MEDIA_DIRECTORY;
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
    "/seller/reels/media",
    {
      bodyLimit: MAX_BYTES,
      onRequest: async (request) => {
        await app.authenticate(request);
        if (!directory || !baseUrl)
          throw new AppError(
            503,
            "MEDIA_UNAVAILABLE",
            "Video uploads are temporarily unavailable",
          );
        const seller = await requireDatabase(client).sellerProfile.findUnique({
          where: { userId: userId(request) },
          select: { id: true },
        });
        if (!seller)
          throw new AppError(
            403,
            "SELLER_REQUIRED",
            "Create a seller profile before uploading reels",
          );
        const now = Date.now();
        for (const [id, entries] of attempts)
          if (entries.at(-1)! < now - 60_000) attempts.delete(id);
        const recent = (attempts.get(seller.id) ?? []).filter(
          (time) => time > now - 60_000,
        );
        if (recent.length >= 5 || active >= 2)
          throw new AppError(
            429,
            "UPLOAD_BUSY",
            "Please wait a minute before uploading again",
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
              code: "VIDEO_TOO_LARGE",
              message: "Choose a video smaller than 50 MB",
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
              code: "VIDEO_TYPE",
              message: "Choose an MP4, MOV or WebM video",
            },
          });
          return;
        }
        app.log.error(error);
        reply.code(500).send({
          error: {
            code: "UPLOAD_FAILED",
            message: "Unable to upload this video. Please try again.",
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
          "INVALID_VIDEO",
          "Choose a valid MP4, MOV or WebM video",
        );
      const valid =
        extension === "webm"
          ? body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : body.toString("ascii", 4, 8) === "ftyp";
      if (!valid)
        throw new AppError(
          400,
          "INVALID_VIDEO",
          "The selected file is not a supported video",
        );
      await mkdir(directory!, { recursive: true, mode: 0o750 });
      let used = 0;
      for (const name of await readdir(directory!)) {
        if (!filePattern.test(name)) continue;
        const info = await stat(join(directory!, name)).catch(() => null);
        if (!info) continue;
        if (info.mtimeMs < Date.now() - 86_400_000) {
          const reel = await requireDatabase(client).reel.findFirst({
            where: { videoUrl: `${baseUrl}/reels/media/${name}` },
            select: { id: true },
          });
          if (!reel) {
            await unlink(join(directory!, name)).catch(() => undefined);
            continue;
          }
        }
        used += info.size;
      }
      if (used + body.length > MAX_STORAGE)
        throw new AppError(
          507,
          "MEDIA_FULL",
          "Video storage is full. Please contact support.",
        );
      const name = `${randomUUID()}.${extension}`;
      await writeFile(join(directory!, name), body, {
        flag: "wx",
        mode: 0o640,
      });
      return reply
        .code(201)
        .send({ data: { videoUrl: `${baseUrl}/reels/media/${name}` } });
    },
  );
  app.get<{ Params: { name: string } }>(
    "/reels/media/:name",
    async (request, reply) => {
      const name = request.params.name;
      if (!directory || !baseUrl || !filePattern.test(name))
        throw new AppError(404, "MEDIA_NOT_FOUND", "Video not found");
      const reel = await requireDatabase(client).reel.findFirst({
        where: {
          videoUrl: `${baseUrl}/reels/media/${name}`,
          status: "PUBLISHED",
        },
        select: { id: true },
      });
      if (!reel) throw new AppError(404, "MEDIA_NOT_FOUND", "Video not found");
      const path = join(directory, name);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile())
        throw new AppError(404, "MEDIA_NOT_FOUND", "Video not found");
      const extension = name.split(".").at(-1);
      reply.type(
        Object.entries(types).find(([, ext]) => ext === extension)![0],
      );
      reply
        .header("Accept-Ranges", "bytes")
        .header("X-Content-Type-Options", "nosniff");
      let start = 0,
        end = info.size - 1;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!match || (!match[1] && !match[2]))
          return reply
            .code(416)
            .header("Content-Range", `bytes */${info.size}`)
            .send();
        start = match[1]
          ? Number(match[1])
          : Math.max(0, info.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= info.size
        )
          return reply
            .code(416)
            .header("Content-Range", `bytes */${info.size}`)
            .send();
        reply
          .code(206)
          .header("Content-Range", `bytes ${start}-${end}/${info.size}`);
      }
      reply.header("Content-Length", end - start + 1);
      return reply.send(createReadStream(path, { start, end }));
    },
  );
}
