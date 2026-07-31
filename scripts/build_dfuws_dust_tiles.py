#!/usr/bin/env python3
"""Build static image tiles for the DFUWS Dragonfly/Planck dust viewer."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import numpy as np
    from astropy.io import fits
    from astropy.wcs import WCS
    from astropy.wcs.utils import proj_plane_pixel_scales
    from matplotlib import colormaps
    from PIL import Image
except ModuleNotFoundError as exc:
    missing = exc.name or "a required package"
    print(
        f"Missing Python dependency: {missing}\n"
        "Install the viewer preprocessing dependencies, for example:\n"
        "  python -m pip install -r scripts/requirements-dfuws-viewer.txt",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


LAYERS = {
    "dragonfly_g": "mosaic_g_kJy_sr.fits",
    "dragonfly_r": "mosaic_r_kJy_sr.fits",
    "planck": "planck_radiance.fits",
    "planck_ebv": "planck_ebv.fits.fz",
    "planck_temperature": "planck_temperature.fits.fz",
    "planck_tau353": "planck_tau353.fits.fz",
}

LAYER_LABELS = {
    "dragonfly_g": "Dragonfly g",
    "dragonfly_r": "Dragonfly r",
    "planck": "Planck radiance",
    "planck_ebv": "Planck E(B-V)",
    "planck_temperature": "Planck T",
	"planck_tau353": "Planck τ₃₅₃",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate static preview images and tile pyramids for DFUWS dust maps."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("/Users/qliu/dragonfly/cirrus/outputs/mosaics/dfuws"),
        help="Directory containing planck_radiance.fits and Dragonfly mosaics.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("assets/dfuws_dust_viewer"),
        help="Output directory for metadata, previews, and tile pyramids.",
    )
    parser.add_argument("--max-zoom", type=int, default=5, help="Full-resolution tile zoom level.")
    parser.add_argument("--tile-size", type=int, default=512, help="Tile size in pixels.")
    parser.add_argument(
        "--format",
        choices=("png", "webp"),
        default="webp",
        help="Tile image format.",
    )
    parser.add_argument(
        "--webp-quality",
        type=int,
        default=92,
        help="WebP quality, used only with --format webp.",
    )
    parser.add_argument(
        "--preview-max-side",
        type=int,
        default=1600,
        help="Maximum preview image side length in pixels. Use 0 to keep full resolution.",
    )
    parser.add_argument(
        "--cuts",
        type=float,
        nargs=2,
        default=(1.0, 99.0),
        metavar=("LOW_Q", "HIGH_Q"),
        help="Percentile display cuts for finite pixels.",
    )
    parser.add_argument("--dragonfly-g-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--dragonfly-r-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--planck-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--planck-ebv-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--planck-temperature-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--planck-tau353-range", type=float, nargs=2, metavar=("VMIN", "VMAX"))
    parser.add_argument("--colormap", default="inferno", help="Default Matplotlib colormap for generated map images.")
    parser.add_argument(
        "--colormaps",
        nargs="+",
        default=None,
        help="Colormaps to generate as full preview images. Defaults to --colormap only.",
    )
    parser.add_argument(
        "--preview-only",
        action="store_true",
        help="Write previews and metadata only; skip full tile pyramid generation.",
    )
    parser.add_argument(
        "--update-previews-only",
        action="store_true",
        help="Refresh previews and metadata in an existing output directory without touching tiles.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing output directory.",
    )
    return parser.parse_args()


def read_fits(path: Path) -> tuple[np.ndarray, fits.Header, WCS]:
    with fits.open(path, memmap=True) as hdul:
        hdu = next((item for item in hdul if item.data is not None), None)
        if hdu is None:
            raise ValueError(f"No image data found in {path}")
        data = np.asarray(hdu.data, dtype=np.float32)
        header = hdu.header.copy()

    while data.ndim > 2:
        data = data[0]
    if data.ndim != 2:
        raise ValueError(f"Expected a 2D image in {path}, found shape {data.shape}")

    return data, header, WCS(header).celestial


def read_fits_metadata(path: Path) -> tuple[fits.Header, WCS, tuple[int, int]]:
    with fits.open(path, memmap=True) as hdul:
        hdu = next((item for item in hdul if item.data is not None), None)
        if hdu is None:
            raise ValueError(f"No image data found in {path}")
        header = hdu.header.copy()
        shape = tuple(int(value) for value in hdu.data.shape[-2:])
    return header, WCS(header).celestial, shape


def unit_from_header(header: fits.Header, fallback: str) -> str:
    for key in ("BUNIT", "UNIT", "UNITS"):
        value = header.get(key)
        if value:
            return str(value).strip()
    return fallback


def wcs_close(left: WCS, right: WCS, shape_left: tuple[int, int], shape_right: tuple[int, int]) -> bool:
    if shape_left != shape_right:
        return False
    keys = ("CRPIX1", "CRPIX2", "CRVAL1", "CRVAL2", "CTYPE1", "CTYPE2", "CUNIT1", "CUNIT2")
    left_header = left.to_header()
    right_header = right.to_header()
    for key in keys:
        if str(left_header.get(key, "")) != str(right_header.get(key, "")):
            return False
    for key in ("CD1_1", "CD1_2", "CD2_1", "CD2_2", "PC1_1", "PC1_2", "PC2_1", "PC2_2", "CDELT1", "CDELT2"):
        lv = left_header.get(key)
        rv = right_header.get(key)
        if lv is None and rv is None:
            continue
        if lv is None or rv is None or not np.isclose(float(lv), float(rv), rtol=0, atol=1e-10):
            return False
    return True


def maybe_reproject_planck(
    planck: np.ndarray,
    planck_wcs: WCS,
    target_wcs: WCS,
    target_shape: tuple[int, int],
) -> tuple[np.ndarray, bool]:
    if wcs_close(target_wcs, planck_wcs, target_shape, planck.shape):
        return planck, False

    try:
        from reproject import reproject_interp
    except ImportError as exc:
        raise RuntimeError(
            "Planck WCS/grid differs from Dragonfly, but the reproject package is not installed. "
            "Install reproject or provide already aligned FITS files."
        ) from exc

    aligned, _ = reproject_interp((planck, planck_wcs), target_wcs, shape_out=target_shape)
    return np.asarray(aligned, dtype=np.float32), True


def finite_cuts(data: np.ndarray, cuts: tuple[float, float]) -> dict[str, float | int]:
    finite = np.isfinite(data)
    count = int(finite.sum())
    if count == 0:
        raise ValueError("Layer has no finite pixels.")
    lo, hi = np.nanpercentile(data[finite], cuts)
    if not np.isfinite(lo) or not np.isfinite(hi) or lo == hi:
        lo = float(np.nanmin(data[finite]))
        hi = float(np.nanmax(data[finite]))
    if lo == hi:
        hi = lo + 1.0
    return {
        "low_quantile": float(cuts[0]),
        "high_quantile": float(cuts[1]),
        "low_value": float(lo),
        "high_value": float(hi),
        "finite_pixels": count,
    }


def fixed_cuts(data: np.ndarray, values: tuple[float, float]) -> dict[str, float | int | str]:
    finite = np.isfinite(data)
    lo, hi = float(values[0]), float(values[1])
    if not np.isfinite(lo) or not np.isfinite(hi) or lo == hi:
        raise ValueError(f"Invalid fixed display range: {values}")
    return {
        "mode": "fixed",
        "low_value": lo,
        "high_value": hi,
        "finite_pixels": int(finite.sum()),
    }


def wcs_metadata(wcs: WCS) -> dict[str, float | str | None]:
    header = wcs.to_header()
    return {
        "ctype1": str(header.get("CTYPE1", "")),
        "ctype2": str(header.get("CTYPE2", "")),
        "crpix1": float(header.get("CRPIX1")),
        "crpix2": float(header.get("CRPIX2")),
        "crval1": float(header.get("CRVAL1")),
        "crval2": float(header.get("CRVAL2")),
        "cdelt1": float(header.get("CDELT1")),
        "cdelt2": float(header.get("CDELT2")),
        "radesys": str(header.get("RADESYS", "")),
    }


def layer_display_range(args: argparse.Namespace, layer_name: str) -> tuple[float, float] | None:
    if layer_name == "dragonfly_g":
        return tuple(args.dragonfly_g_range) if args.dragonfly_g_range else None
    if layer_name == "dragonfly_r":
        return tuple(args.dragonfly_r_range) if args.dragonfly_r_range else None
    if layer_name == "planck":
        return tuple(args.planck_range) if args.planck_range else None
    if layer_name == "planck_ebv":
        return tuple(args.planck_ebv_range) if args.planck_ebv_range else None
    if layer_name == "planck_temperature":
        return tuple(args.planck_temperature_range) if args.planck_temperature_range else None
    if layer_name == "planck_tau353":
        return tuple(args.planck_tau353_range) if args.planck_tau353_range else None
    return None


def display_unit(layer_name: str, header: fits.Header) -> str:
    if layer_name.startswith("dragonfly"):
        return "kJy/sr"
    if layer_name == "planck":
        return "W/m^2/sr"
    if layer_name == "planck_tau353":
        return ""
    return unit_from_header(header, "")


def normalize_rgba(
    data: np.ndarray,
    cuts: dict[str, float | int],
    origin: str = "lower",
    colormap: str = "inferno",
) -> Image.Image:
    if origin == "lower":
        data = np.flipud(data)
    lo = float(cuts["low_value"])
    hi = float(cuts["high_value"])
    finite = np.isfinite(data)
    scaled = np.zeros(data.shape, dtype=np.float32)
    scaled[finite] = np.clip((data[finite] - lo) / (hi - lo), 0.0, 1.0)
    cmap = colormaps[colormap]
    rgb = np.round(cmap(scaled)[..., :3] * 255).astype(np.uint8)
    alpha = np.where(finite, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, mode="RGBA")


def save_image(image: Image.Image, path: Path, image_format: str, webp_quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if image_format == "webp":
        image.save(path, "WEBP", quality=webp_quality, method=6, lossless=False)
    else:
        image.save(path, "PNG", optimize=True)


def build_preview(image: Image.Image, max_side: int = 1600) -> Image.Image:
    preview = image.copy()
    if max_side > 0:
        preview.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    return preview


def build_tiles(
    image: Image.Image,
    output_root: Path,
    layer_name: str,
    max_zoom: int,
    tile_size: int,
    image_format: str,
    webp_quality: int,
) -> dict[str, int]:
    width, height = image.size
    count = 0
    layer_root = output_root / "tiles" / layer_name

    for z in range(max_zoom + 1):
        scale = 2 ** (z - max_zoom)
        z_width = max(1, int(math.ceil(width * scale)))
        z_height = max(1, int(math.ceil(height * scale)))
        if z == max_zoom:
            z_image = image
        else:
            z_image = image.resize((z_width, z_height), Image.Resampling.LANCZOS)

        cols = int(math.ceil(z_width / tile_size))
        rows = int(math.ceil(z_height / tile_size))
        for x in range(cols):
            for y in range(rows):
                left = x * tile_size
                upper = y * tile_size
                tile = z_image.crop((left, upper, min(left + tile_size, z_width), min(upper + tile_size, z_height)))
                if tile.size != (tile_size, tile_size):
                    padded = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
                    padded.paste(tile, (0, 0))
                    tile = padded
                save_image(tile, layer_root / str(z) / str(x) / f"{y}.{image_format}", image_format, webp_quality)
                count += 1

    return {"tile_count": count}


def footprint_from_wcs(wcs: WCS, width: int, height: int) -> list[dict[str, float]]:
    corners = np.array(
        [
            [0, 0],
            [width - 1, 0],
            [width - 1, height - 1],
            [0, height - 1],
        ],
        dtype=float,
    )
    ra, dec = wcs.pixel_to_world_values(corners[:, 0], corners[:, 1])
    return [{"ra_deg": float(r), "dec_deg": float(d)} for r, d in zip(ra, dec)]


def pixel_scale_metadata(wcs: WCS) -> dict[str, float | None]:
    try:
        scales = np.abs(proj_plane_pixel_scales(wcs)) * 3600.0
    except Exception:
        return {"arcsec_per_pixel_x": None, "arcsec_per_pixel_y": None, "arcsec_per_pixel": None}
    mean_scale = float(np.sqrt(scales[0] * scales[1]))
    return {
        "arcsec_per_pixel_x": float(scales[0]),
        "arcsec_per_pixel_y": float(scales[1]),
        "arcsec_per_pixel": mean_scale,
    }


def directory_size(path: Path) -> int:
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def human_size(byte_count: int) -> str:
    value = float(byte_count)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024 or unit == "TB":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{byte_count} B"


def main() -> None:
    args = parse_args()
    if args.max_zoom < 0:
        raise ValueError("--max-zoom must be >= 0")
    if args.tile_size <= 0:
        raise ValueError("--tile-size must be > 0")
    existing_metadata = {}
    metadata_path = args.output_dir / "metadata.json"
    if metadata_path.exists():
        with metadata_path.open("r", encoding="utf-8") as handle:
            existing_metadata = json.load(handle)

    if args.update_previews_only and not args.output_dir.exists():
        raise FileNotFoundError(f"{args.output_dir} does not exist; cannot update previews in place.")

    if args.output_dir.exists() and not args.update_previews_only:
        if not args.overwrite:
            raise FileExistsError(f"{args.output_dir} already exists; pass --overwrite to replace it.")
        shutil.rmtree(args.output_dir)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    headers: dict[str, fits.Header] = {}
    wcses: dict[str, WCS] = {}
    shapes: dict[str, tuple[int, int]] = {}
    available_layers: dict[str, Path] = {}

    for layer_name, filename in LAYERS.items():
        path = args.input_dir / filename
        if not path.exists() and layer_name.startswith("planck_"):
            print(f"Skipping optional Planck layer {layer_name}: {path} not found")
            continue
        headers[layer_name], wcses[layer_name], shapes[layer_name] = read_fits_metadata(path)
        available_layers[layer_name] = path

    target_shape = shapes["dragonfly_g"]
    target_wcs = wcses["dragonfly_g"]
    if shapes["dragonfly_r"] != target_shape or not wcs_close(
        target_wcs, wcses["dragonfly_r"], target_shape, shapes["dragonfly_r"]
    ):
        raise RuntimeError("Dragonfly g and r mosaics do not share the same grid/WCS.")

    reprojected_layers = {}
    for layer_name in [name for name in available_layers if name.startswith("planck")]:
        reprojected_layers[layer_name] = not wcs_close(
            target_wcs, wcses[layer_name], target_shape, shapes[layer_name]
        )

    height, width = target_shape
    tile_templates = {}
    layer_meta = {}

    preview_colormaps = args.colormaps or [args.colormap]
    if args.colormap not in preview_colormaps:
        preview_colormaps = [args.colormap, *preview_colormaps]

    for layer_name, path in available_layers.items():
        data, header, wcs = read_fits(path)
        if layer_name.startswith("planck"):
            data, _ = maybe_reproject_planck(data, wcs, target_wcs, target_shape)
        layer_range = layer_display_range(args, layer_name)
        cuts = fixed_cuts(data, layer_range) if layer_range else finite_cuts(data, tuple(args.cuts))
        default_rgba = normalize_rgba(data, cuts, origin="lower", colormap=args.colormap)
        preview_name = f"preview_{layer_name}.{args.format}"
        preview_map = {}
        for cmap_name in preview_colormaps:
            rgba = default_rgba if cmap_name == args.colormap else normalize_rgba(data, cuts, origin="lower", colormap=cmap_name)
            cmap_preview_name = f"preview_{layer_name}_{cmap_name}.{args.format}"
            save_image(
                build_preview(rgba, args.preview_max_side),
                args.output_dir / cmap_preview_name,
                args.format,
                args.webp_quality,
            )
            preview_map[cmap_name] = cmap_preview_name
        save_image(build_preview(default_rgba, args.preview_max_side), args.output_dir / preview_name, args.format, args.webp_quality)

        existing_layer = existing_metadata.get("layers", {}).get(layer_name, {})
        tile_info = {"tile_count": int(existing_layer.get("tile_count", 0))}
        if not args.preview_only and not args.update_previews_only:
            tile_info = build_tiles(
                default_rgba,
                args.output_dir,
                layer_name,
                args.max_zoom,
                args.tile_size,
                args.format,
                args.webp_quality,
            )

        tile_templates[layer_name] = f"tiles/{layer_name}/{{z}}/{{x}}/{{y}}.{args.format}"
        layer_meta[layer_name] = {
            "source_file": LAYERS[layer_name],
            "label": LAYER_LABELS.get(layer_name, layer_name),
            "unit": display_unit(layer_name, headers[layer_name]),
            "display_cuts": cuts,
            "preview": preview_name,
            "previews": preview_map,
            **tile_info,
        }

    metadata = {
        "schema_version": 1,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "preview_only": bool(args.preview_only and not args.update_previews_only),
        "image": {
            "width": int(width),
            "height": int(height),
            **pixel_scale_metadata(target_wcs),
            "wcs": wcs_metadata(target_wcs),
            "footprint_corners": footprint_from_wcs(target_wcs, width, height),
        },
        "tiles": {
            "max_zoom": int(args.max_zoom),
            "tile_size": int(args.tile_size),
            "format": args.format,
            "webp_quality": int(args.webp_quality) if args.format == "webp" else None,
            "preview_max_side": int(args.preview_max_side),
            "colormap": args.colormap,
            "colormaps": preview_colormaps,
            "templates": tile_templates,
        },
        "layers": layer_meta,
        "alignment": {
            "grid": "Dragonfly g/r mosaic pixel grid",
            "planck_reprojected_to_dragonfly": bool(reprojected_layers.get("planck", False)),
            "planck_reprojected_layers": {name: bool(value) for name, value in reprojected_layers.items()},
            "tile_origin": "lower",
            "orientation_note": "Tiles are vertically flipped from array row order to match matplotlib imshow(origin='lower').",
        },
    }

    with (args.output_dir / "metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
        handle.write("\n")
    with (args.output_dir / "metadata.js").open("w", encoding="utf-8") as handle:
        handle.write("window.DFUWS_METADATA = ")
        json.dump(metadata, handle, indent=2)
        handle.write(";\n")

    size = directory_size(args.output_dir)
    print(f"Wrote {args.output_dir}")
    print(f"Output size: {human_size(size)}")
    print(f"Image shape: {height} x {width}")
    print(f"Planck reprojected layers: {reprojected_layers}")
    print(f"Preview only: {args.preview_only}")


if __name__ == "__main__":
    main()
