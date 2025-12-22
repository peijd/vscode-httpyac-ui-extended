<p align="center">
  <img src="./icon.png" alt="httpYac UI Extended" width="128" />
</p>

# httpYac UI Extended

An extended VS Code extension based on [httpyac](https://github.com/AnWeber/httpyac), adding a more friendly visual Request Builder while preserving the full `.http/.rest` workflow.

## Use Cases

- Debug HTTP/GraphQL/gRPC/WebSocket requests directly in VS Code
- Prefer both a visual builder and plain-text `.http` files
- Need environments, history, collections, and code generation

## Highlights

- **Request Builder sidebar** for visual editing, sending, and saving
- **Request Editor panel** for focused request editing
- **Rich protocol support**: HTTP/REST, GraphQL, gRPC, WebSocket, SSE, MQTT, AMQP
- **History & Collections** in the sidebar
- **Round-trip with `.http` files**: save/append/open & locate
- **Code generation** for multiple languages
- **Environments & variables** management

## UI Preview

![Request Builder](examples/preview.gif)

## Quick Start

1. Install `httpYac UI Extended` from the VS Code Marketplace.
2. Open the Activity Bar view `httpyac` → `Request Builder` and create a request.
3. Or create a `.http/.rest` file and send via CodeLens or command palette.

Example request:

```http
@user = doe
@password = 12345678

GET https://httpbin.org/basic-auth/{{user}}/{{password}}
Authorization: Basic {{user}}{{password}}
```

## Entry Points

- **Request Builder**: Activity Bar `httpyac` view → `Request Builder`
- **Request Editor**: Command Palette `httpyac.openRequestEditor`
- **Send request**: Command Palette `httpyac.send` or CodeLens

## Common Commands

| Command | Description |
| --- | --- |
| `httpyac.send` | Send request at cursor |
| `httpyac.sendAll` | Send all requests in file |
| `httpyac.sendSelected` | Send selected requests |
| `httpyac.resend` | Resend last request |
| `httpyac.show` | Show cached response |
| `httpyac.viewHeader` | Show headers and timings |
| `httpyac.save` | Save response to file |
| `httpyac.generateCode` | Generate request code |
| `httpyac.toggle-env` | Toggle environment |
| `httpyac.showHistory` | Open history view |
| `httpyac.clearHistory` | Clear history |
| `httpyac.openRequestEditor` | Open request editor |

> Search `httpyac` in the command palette for the full list.

## Keybindings

Active only in `http` / `rest` files:

| Command | Windows/Linux | macOS |
| --- | --- | --- |
| `httpyac.send` | `Ctrl+Alt+R` | `Cmd+Alt+R` |
| `httpyac.resend` | `Ctrl+Alt+L` | `Cmd+Alt+L` |
| `httpyac.toggle-env` | `Ctrl+Alt+E` | `Cmd+Alt+E` |
| `httpyac.generateCode` | `Ctrl+Alt+G` | `Cmd+Alt+G` |

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `httpyac.requestDefaultHeaders` | Default request headers | `{ "User-Agent": "httpyac" }` |
| `httpyac.cookieJarEnabled` | Enable CookieJar | `true` |
| `httpyac.envDirName` | Environment folder name | `"env"` |
| `httpyac.responseViewMode` | Response view mode | `preview` |
| `httpyac.logLevel` | Output log level | `warn` |
| `httpyac.maxHistoryItems` | Max history entries | `50` |

> Search `httpyac` in VS Code Settings for the full list.

## Compatibility & Notes

- Requires VS Code `1.91.0+`.
- JavaScript execution is disabled in untrusted workspaces (Workspace Trust).
- Response history and cache are stored under `.httpyac` in the workspace.

## Relationship to Upstream

This project is a UI-extended fork of the upstream `httpyac` extension. Thanks to the upstream maintainers and contributors.

## License

[MIT License](LICENSE)

## Changelog

See [CHANGELOG](CHANGELOG.md).
