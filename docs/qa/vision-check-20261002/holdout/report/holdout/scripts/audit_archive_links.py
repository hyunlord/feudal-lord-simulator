#!/usr/bin/env python3
"""Audit Markdown artifact references inside a ZIP; never extract its contents."""

from __future__ import annotations

import argparse
import fnmatch
import json
import posixpath
import re
import sys
import zipfile
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, TypeGuard
from urllib.parse import unquote, urlparse

LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
CODE = re.compile(r"`([^`\n]+)`")
FILE = re.compile(
    r"(?<![\w.-])(?:/?[A-Za-z0-9_.,~*?{}-]+/)*[A-Za-z0-9_.~*?{}-]+"
    + r"\.(?:json(?:\.gz)?|jpe?g|png|gif|webp|md|csv|tsv|txt|py|m?js|ts|tsx|"
    + r"toml|yaml|yml|zip|sha256|lock|gz)(?::[A-Za-z0-9_:-]+)?"
)
COMMAND = re.compile(r"^(?:uv|python\d?|npm|node|git|shasum|sha256sum|unzip|cd|npx|curl)\s")


@dataclass(frozen=True, slots=True)
class Reference:
    document: str
    line: int
    raw: str
    kind: str


@dataclass(frozen=True, slots=True)
class Rule:
    pattern: str
    reason: str
    document: str = "*"


@dataclass(frozen=True, slots=True)
class Result:
    document: str
    line: int
    reference: str
    kind: str
    status: str
    resolved: str
    reason: str


# Exact semantic classes deliberately absent from the lightweight deliverable.
# Artifact names (especially contact JPEGs) never receive a default exemption.
DEFAULT_RULES = (
    Rule("/assets/*", "Runtime game asset URL; game art is not bundled in the tool ZIP"),
    Rule(
        "/public/assets/*",
        "Repository runtime game art; excluded from lightweight tool ZIP",
    ),
    Rule(
        "public/assets/*",
        "Repository runtime game art; excluded from lightweight tool ZIP",
    ),
    Rule(
        "*/expansion/raw/*/*.png",
        "Original expansion PNG sequence remains local; SOURCE_SHA256 and JPEG review evidence are bundled",
    ),
    Rule(
        "expansion/raw/*/*.png",
        "Original expansion PNG sequence remains local; SOURCE_SHA256 and JPEG review evidence are bundled",
    ),
    Rule(
        "raw/*/*.png",
        "Original frame PNGs remain local; compressed metadata and review JPEGs are bundled",
    ),
)


def references(document: str, content: str) -> list[Reference]:
    """Collect links, explicit code file tokens, and plain artifact filenames."""
    output: list[Reference] = []
    seen: set[tuple[int, str]] = set()
    for line_number, line in enumerate(content.splitlines(), 1):
        spans: list[tuple[int, int]] = []
        for match in LINK.finditer(line):
            raw = match[1].strip().split(' "', 1)[0].strip("<>")
            output.append(Reference(document, line_number, raw, "markdown_link"))
            seen.add((line_number, raw))
            spans.append(match.span())
        for match in CODE.finditer(line):
            command = bool(COMMAND.match(match[1]))
            for token in FILE.finditer(match[1]):
                raw = token[0]
                if (line_number, raw) not in seen:
                    output.append(
                        Reference(
                            document,
                            line_number,
                            raw,
                            "command_file" if command else "code_file",
                        )
                    )
                    seen.add((line_number, raw))
            spans.append(match.span())
        for match in FILE.finditer(line):
            if any(start <= match.start() < end for start, end in spans):
                continue
            raw = match[0]
            if (line_number, raw) not in seen:
                output.append(Reference(document, line_number, raw, "plain_file"))
                seen.add((line_number, raw))
    return output


