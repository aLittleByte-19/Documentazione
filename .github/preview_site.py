#!/usr/bin/env python3
"""Build and serve the generated documentation site locally."""

from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = REPO_ROOT / "_site"
BUILD_SCRIPT = REPO_ROOT / ".github" / "site-src" / "update_index.py"


class PreviewHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def build_site() -> None:
    if not BUILD_SCRIPT.exists():
        raise FileNotFoundError(f"Build script not found: {BUILD_SCRIPT}")

    subprocess.run(
        [sys.executable, str(BUILD_SCRIPT)],
        cwd=REPO_ROOT,
        check=True,
    )


def serve(host: str, port: int) -> None:
    if not BUILD_DIR.exists():
        raise FileNotFoundError(f"Build directory not found: {BUILD_DIR}")

    handler = functools.partial(PreviewHandler, directory=str(BUILD_DIR))
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer((host, port), handler) as httpd:
        print(f"Serving documentation site at http://{host}:{port}/")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and serve the generated documentation site locally.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind.")
    parser.add_argument(
        "--no-build",
        action="store_true",
        help="Serve the existing _site directory without rebuilding it first.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        if not args.no_build:
            build_site()
        serve(args.host, args.port)
    except KeyboardInterrupt:
        print("\nServer stopped.")
        return 0
    except OSError as error:
        print(f"Unable to start preview server: {error}", file=sys.stderr)
        return 1
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        print(f"Unable to build preview site: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
