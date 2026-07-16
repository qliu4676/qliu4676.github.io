# DFUWS Cirrus Viewer

This page is a static GitHub Pages viewer at `/dfuws-cirrus-viewer/` for comparing Dragonfly DFUWS dust-map mosaics with the Planck radiance map. The FITS files are intentionally not committed to this repository; use the preprocessing script to generate web-ready previews, metadata, and image tiles.

## Generate Tiles

Install preprocessing dependencies in your preferred science Python environment:

```bash
python -m pip install -r scripts/requirements-dfuws-viewer.txt
```

Full default WebP tile set:

```bash
python scripts/build_dfuws_dust_tiles.py \
  --input-dir /Users/qliu/dragonfly/cirrus/outputs/mosaics/dfuws \
  --output-dir assets/dfuws_dust_viewer \
  --max-zoom 5 \
  --tile-size 512 \
  --format webp \
  --dragonfly-g-range 0 25 \
  --dragonfly-r-range 3.2 40 \
  --planck-range 0 6e-7 \
  --colormap inferno \
  --colormaps viridis inferno afmhot gray \
  --overwrite
```

Refresh only the full-resolution preview images and metadata, leaving the tile pyramid untouched:

```bash
python scripts/build_dfuws_dust_tiles.py \
  --input-dir /Users/qliu/dragonfly/cirrus/outputs/mosaics/dfuws \
  --output-dir assets/dfuws_dust_viewer \
  --max-zoom 5 \
  --tile-size 512 \
  --format webp \
  --dragonfly-g-range 0 25 \
  --dragonfly-r-range 3.2 40 \
  --planck-range 0 6e-7 \
  --colormap inferno \
  --colormaps viridis inferno afmhot gray \
  --update-previews-only
```

Smaller debug tile set:

```bash
python scripts/build_dfuws_dust_tiles.py \
  --input-dir /Users/qliu/dragonfly/cirrus/outputs/mosaics/dfuws \
  --output-dir assets/dfuws_dust_viewer_test \
  --max-zoom 3 \
  --tile-size 512 \
  --format png \
  --overwrite
```

Preview and metadata only:

```bash
python scripts/build_dfuws_dust_tiles.py \
  --input-dir /Users/qliu/dragonfly/cirrus/outputs/mosaics/dfuws \
  --output-dir assets/dfuws_dust_viewer_preview \
  --preview-only \
  --overwrite
```

## Notes

- The script reads `mosaic_g_kJy_sr.fits`, `mosaic_r_kJy_sr.fits`, and `planck_radiance.fits`.
- Dragonfly `g` and `r` must share the same pixel grid. If Planck differs, the script reprojects Planck to the Dragonfly `g` WCS using `reproject_interp`.
- NaNs are transparent in PNG tiles. WebP output is also written as RGBA when Pillow supports alpha WebP.
- The viewer reads `assets/dfuws_dust_viewer/metadata.json`; tile paths and file extensions come from that metadata.
- If the generated output is too large for GitHub Pages, reduce `--max-zoom`, increase `--tile-size`, keep `--format webp`, lower `--webp-quality`, or host the tiles separately.
- After generating tiles, check the script's printed output directory size before committing.