def classify(reference: Reference, members: set[str], rules: tuple[Rule, ...]) -> Result:
    """Strict links; prose may identify unique basenames or complete file ranges."""
    raw = reference.raw
    parsed = urlparse(raw)
    status, resolved, reason = "missing", "", "No archive member resolves this reference"
    if parsed.scheme in {"http", "https", "mailto", "app"}:
        status, reason = "external", "External URL, not an archive artifact"
    elif raw.startswith("#"):
        status, resolved, reason = "internal_anchor", reference.document, "In-document anchor"
    else:
        path = unquote(raw.split("#", 1)[0]).rstrip(":")
        if reference.kind == "markdown_link":
            path = unquote(parsed.path)
            relative = (
                path.lstrip("/")
                if path.startswith("/")
                else posixpath.normpath(posixpath.join(posixpath.dirname(reference.document), path))
            )
            if relative in members:
                status, resolved, reason = "included", relative, "Actual Markdown target exists"
            else:
                reason = "Broken Markdown target: " + relative + "; basename and gzip fallback forbidden"
            return Result(reference.document, reference.line, raw, reference.kind, status, resolved, reason)
        path = re.sub(r":(?:\d+(?:-\d+)?|[A-Za-z_]\w*)$", "", path)
        interval = re.search(r"(\d+)(?:\.\.|~)(\d+)", path)
        if interval:
            expanded = [
                path[: interval.start()] + str(number) + path[interval.end() :] for number in range(int(interval[1]), int(interval[2]) + 1)
            ]
            results = [classify(Reference(reference.document, reference.line, item, reference.kind), members, ()) for item in expanded]
            missing = [item.reference for item in results if item.status not in {"included", "included_compressed"}]
            if expanded and not missing:
                status, resolved, reason = (
                    "included_group",
                    "; ".join(item.resolved for item in results),
                    "Every numeric range member exists",
                )
            else:
                reason = "Incomplete numeric range: " + ", ".join(missing or [path])
            return Result(reference.document, reference.line, raw, reference.kind, status, resolved, reason)
        relative = posixpath.normpath(posixpath.join(posixpath.dirname(reference.document), path))
        candidates = [relative, path.lstrip("/")]
        for prefix in ("report/", "tools/vision-check/", "tools/vision-check/vision_check/"):
            candidates.append(posixpath.normpath(prefix + path.lstrip("/")))
        if any(character in path for character in "*?"):
            grouped = sorted(
                member
                for member in members
                if any(fnmatch.fnmatchcase(member, pattern) for pattern in candidates)
                or ("/" not in path and fnmatch.fnmatchcase(posixpath.basename(member), path))
            )
            if grouped:
                return Result(
                    reference.document,
                    reference.line,
                    raw,
                    reference.kind,
                    "included_group",
                    "; ".join(grouped),
                    "Wildcard has matching archive members; numeric ranges use all-member validation",
                )
        matches = sorted({candidate for candidate in candidates if candidate in members})
        if not matches and "/" not in path:
            matches = sorted(member for member in members if posixpath.basename(member) == path)
        if len(matches) == 1:
            status, resolved, reason = "included", matches[0], "Exact archive member"
        elif relative in matches:
            status, resolved, reason = "included", relative, "Document-relative member wins"
        elif matches:
            status, reason = "ambiguous", "Multiple archive members: " + ", ".join(matches)
        else:
            compressed = [candidate + ".gz" for candidate in candidates if candidate + ".gz" in members]
            if compressed:
                status, resolved, reason = (
                    "included_compressed",
                    compressed[0],
                    "Prose JSON reference represented by lossless gzip; this cannot repair a Markdown link",
                )
            else:
                for rule in rules:
                    if fnmatch.fnmatchcase(path, rule.pattern) and fnmatch.fnmatchcase(reference.document, rule.document):
                        status, reason = "source_only", rule.reason
                        break
    return Result(reference.document, reference.line, raw, reference.kind, status, resolved, reason)


def json_list(value: object) -> TypeGuard[list[object]]:
    """Narrow a JSON array after stdlib decoding."""
    return isinstance(value, list)


def json_mapping(value: object) -> TypeGuard[dict[str, object]]:
    """JSON object keys are strings by the JSON decoder contract."""
    return isinstance(value, dict)


def decode_value(decoder: Callable[[str], object], text: str) -> object:
    """Consume the stdlib decoder through its object-valued JSON boundary."""
    return decoder(text)


class Arguments(argparse.Namespace):
    """Typed CLI boundary populated by argparse."""

    archive: Path = Path()
    output: Path = Path()
    allowlist: Path | None = None


def main() -> int:
    """Write all references and fail if missing or ambiguous artifacts remain."""
    parser = argparse.ArgumentParser(description=__doc__)
    _ = parser.add_argument("archive", type=Path)
    _ = parser.add_argument("output", type=Path)
    _ = parser.add_argument(
        "--allowlist",
        type=Path,
        help="JSON list of {pattern, reason}; explicit reviewed source-only omissions",
    )
    args = Arguments()
    _ = parser.parse_args(namespace=args)
    rules = list(DEFAULT_RULES)
    if args.allowlist:
        decode: Callable[[str], object] = json.JSONDecoder().decode
        entries = decode_value(decode, args.allowlist.read_text())
        if not json_list(entries):
            parser.error("allowlist must be a JSON list")
        for entry in entries:
            if (
                not json_mapping(entry)
                or not {"pattern", "reason"}.issubset(entry)
                or not set(entry).issubset({"pattern", "reason", "document"})
            ):
                parser.error("each allowlist entry needs pattern and reason, with optional document")
            if not isinstance(entry["pattern"], str) or not isinstance(entry["reason"], str) or not entry["reason"].strip():
                parser.error("allowlist pattern and nonempty reason must be strings")
            if entry["pattern"] in {"*", "**", "*.jpg", "*.png", "*.json"}:
                parser.error("blanket artifact exclusions are forbidden")
            document = entry.get("document", "*")
            if not isinstance(document, str):
                parser.error("document pattern must be a string")
            rules.append(Rule(entry["pattern"], entry["reason"], document))
    with zipfile.ZipFile(args.archive) as archive:
        members = set(archive.namelist())
        documents = sorted(name for name in members if name.lower().endswith(".md"))
        refs = [reference for name in documents for reference in references(name, archive.read(name).decode("utf-8"))]
        results = [classify(reference, members, tuple(rules)) for reference in refs]
    counts = Counter(result.status for result in results)
    payload = {
        "archive": str(args.archive),
        "markdown_documents": len(documents),
        "counts": dict(counts),
        "passed": counts["missing"] == 0 and counts["ambiguous"] == 0,
        "rules": [asdict(rule) for rule in rules],
        "references": [asdict(result) for result in results],
    }
    _ = args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"counts": dict(counts), "passed": payload["passed"]}))
    return 0 if payload["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
