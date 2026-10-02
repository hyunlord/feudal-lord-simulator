"""Command-line entrypoints for collection and image diagnostics."""

from pathlib import Path
from typing import Annotated

import typer

from .analyze import analyze
from .benchmark_io import benchmark_files
from .capture import collect
from .land_replay import land_replay
from .replay import replay
from .review import review_files

app = typer.Typer(no_args_is_help=True)


@app.command("capture")
def capture_command(  # noqa: PLR0913 -- CLI options for collection.
    repo: Path,
    report: Path,
    url: str = "http://127.0.0.1:4470/",
    terrains: str = "river,coast,chalk,forest,fen,city",
    *,
    seed: int = 1,
    resume: bool = False,
) -> None:
    """Capture thirty new-land and six large-city scenes with twenty frames each."""
    collect(repo.resolve(), report.resolve(), url, terrains.split(","), seed=seed, resume=resume)


@app.command("analyze")
def analyze_command(
    repo: Path,
    report: Path,
    config: Annotated[Path | None, typer.Option()] = None,
    name: str = "baseline",
) -> None:
    """Emit JSON candidates and red-box JPEGs from actual captures."""
    analyze(repo.resolve(), report.resolve(), config, name)


@app.command("replay")
def replay_command(  # noqa: PLR0913 -- archived camera coordinates are independent options.
    repo: Path,
    save: Path,
    report: Path,
    name: str,
    *,
    zoom: float = 1.0,
    tx: int = 46,
    ty: int = 42,
    pan_x: float | None = None,
    pan_y: float | None = None,
    confirm: bool = True,
) -> None:
    """Replay an ordinary archived save against the caller's server on port 4470."""
    if (pan_x is None) != (pan_y is None):
        message = "Supply both pan-x and pan-y"
        raise typer.BadParameter(message)
    pan = (pan_x, pan_y) if pan_x is not None and pan_y is not None else None
    replay(
        repo.resolve(),
        save.resolve(),
        report.resolve(),
        name,
        zoom,
        (tx, ty),
        confirm=confirm,
        pan=pan,
    )


@app.command("replay-land")
def land_command(report: Path) -> None:
    """Capture QA039/040 and a river control on the caller's current server."""
    land_replay(report.resolve())


@app.command("review")
def review_command(findings: Path, human_review: Path, output: Path) -> None:
    """Require complete TP/FP labels and emit precision JSON plus a six-detector table."""
    report = review_files(findings.resolve(), human_review.resolve(), output.resolve())
    typer.echo(
        f"Reviewed {report.total_reviewed} candidates; reports written to {output.resolve()}"
    )


@app.command("benchmark")
def benchmark_command(
    findings: Path, annotations: Path, output: Path, human_rejections: Path | None = None
) -> None:
    """Score frozen visible defect annotations, including missed targets."""
    benchmark_files(
        findings.resolve(),
        annotations.resolve(),
        output.resolve(),
        human_rejections=human_rejections.resolve() if human_rejections else None,
    )
    typer.echo(f"Benchmark written to {output.resolve()}")


if __name__ == "__main__":
    app()
