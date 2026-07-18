window.DFUWS_METADATA = {
  "schema_version": 1,
  "created_utc": "2026-07-18T03:55:52.814072+00:00",
  "preview_only": false,
  "image": {
    "width": 8640,
    "height": 8640,
    "arcsec_per_pixel_x": 5.00000000000004,
    "arcsec_per_pixel_y": 5.00000000000004,
    "arcsec_per_pixel": 5.00000000000004,
    "wcs": {
      "ctype1": "RA---TAN",
      "ctype2": "DEC--TAN",
      "crpix1": 4320.5,
      "crpix2": 4320.5,
      "crval1": 18.0,
      "crval2": 17.5,
      "cdelt1": -0.0013888888888889,
      "cdelt2": 0.0013888888888889,
      "radesys": "ICRS"
    },
    "footprint_corners": [
      {
        "ra_deg": 24.06663619504026,
        "dec_deg": 11.459658159078135
      },
      {
        "ra_deg": 11.93336380495974,
        "dec_deg": 11.459658159078133
      },
      {
        "ra_deg": 11.522527203765952,
        "dec_deg": 23.34373652169361
      },
      {
        "ra_deg": 24.477472796234046,
        "dec_deg": 23.343736521693618
      }
    ]
  },
  "tiles": {
    "max_zoom": 5,
    "tile_size": 512,
    "format": "webp",
    "webp_quality": 92,
    "preview_max_side": 0,
    "colormap": "inferno",
    "colormaps": [
      "viridis",
      "inferno",
      "afmhot",
      "gray"
    ],
    "templates": {
      "dragonfly_g": "tiles/dragonfly_g/{z}/{x}/{y}.webp",
      "dragonfly_r": "tiles/dragonfly_r/{z}/{x}/{y}.webp",
      "planck": "tiles/planck/{z}/{x}/{y}.webp"
    }
  },
  "layers": {
    "dragonfly_g": {
      "source_file": "mosaic_g_kJy_sr.fits",
      "unit": "kJy/sr",
      "display_cuts": {
        "mode": "fixed",
        "low_value": 2.0,
        "high_value": 25.0,
        "finite_pixels": 52146145
      },
      "preview": "preview_dragonfly_g.webp",
      "previews": {
        "viridis": "preview_dragonfly_g_viridis.webp",
        "inferno": "preview_dragonfly_g_inferno.webp",
        "afmhot": "preview_dragonfly_g_afmhot.webp",
        "gray": "preview_dragonfly_g_gray.webp"
      },
      "tile_count": 409
    },
    "dragonfly_r": {
      "source_file": "mosaic_r_kJy_sr.fits",
      "unit": "kJy/sr",
      "display_cuts": {
        "mode": "fixed",
        "low_value": 3.2,
        "high_value": 40.0,
        "finite_pixels": 52146145
      },
      "preview": "preview_dragonfly_r.webp",
      "previews": {
        "viridis": "preview_dragonfly_r_viridis.webp",
        "inferno": "preview_dragonfly_r_inferno.webp",
        "afmhot": "preview_dragonfly_r_afmhot.webp",
        "gray": "preview_dragonfly_r_gray.webp"
      },
      "tile_count": 409
    },
    "planck": {
      "source_file": "planck_radiance.fits",
      "unit": "W/m^2/sr",
      "display_cuts": {
        "mode": "fixed",
        "low_value": 0.0,
        "high_value": 6e-07,
        "finite_pixels": 74649600
      },
      "preview": "preview_planck.webp",
      "previews": {
        "viridis": "preview_planck_viridis.webp",
        "inferno": "preview_planck_inferno.webp",
        "afmhot": "preview_planck_afmhot.webp",
        "gray": "preview_planck_gray.webp"
      },
      "tile_count": 409
    }
  },
  "alignment": {
    "grid": "Dragonfly g/r mosaic pixel grid",
    "planck_reprojected_to_dragonfly": false,
    "tile_origin": "lower",
    "orientation_note": "Tiles are vertically flipped from array row order to match matplotlib imshow(origin='lower')."
  }
};
