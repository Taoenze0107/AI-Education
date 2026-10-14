"""Vendor the pinned official npm release; verify publisher-documented hashes."""
from pathlib import Path
import base64
import hashlib
import io
import ssl
import tarfile
import urllib.request

VERSION = "0.19.0"
ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "app/static/vendor/katex"
EXPECTED = {
    "katex.min.js": "QFFtAGzvvj+bfgCGxXJlNZZR1nXEZgvG8tDLCCY1F19xl20WlfTYgguB4VcNdxYk",
    "katex.min.css": "3rdsX6e5mueWyoweR9NIVmtEsUkokpBT/0ALqKKIBMr9j4qhHkaIkAcGgsE6uVlp",
}


def vendor():
    import certifi
    context = ssl.create_default_context(cafile=certifi.where())
    data = urllib.request.urlopen(f"https://registry.npmjs.org/katex/-/katex-{VERSION}.tgz", timeout=30, context=context).read()
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            prefix = "package/dist/"
            name = member.name
            if not member.isfile():
                continue
            if name == "package/LICENSE":
                files["LICENSE"] = archive.extractfile(member).read()
            elif name.startswith(prefix):
                relative = name[len(prefix):]
                if relative in EXPECTED or relative.startswith("fonts/") and ".." not in Path(relative).parts:
                    files[relative] = archive.extractfile(member).read()
    for name, expected in EXPECTED.items():
        actual = base64.b64encode(hashlib.sha384(files[name]).digest()).decode()
        if actual != expected:
            raise ValueError(f"Official release integrity check failed: {name}")
    assert files.get("LICENSE") and sum(n.endswith(".woff2") for n in files) >= 20
    for name, content in files.items():
        path = TARGET / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    (TARGET / "SOURCE.md").write_text(f"KaTeX {VERSION}, official npm release.\nhttps://katex.org/docs/browser\nMIT license included.\nAll rendering assets and fonts served locally, no CDN required.\n")
    print(f"Verified KaTeX {VERSION}: {len(files)} local assets")


if __name__ == "__main__":
    vendor()
