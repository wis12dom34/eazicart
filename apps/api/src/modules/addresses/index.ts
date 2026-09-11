import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";
const body = z.object({
  label: z.string().trim().max(80).nullable().optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().min(2).max(100),
  isDefault: z.boolean().optional(),
});
export function registerAddresses(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app);
  app.get("/addresses", auth, async (r) => ({
    data: await db().address.findMany({
      where: { userId: userId(r) },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    }),
  }));
  app.post("/addresses", auth, async (r, reply) => {
    const input = body.parse(r.body),
      uid = userId(r);
    const data = await db().$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId: uid } });
      const makeDefault = input.isDefault === true || count === 0;
      if (makeDefault)
        await tx.address.updateMany({
          where: { userId: uid },
          data: { isDefault: false },
        });
      return tx.address.create({
        data: { ...input, isDefault: makeDefault, userId: uid },
      });
    });
    return reply.code(201).send({ data });
  });
  app.patch("/addresses/:id", auth, async (r) => {
    const { id } = z.object({ id: z.string() }).parse(r.params),
      input = body.partial().parse(r.body),
      uid = userId(r);
    const found = await db().address.findFirst({ where: { id, userId: uid } });
    if (!found)
      throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
    const data = await db().$transaction(async (tx) => {
      if (input.isDefault)
        await tx.address.updateMany({
          where: { userId: uid, id: { not: id } },
          data: { isDefault: false },
        });
      return tx.address.update({ where: { id }, data: input });
    });
    return { data };
  });
  app.delete("/addresses/:id", auth, async (r, reply) => {
    const { id } = z.object({ id: z.string() }).parse(r.params);
    const found = await db().address.findFirst({
      where: { id, userId: userId(r) },
    });
    if (!found)
      throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
    try {
      await db().address.delete({ where: { id } });
    } catch {
      throw new AppError(409, "ADDRESS_IN_USE", "Address is used by an order");
    }
    return reply.code(204).send();
  });
}
