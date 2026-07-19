import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>().get("/api/", (c) =>
	c.json({ name: "Cloudflare" }),
);

export default app;
export type AppType = typeof app;
