import { z } from "zod";

export function zodToFastifySchema(schema: z.ZodSchema) {
  return {
    parse: (data: unknown) => {
      const res = schema.safeParse(data);
      if (!res.success) {
        const err: any = new Error(res.error.message);
        err.statusCode = 400;
        throw err;
      }
      return res.data;
    },
  };
}
