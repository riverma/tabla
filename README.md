<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# Virtual Tabla

**An in-browser tabla you can play with your keyboard.**

[Open it live](https://tabla.riverma.com) · [Report a bug](https://github.com/riverma/tabla/issues/new?template=bug_report.md) · [Request a feature](https://github.com/riverma/tabla/issues/new?template=feature_request.md)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable%20%C2%B7%20offline-5a5.svg)](https://tabla.riverma.com)

</div>

## Privacy

**No data collected · no tracking · runs entirely on your device — 100% private.** There is no analytics and no tracking.

## About

- **Installable PWA** — add it to your home screen and use it fully offline.

## Quick start

It's a static site — no build step.

```sh
git clone https://github.com/riverma/tabla.git
cd tabla
python3 -m http.server 8000   # then open http://localhost:8000
```

Serve over HTTP (not `file://`).

## Contributing

Issues and pull requests welcome — see the templates under [`.github/`](./.github). Please keep the app dependency-free (no third-party CDNs).

## Versioning & changelog

Uses [Semantic Versioning](https://semver.org). See [CHANGELOG.md](./CHANGELOG.md).

## License

[GNU Affero General Public License v3.0](./LICENSE) © Rishi Verma. Bundled third-party assets retain their own licenses.
