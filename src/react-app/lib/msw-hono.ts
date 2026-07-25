/**
 * Hono RPC の型定義から MSW ハンドラを型安全に生成するヘルパー。
 *
 * - パス（'/api/example-todo' など）とメソッド（'$get' など）は AppType に
 *   実在するものだけが渡せる
 * - handler が受け取る input（param / query / json）と、返す status / output は
 *   route 定義の zod スキーマと c.json() から導出される
 */
import type { HonoBase } from 'hono/hono-base';
import { http, HttpResponse } from 'msw';
import type { DefaultBodyType, JsonBodyType, StrictRequest } from 'msw';
import type { AppType } from '@/worker';

type Endpoint = {
  status: number;
  input: object;
  output: JsonBodyType;
};

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type SchemaOf<T> = T extends HonoBase<any, infer S, any> ? UnionToIntersection<S> : never;

type AppSchema = SchemaOf<AppType>;

type RoutePath = keyof AppSchema;

type EndpointOf<
  Path extends RoutePath,
  Method extends keyof AppSchema[Path],
> = AppSchema[Path][Method] extends Endpoint ? AppSchema[Path][Method] : never;

/** union の endpoint を { status, output } の union に分配する（200 と 404 が混ざらないように） */
type HandlerResult<E> = E extends Endpoint ? { status: E['status']; output: E['output'] } : never;

const parseJsonBody = async (request: StrictRequest<DefaultBodyType>): Promise<unknown> => {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

const createInput = async (ctx: {
  request: StrictRequest<DefaultBodyType>;
  params: Record<string, string | readonly string[] | undefined>;
}) => {
  const url = new URL(ctx.request.url, 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    query,
    param: ctx.params,
    json: await parseJsonBody(ctx.request),
  };
};

const httpByMethod = {
  $get: http.get,
  $post: http.post,
  $put: http.put,
  $patch: http.patch,
  $delete: http.delete,
} as const;

type SupportedMethod = keyof typeof httpByMethod;

/**
 * パス・メソッドを先に確定させてから handler を受け取るカリー化 API。
 * 3引数の1回呼び出しにすると handler の戻り値が contextual typing されず
 * status がリテラル型を失うため、意図的に2段階にしている。
 *
 * ```ts
 * createHandler({ path: '/api/example-todo', method: '$post' })(({ input }) => ({
 *   status: 201,
 *   output: { id: 'todo-1', title: input.json.title },
 * }));
 * ```
 */
export const createHandler =
  <const Path extends RoutePath, const Method extends keyof AppSchema[Path] & SupportedMethod>({
    path,
    method,
  }: {
    path: Path;
    method: Method;
  }) =>
  (
    handler: (ctx: {
      input: EndpointOf<Path, Method>['input'];
      request: StrictRequest<DefaultBodyType>;
      cookies: Record<string, string>;
    }) =>
      | HandlerResult<EndpointOf<Path, Method>>
      | Promise<HandlerResult<EndpointOf<Path, Method>>>,
  ) => {
    return httpByMethod[method](path, async ({ request, params, cookies }) => {
      const input = await createInput({ request, params });
      const result = await handler({
        input,
        request,
        cookies,
      });
      return HttpResponse.json(result.output, { status: result.status });
    });
  };
