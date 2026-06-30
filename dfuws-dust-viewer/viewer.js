(function () {
	"use strict";

	const metadataUrl = "../assets/dfuws_dust_viewer/metadata.json";
	const state = {
		map: null,
		metadata: null,
		split: 0.5,
		dragonflyBand: "g",
		layers: {},
	};

	const elements = {
		map: document.getElementById("map"),
		splitter: document.getElementById("splitter"),
		status: document.getElementById("status"),
		bandG: document.getElementById("bandG"),
		bandR: document.getElementById("bandR"),
		dragonflyLabel: document.getElementById("dragonflyLabel"),
		dragonflyUnit: document.getElementById("dragonflyUnit"),
		planckUnit: document.getElementById("planckUnit"),
		scaleBar: document.getElementById("scaleBar"),
		scaleLabel: document.getElementById("scaleLabel"),
		dragonflyBrightness: document.getElementById("dragonflyBrightness"),
		dragonflyContrast: document.getElementById("dragonflyContrast"),
		planckBrightness: document.getElementById("planckBrightness"),
		planckContrast: document.getElementById("planckContrast"),
	};

	function showStatus(message) {
		elements.status.textContent = message;
		elements.status.hidden = false;
	}

	function hideStatus() {
		elements.status.hidden = true;
	}

	function layerUrl(template) {
		return `../assets/dfuws_dust_viewer/${template}`;
	}

	function createTileLayer(template, paneName, metadata) {
		return L.tileLayer(layerUrl(template), {
			pane: paneName,
			tileSize: metadata.tiles.tile_size,
			minZoom: 0,
			maxZoom: metadata.tiles.max_zoom,
			maxNativeZoom: metadata.tiles.max_zoom,
			noWrap: true,
			bounds: imageBounds(metadata),
			errorTileUrl:
				"data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
		});
	}

	function nativeScale(metadata) {
		return Math.pow(2, metadata.tiles.max_zoom);
	}

	function imageBounds(metadata) {
		const scale = nativeScale(metadata);
		return L.latLngBounds([
			[-metadata.image.height / scale, 0],
			[0, metadata.image.width / scale],
		]);
	}

	function setSplit(split) {
		state.split = Math.max(0.02, Math.min(0.98, split));
		const percent = `${state.split * 100}%`;
		const inverse = `${(1 - state.split) * 100}%`;
		const leftPane = state.map && state.map.getPane("leftPane");
		const rightPane = state.map && state.map.getPane("rightPane");
		if (leftPane) {
			leftPane.style.clipPath = `inset(0 ${inverse} 0 0)`;
		}
		if (rightPane) {
			rightPane.style.clipPath = `inset(0 0 0 ${percent})`;
		}
		elements.splitter.style.left = percent;
	}

	function pointerToSplit(event) {
		const rect = elements.map.getBoundingClientRect();
		return (event.clientX - rect.left) / rect.width;
	}

	function setupSplitter() {
		let dragging = false;
		elements.splitter.addEventListener("pointerdown", (event) => {
			dragging = true;
			elements.splitter.setPointerCapture(event.pointerId);
			setSplit(pointerToSplit(event));
		});
		elements.splitter.addEventListener("pointermove", (event) => {
			if (dragging) {
				setSplit(pointerToSplit(event));
			}
		});
		elements.splitter.addEventListener("pointerup", () => {
			dragging = false;
		});
		elements.splitter.addEventListener("pointercancel", () => {
			dragging = false;
		});
		elements.splitter.addEventListener("keydown", (event) => {
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				setSplit(state.split - 0.03);
			}
			if (event.key === "ArrowRight") {
				event.preventDefault();
				setSplit(state.split + 0.03);
			}
		});
	}

	function setBand(band) {
		state.dragonflyBand = band;
		const activeKey = band === "g" ? "dragonfly_g" : "dragonfly_r";
		const inactiveKey = band === "g" ? "dragonfly_r" : "dragonfly_g";
		if (state.layers[inactiveKey]) {
			state.layers[inactiveKey].remove();
		}
		if (state.layers[activeKey] && !state.map.hasLayer(state.layers[activeKey])) {
			state.layers[activeKey].addTo(state.map);
		}
		elements.bandG.classList.toggle("active", band === "g");
		elements.bandR.classList.toggle("active", band === "r");
		elements.bandG.setAttribute("aria-pressed", String(band === "g"));
		elements.bandR.setAttribute("aria-pressed", String(band === "r"));
		elements.dragonflyLabel.textContent = `Dragonfly ${band}`;
		const unit = state.metadata.layers[activeKey].unit || "kJy sr^-1";
		elements.dragonflyUnit.textContent = unit;
		applyFilters();
		setSplit(state.split);
	}

	function applyFilters() {
		const leftPane = state.map && state.map.getPane("leftPane");
		const rightPane = state.map && state.map.getPane("rightPane");
		if (leftPane) {
			leftPane.style.filter = `brightness(${elements.dragonflyBrightness.value}%) contrast(${elements.dragonflyContrast.value}%)`;
		}
		if (rightPane) {
			rightPane.style.filter = `brightness(${elements.planckBrightness.value}%) contrast(${elements.planckContrast.value}%)`;
		}
	}

	function niceAngularScale(arcsec) {
		const candidates = [
			15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 18000, 36000,
		];
		return candidates.find((value) => value >= arcsec) || candidates[candidates.length - 1];
	}

	function formatAngularScale(arcsec) {
		if (arcsec >= 3600) {
			const deg = arcsec / 3600;
			return `${Number.isInteger(deg) ? deg : deg.toFixed(1)} deg`;
		}
		if (arcsec >= 60) {
			const arcmin = arcsec / 60;
			return `${Number.isInteger(arcmin) ? arcmin : arcmin.toFixed(1)} arcmin`;
		}
		return `${arcsec} arcsec`;
	}

	function updateScaleBar() {
		const arcsecPerPixel = state.metadata && state.metadata.image.arcsec_per_pixel;
		if (!arcsecPerPixel || !state.map) {
			elements.scaleBar.hidden = true;
			return;
		}
		elements.scaleBar.hidden = false;
		const zoomScale = Math.pow(2, state.map.getZoom());
		const nativePixelsForTargetWidth = (110 / zoomScale) * nativeScale(state.metadata);
		const targetArcsec = nativePixelsForTargetWidth * arcsecPerPixel;
		const niceArcsec = niceAngularScale(targetArcsec * 0.65);
		const screenWidth = (niceArcsec / arcsecPerPixel / nativeScale(state.metadata)) * zoomScale;
		elements.scaleBar.querySelector(".scale-line").style.width = `${Math.max(42, Math.min(180, screenWidth))}px`;
		elements.scaleLabel.textContent = formatAngularScale(niceArcsec);
	}

	function bindControls() {
		elements.bandG.addEventListener("click", () => setBand("g"));
		elements.bandR.addEventListener("click", () => setBand("r"));
		[
			elements.dragonflyBrightness,
			elements.dragonflyContrast,
			elements.planckBrightness,
			elements.planckContrast,
		].forEach((control) => control.addEventListener("input", applyFilters));
		setupSplitter();
	}

	function initMap(metadata) {
		state.metadata = metadata;
		const bounds = imageBounds(metadata);
		state.map = L.map(elements.map, {
			crs: L.CRS.Simple,
			minZoom: 0,
			maxZoom: metadata.tiles.max_zoom,
			zoomControl: true,
			attributionControl: false,
			maxBounds: bounds.pad(0.25),
			maxBoundsViscosity: 0.85,
		});
		state.map.createPane("rightPane");
		state.map.createPane("leftPane");
		state.map.getPane("rightPane").classList.add("right-pane");
		state.map.getPane("leftPane").classList.add("left-pane");
		state.map.getPane("rightPane").style.zIndex = 200;
		state.map.getPane("leftPane").style.zIndex = 300;

		state.layers.planck = createTileLayer(metadata.tiles.templates.planck, "rightPane", metadata).addTo(state.map);
		state.layers.dragonfly_g = createTileLayer(metadata.tiles.templates.dragonfly_g, "leftPane", metadata);
		state.layers.dragonfly_r = createTileLayer(metadata.tiles.templates.dragonfly_r, "leftPane", metadata);

		state.map.fitBounds(bounds);
		state.map.on("zoom move resize", updateScaleBar);
		elements.planckUnit.textContent = metadata.layers.planck.unit || "radiance";
		setBand("g");
		setSplit(0.5);
		updateScaleBar();
		hideStatus();

		if (metadata.preview_only) {
			showStatus("Preview metadata is loaded, but full tiles have not been generated yet.");
		}
	}

	function loadMetadata() {
		fetch(metadataUrl, { cache: "no-store" })
			.then((response) => {
				if (!response.ok) {
					throw new Error(`metadata request failed: ${response.status}`);
				}
				return response.json();
			})
			.then(initMap)
			.catch(() => {
				showStatus(
					"Tiles are not generated yet. Run scripts/build_dfuws_dust_tiles.py to create assets/dfuws_dust_viewer/metadata.json and the tile pyramid."
				);
			});
	}

	bindControls();
	loadMetadata();
})();
