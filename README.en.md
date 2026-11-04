# Pinterest Collection · DeepSeek Harness plugin

<p>
  <a href="packages/plugin/README.en.md">Plugin docs (English)</a> ·
  <a href="packages/plugin/README.md">中文</a> ·
  <a href="packages/website/README.md">Website docs</a>
</p>

> A DeepSeek Harness panel plugin that puts your Pinterest saves and personalized feed inside the harness, plus a zero-build marketing site.

## Monorepo layout

| Package | What it is | Docs |
|---|---|---|
| [`packages/plugin`](packages/plugin) | **The plugin**: local saves on the left, Pinterest browsing + logged-in feed on the right, account page, settings | [English](packages/plugin/README.en.md) · [中文](packages/plugin/README.md) · [contract](packages/plugin/CONTRACT.md) |
| [`packages/website`](packages/website) | **Website**: static, bilingual, responsive, SEO built in (OG / hreflang / JSON-LD / sitemap) | [website/README.md](packages/website/README.md) |

```
pinterest-collect/
├─ packages/
│  ├─ plugin/        # the installable DeepSeek Harness plugin
│  └─ website/       # static marketing site
├─ package.json      # workspace root (scripts only, not the plugin)
└─ pnpm-workspace.yaml
```

## Install the plugin

Point `plugin_manager` at **the plugin package** (note the `packages/plugin` suffix):

```text
plugin_manager {
  action: "install_bundle",
  target: "/absolute/path/to/pinterest-collect/packages/plugin"
}
```

Restart Harness once and refresh the page; a “Pinterest Collection” icon appears in the sidebar.

> Always install `packages/plugin`, not the repository root — the root is only a workspace aggregator and has no plugin entry.
> Full install, sign-in, usage and troubleshooting: [packages/plugin/README.en.md](packages/plugin/README.en.md).

## Website

```bash
python3 -m http.server 8080 --directory packages/website
```

Open http://localhost:8080 (English at `/en/`). Deployment and placeholder replacement: [packages/website/README.md](packages/website/README.md).

## Development

Node.js ≥ 22 required (pnpm is optional, used for workspace management).

```bash
pnpm install        # optional
pnpm build          # rebuild packages/plugin/client.js
pnpm test           # host routes + fetch client tests
pnpm test:login     # CDP login pipeline + two-phase login (headless)
pnpm check          # install / API / static compliance checks
pnpm serve:website  # local preview of the website
```

Or call the scripts directly:

```bash
node packages/plugin/build-client.mjs
node packages/plugin/tools/host-api-test.mjs
node packages/plugin/tools/verify/check.mjs
```

Conventions: plain JS client parts (no JSX), theme-token colors only, all user-facing strings flow through `pcT` with English dictionaries — see [packages/plugin/CONTRACT.md](packages/plugin/CONTRACT.md).

## Related app

[Post Saver](https://apps.apple.com/cn/app/post-saver-save-social-posts/id6816399878?ct=pinterest-collect-github) — save posts from 23 platforms on iPhone / iPad.

## License

Add a `LICENSE` file before publishing (MIT recommended). Until a license is chosen, all rights are reserved.

## Disclaimer

Unofficial third-party plugin, not affiliated with Pinterest. It reads data through Pinterest's web endpoints, which may be subject to their Terms of Service; use it for personal use and at your own risk.
