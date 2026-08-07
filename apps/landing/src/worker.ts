/**
 * 落地页 Worker：静态资源直出 + SPA 回退（与 share Worker 同一机制）。
 */
export default {
  async fetch(
    request: Request,
    env: { ASSETS: { fetch: (input: Request) => Promise<Response> } },
  ): Promise<Response> {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), request));
  },
};