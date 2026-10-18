import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@eazicart/database";
import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { requireDatabase, userId } from "./shared.js";

const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const storyTypes: Record<string, string> = {
  ...imageTypes,
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const validName = /^[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|mov|webm)$/;
const validId = /^[a-zA-Z0-9_-]{8,80}$/;
const parserTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

// Only expired story rows own files eligible for this cleanup. Failed unlinks
// retain their row so a later pass can retry without losing track of the file.
export async function cleanupExpiredStories(
  db: PrismaClient,
  directory: string,
  now = new Date(),
) {
  const rows = await db.socialMedia.findMany({
    where: { kind: "STORY", expiresAt: { lte: now } },
    select: { id: true, storageName: true },
    take: 500,
  });
  for (const row of rows) {
    if (!validName.test(row.storageName)) continue;
    try {
      await unlink(join(directory, row.storageName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await db.socialMedia.deleteMany({
      where: { id: row.id, kind: "STORY", expiresAt: { lte: now } },
    });
  }
  return rows.length;
}

export function registerSocialMedia(
  app: FastifyInstance,
  config: AppConfig,
  client?: PrismaClient,
) {
  const directory = config.REEL_MEDIA_DIRECTORY
    ? join(config.REEL_MEDIA_DIRECTORY, "social")
    : undefined;
  const base = config.REEL_MEDIA_BASE_URL?.replace(/\/$/, "");
  if (directory && client && config.NODE_ENV !== "test") {
    let running: Promise<unknown> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      if (!running)
        running = cleanupExpiredStories(client, directory)
          .catch((error) =>
            app.log.error({ err: error }, "Story cleanup failed"),
          )
          .finally(() => {
            running = undefined;
          });
    };
    app.addHook("onReady", (done) => {
      cleanup();
      timer = setInterval(cleanup, 15 * 60 * 1000);
      timer.unref();
      done();
    });
    app.addHook("onClose", async () => {
      clearInterval(timer);
      await running;
    });
  }
  // Route body limits still enforce the smaller product/profile limits.
  // Shared image parsers must allow the Story route's 50 MB maximum.
  for (const type of parserTypes) {
    if (app.hasContentTypeParser(type)) app.removeContentTypeParser(type);
    app.addContentTypeParser(
      type,
      { parseAs: "buffer", bodyLimit: 50 * 1024 * 1024 },
      (_r, b, d) => d(null, b),
    );
  }

  const uploads = new Set<FastifyRequest>();
  const attempts = new Map<string, number[]>();
  const release = (request: FastifyRequest) => {
    uploads.delete(request);
  };
  app.post<{ Params: { kind: string } }>(
    "/social/media/:kind",
    {
      bodyLimit: 50 * 1024 * 1024,
      onRequest: async (r) => {
        await app.authenticate(r);
        const now = Date.now();
        for (const [id, times] of attempts)
          if (times.at(-1)! < now - 60000) attempts.delete(id);
        const uid = userId(r);
        const recent = (attempts.get(uid) ?? []).filter(
          (time) => time > now - 60000,
        );
        if (uploads.size >= 3 || recent.length >= 12)
          throw new AppError(
            429,
            "UPLOAD_BUSY",
            "Please wait a minute before uploading again",
          );
        attempts.set(uid, [...recent, now]);
        uploads.add(r);
      },
      onResponse: (r, _reply, done) => {
        release(r);
        done();
      },
      onRequestAbort: (r, done) => {
        release(r);
        done();
      },
      onError: (r, _reply, _error, done) => {
        release(r);
        done();
      },
      errorHandler: (error, _request, reply) => {
        if (error instanceof AppError)
          return void reply
            .code(error.statusCode)
            .send({ error: { code: error.code, message: error.message } });
        const status = (error as Error & { statusCode?: number }).statusCode;
        if (status === 413)
          return void reply.code(413).send({
            error: {
              code: "MEDIA_TOO_LARGE",
              message: "Choose a story smaller than 50 MB",
            },
          });
        if (status === 415)
          return void reply.code(415).send({
            error: {
              code: "INVALID_MEDIA",
              message: "Choose a supported photo or video",
            },
          });
        app.log.error(error);
        return void reply.code(500).send({
          error: {
            code: "UPLOAD_FAILED",
            message: "Unable to upload media. Please try again.",
          },
        });
      },
    },
    async (request, reply) => {
      if (!directory || !base)
        throw new AppError(
          503,
          "MEDIA_UNAVAILABLE",
          "Media uploads are temporarily unavailable",
        );
      const kind = request.params.kind;
      if (kind !== "profile" && kind !== "story" && kind !== "comment")
        throw new AppError(400, "MEDIA_KIND", "Invalid media type");
      const mime = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
      const allowed = kind === "profile" ? imageTypes : kind === "comment" ? imageTypes : storyTypes;
      const ext = allowed[mime];
      const body = request.body;
      const max = kind === "profile" ? 8 * 1024 * 1024 : kind === "comment" ? 12 * 1024 * 1024 : 50 * 1024 * 1024;
      if (!ext || !Buffer.isBuffer(body) || body.length < 12)
        throw new AppError(
          400,
          "INVALID_MEDIA",
          "Choose a supported photo or video",
        );
      if (body.length > max)
        throw new AppError(
          413,
          "MEDIA_TOO_LARGE",
          kind === "profile"
            ? "Choose a profile photo smaller than 8 MB"
            : kind === "comment" ? "Choose an image or GIF smaller than 12 MB" : "Choose a story smaller than 50 MB",
        );
      const valid =
        ext === "jpg"
          ? body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
          : ext === "png"
            ? body
                .subarray(0, 8)
                .equals(
                  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
                )
            : ext === "webp"
              ? body.toString("ascii", 0, 4) === "RIFF" &&
                body.toString("ascii", 8, 12) === "WEBP"
              : ext === "gif"
                ? body.toString("ascii", 0, 6) === "GIF87a" || body.toString("ascii", 0, 6) === "GIF89a"
              : ext === "webm"
                ? body
                    .subarray(0, 4)
                    .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
                : body.toString("ascii", 4, 8) === "ftyp";
      if (!valid)
        throw new AppError(
          400,
          "INVALID_MEDIA",
          "The selected file is not supported",
        );
      await mkdir(directory, { recursive: true, mode: 0o750 });
      const db = requireDatabase(client);
      const uid = userId(request);
      const name = `${randomUUID()}.${ext}`;
      const path = join(directory, name);
      await writeFile(path, body, { flag: "wx", mode: 0o640 });
      const data = {
        kind: kind === "profile" ? "PROFILE" : kind === "comment" ? "COMMENT" : "STORY",
        url: `${base}/social/media/file/${name}`,
        contentType: mime,
        storageName: name,
        expiresAt: kind === "story" ? new Date(Date.now() + 86400000) : null,
        userId: uid,
      };
      let result;
      try {
        result =
          kind === "profile"
            ? await db.$transaction(
                async (tx) => {
                  const old = await tx.socialMedia.findMany({
                    where: { userId: uid, kind: "PROFILE" },
                    select: { storageName: true },
                  });
                  await tx.socialMedia.deleteMany({
                    where: { userId: uid, kind: "PROFILE" },
                  });
                  const created = await tx.socialMedia.create({ data });
                  return { created, old };
                },
                { isolationLevel: "Serializable" },
              )
            : { created: await db.socialMedia.create({ data }), old: [] };
      } catch (error) {
        await unlink(path).catch(() => undefined);
        throw error;
      }
      // Existing profile files stay intact until the replacement DB transaction commits.
      const { created, old } = result;
      await Promise.all(
        old
          .filter((row) => validName.test(row.storageName))
          .map((row) =>
            unlink(join(directory, row.storageName)).catch(() => undefined),
          ),
      );
      return reply.code(201).send({
        data: {
          id: created.id,
          url: created.url,
          uploadedAt: created.createdAt.toISOString(),
          contentType: created.contentType,
        },
      });
    },
  );

  app.get<{ Params: { name: string } }>(
    "/social/media/file/:name",
    async (request, reply) => {
      if (!directory || !validName.test(request.params.name))
        throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found");
      const db = requireDatabase(client);
      const row = await db.socialMedia.findUnique({
        where: { storageName: request.params.name },
      });
      if (!row || (row.expiresAt && row.expiresAt <= new Date()))
        throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found");
      const path = join(directory, row.storageName);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile())
        throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found");
      reply
        .type(row.contentType)
        .header("Content-Length", info.size)
        .header(
          "Cache-Control",
          row.kind === "PROFILE"
            ? "public, max-age=3600"
            : "public, max-age=300",
        )
        .header("X-Content-Type-Options", "nosniff");
      reply.header("Accept-Ranges", "bytes");
      let start = 0,
        end = info.size - 1;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const invalid = () =>
          reply
            .code(416)
            .removeHeader("Content-Length")
            .header("Content-Range", `bytes */${info.size}`)
            .send();
        if (!match || (!match[1] && !match[2])) return invalid();
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
          return invalid();
        reply
          .code(206)
          .header("Content-Range", `bytes ${start}-${end}/${info.size}`);
      }
      reply.header("Content-Length", end - start + 1);
      return reply.send(createReadStream(path, { start, end }));
    },
  );

  app.get<{ Querystring: { userIds?: string } }>(
    "/social/profiles",
    async (request) => {
      const ids = Array.from(
        new Set(
          (request.query.userIds ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter((x) => validId.test(x)),
        ),
      ).slice(0, 50);
      if (!ids.length) return { data: {} };
      const rows = await requireDatabase(client).socialMedia.findMany({
        where: { userId: { in: ids }, kind: "PROFILE" },
        orderBy: { createdAt: "desc" },
      });
      const data: Record<string, unknown> = {};
      for (const row of rows) {
        if (data[row.userId]) continue;
        data[row.userId] = {
          url: row.url,
          uploadedAt: row.createdAt.toISOString(),
          contentType: row.contentType,
        };
      }
      return { data };
    },
  );

  app.get<{ Querystring: { userId?: string } }>(
    "/social/profile",
    async (request) => {
      const uid = request.query.userId?.trim() ?? "";
      if (!validId.test(uid))
        throw new AppError(400, "USER_ID", "Invalid user id");
      const row = await requireDatabase(client).socialMedia.findFirst({
        where: { userId: uid, kind: "PROFILE" },
        orderBy: { createdAt: "desc" },
      });
      return {
        data: row
          ? {
              url: row.url,
              uploadedAt: row.createdAt.toISOString(),
              contentType: row.contentType,
            }
          : null,
      };
    },
  );
  app.delete(
    "/social/profile",
    { onRequest: (r) => app.authenticate(r) },
    async (request, reply) => {
      if (!directory)
        throw new AppError(503, "MEDIA_UNAVAILABLE", "Media unavailable");
      const db = requireDatabase(client);
      const uid = userId(request);
      const rows = await db.socialMedia.findMany({
        where: { userId: uid, kind: "PROFILE" },
        select: { storageName: true },
      });
      await db.socialMedia.deleteMany({
        where: { userId: uid, kind: "PROFILE" },
      });
      await Promise.all(
        rows.map((x) =>
          unlink(join(directory, x.storageName)).catch(() => undefined),
        ),
      );
      return reply.code(204).send();
    },
  );
  app.get<{ Querystring: { userIds?: string } }>(
    "/social/stories",
    async (request) => {
      const ids = Array.from(
        new Set(
          (request.query.userIds ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter((x) => validId.test(x)),
        ),
      ).slice(0, 12);
      const now = new Date();
      const db = requireDatabase(client);
      const rows = await db.socialMedia.findMany({
        where: { userId: { in: ids }, kind: "STORY", expiresAt: { gt: now } },
        orderBy: { createdAt: "asc" },
      });
      const data: Record<string, unknown> = {};
      for (const r of rows)
        data[r.userId] = {
          id: r.id,
          url: r.url,
          uploadedAt: r.createdAt.toISOString(),
          contentType: r.contentType,
        };
      return { data };
    },
  );
  app.delete<{ Params: { storyId: string } }>(
    "/social/stories/:storyId",
    { onRequest: (r) => app.authenticate(r) },
    async (request, reply) => {
      if (!directory || !validId.test(request.params.storyId))
        throw new AppError(404, "STORY_NOT_FOUND", "Story not found");
      const db = requireDatabase(client);
      const story = await db.socialMedia.findFirst({
        where: { id: request.params.storyId, userId: userId(request), kind: "STORY" },
        select: { id: true, storageName: true },
      });
      if (!story) throw new AppError(404, "STORY_NOT_FOUND", "Story not found");
      await db.socialMedia.delete({ where: { id: story.id } });
      if (validName.test(story.storageName))
        await unlink(join(directory, story.storageName)).catch(() => undefined);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/social/stories/:userId",
    async (request) => {
      if (!validId.test(request.params.userId))
        throw new AppError(400, "USER_ID", "Invalid user id");
      const rows = await requireDatabase(client).socialMedia.findMany({
        where: {
          userId: request.params.userId,
          kind: "STORY",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "asc" },
      });
      return {
        data: rows.map((r) => ({
          id: r.id,
          url: r.url,
          uploadedAt: r.createdAt.toISOString(),
          contentType: r.contentType,
        })),
      };
    },
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]