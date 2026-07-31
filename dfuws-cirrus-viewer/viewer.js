(function () {
	"use strict";

	const metadataUrl = "../assets/dfuws_dust_viewer/metadata.json";
	const state = {
		metadata: null,
		dragonflyLayer: "dragonfly_g",
		planckLayer: "planck",
		colormap: "inferno",
		split: 0.5,
		zoom: 1,
		initialViewWidthDeg: 5,
		initialCenter: { ra: 18, dec: 16 },
		pan: { x: 0, y: 0 },
		drag: null,
		panInitialized: false,
	};

	const elements = {
		map: document.getElementById("map"),
		splitter: document.getElementById("splitter"),
		status: document.getElementById("status"),
		mapDragonflyG: document.getElementById("mapDragonflyG"),
		mapDragonflyR: document.getElementById("mapDragonflyR"),
		mapPlanckRadiance: document.getElementById("mapPlanckRadiance"),
		mapPlanckEbv: document.getElementById("mapPlanckEbv"),
		mapPlanckTemperature: document.getElementById("mapPlanckTemperature"),
		mapPlanckTau353: document.getElementById("mapPlanckTau353"),
		dragonflyLabel: document.getElementById("dragonflyLabel"),
		dragonflyUnit: document.getElementById("dragonflyUnit"),
		planckLabel: document.getElementById("planckLabel"),
		planckUnit: document.getElementById("planckUnit"),
		coordReadout: document.getElementById("coordReadout"),
		scaleBar: document.getElementById("scaleBar"),
		scaleLabel: document.getElementById("scaleLabel"),
		displayBrightness: document.getElementById("displayBrightness"),
		displayContrast: document.getElementById("displayContrast"),
		zoomControl: document.getElementById("zoomControl"),
		cmapViridis: document.getElementById("cmapViridis"),
		cmapInferno: document.getElementById("cmapInferno"),
		cmapGray: document.getElementById("cmapGray"),
		cmapAfmhot: document.getElementById("cmapAfmhot"),
	};

	function showStatus(message) {
		elements.status.textContent = message;
		elements.status.hidden = false;
	}

	function previewUrl(layerName) {
		const layer = state.metadata.layers[layerName];
		const preview = (layer.previews && layer.previews[state.colormap]) || layer.preview;
		return `../assets/dfuws_dust_viewer/${preview}`;
	}

	function activeImages() {
		return Array.from(elements.map.querySelectorAll(".preview-layer img"));
	}

	function imageSize() {
		const image = activeImages()[0];
		if (!image || !image.naturalWidth || !image.naturalHeight) {
			return null;
		}
		return {
			width: image.naturalWidth * state.zoom,
			height: image.naturalHeight * state.zoom,
			naturalWidth: image.naturalWidth,
			naturalHeight: image.naturalHeight,
		};
	}

	function clampPan() {
		const size = imageSize();
		if (!size) {
			return;
		}
		const rect = elements.map.getBoundingClientRect();
		const padding = 12;
		if (size.width + 2 * padding <= rect.width) {
			state.pan.x = (rect.width - size.width) / 2;
		} else {
			const minX = rect.width - size.width - padding;
			const maxX = padding;
			state.pan.x = Math.max(minX, Math.min(maxX, state.pan.x));
		}
		if (size.height + 2 * padding <= rect.height) {
			state.pan.y = (rect.height - size.height) / 2;
		} else {
			const minY = rect.height - size.height - padding;
			const maxY = padding;
			state.pan.y = Math.max(minY, Math.min(maxY, state.pan.y));
		}
	}

	function updateTransform() {
		clampPan();
		const referenceImage = activeImages()[0];
		const referenceWidth = referenceImage && referenceImage.naturalWidth;
		activeImages().forEach((image) => {
			const layerScale = referenceWidth && image.naturalWidth ? referenceWidth / image.naturalWidth : 1;
			image.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom * layerScale})`;
		});
		updateScaleBar();
	}

	function centerView() {
		const size = imageSize();
		if (!size) {
			return;
		}
		const rect = elements.map.getBoundingClientRect();
		state.pan.x = (rect.width - size.width) / 2;
		state.pan.y = (rect.height - size.height) / 2;
		updateTransform();
	}

	function centerOnSky(ra, dec) {
		const size = imageSize();
		const pixel = skyToPixel(ra, dec);
		if (!size || !pixel) {
			centerView();
			return;
		}
		const rect = elements.map.getBoundingClientRect();
		const previewToNative = state.metadata.image.width / size.naturalWidth;
		const imageX = pixel.x / previewToNative;
		const imageY = (state.metadata.image.height - 1 - pixel.y) / previewToNative;
		state.pan.x = rect.width / 2 - imageX * state.zoom;
		state.pan.y = rect.height / 2 - imageY * state.zoom;
		updateTransform();
	}

	function defaultZoomForAngularView() {
		const image = activeImages()[0];
		const arcsecPerPixel = state.metadata && state.metadata.image.arcsec_per_pixel;
		if (!image || !image.naturalWidth || !arcsecPerPixel) {
			return 1;
		}
		const rect = elements.map.getBoundingClientRect();
		const previewToNative = state.metadata.image.width / image.naturalWidth;
		const arcsecPerPreviewPixel = arcsecPerPixel * previewToNative;
		const initialViewPixels = (state.initialViewWidthDeg * 3600) / arcsecPerPreviewPixel;
		const zoom = rect.width / initialViewPixels;
		return Math.max(0.08, Math.min(8, zoom));
	}

	function setSplit(split) {
		state.split = Math.max(0.02, Math.min(0.98, split));
		const percent = `${state.split * 100}%`;
		const inverse = `${(1 - state.split) * 100}%`;
		const leftPane = elements.map.querySelector(".preview-left");
		const rightPane = elements.map.querySelector(".preview-right");
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

	function setZoom(nextZoom, anchor) {
		const oldZoom = state.zoom;
		const zoom = Math.max(0.08, Math.min(8, nextZoom));
		if (zoom === oldZoom) {
			return;
		}
		const rect = elements.map.getBoundingClientRect();
		const point = anchor || { x: rect.width / 2, y: rect.height / 2 };
		const imageX = (point.x - state.pan.x) / oldZoom;
		const imageY = (point.y - state.pan.y) / oldZoom;
		state.zoom = zoom;
		state.pan.x = point.x - imageX * zoom;
		state.pan.y = point.y - imageY * zoom;
		elements.zoomControl.value = String(zoom);
		updateTransform();
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
		return `${Math.round(arcsec)} arcsec`;
	}

	function updateScaleBar() {
		const scale = state.metadata && state.metadata.image.arcsec_per_pixel;
		const size = imageSize();
		if (!scale || !size) {
			elements.scaleBar.hidden = true;
			return;
		}
		elements.scaleBar.hidden = false;
		const previewToNative = state.metadata.image.width / size.naturalWidth;
		const arcsecPerPreviewPixel = scale * previewToNative;
		const targetArcsec = (110 / state.zoom) * arcsecPerPreviewPixel;
		const choices = [30, 60, 120, 300, 600, 900, 1800, 3600];
		const nice = choices.find((value) => value >= targetArcsec * 0.65) || choices[choices.length - 1];
		const width = (nice / arcsecPerPreviewPixel) * state.zoom;
		elements.scaleBar.querySelector(".scale-line").style.width = `${Math.max(42, Math.min(180, width))}px`;
		elements.scaleLabel.textContent = formatAngularScale(nice);
	}

	function applyFilters() {
		const left = elements.map.querySelector(".preview-left img");
		const right = elements.map.querySelector(".preview-right img");
		const filter = `brightness(${elements.displayBrightness.value}%) contrast(${elements.displayContrast.value}%)`;
		if (left) {
			left.style.filter = filter;
		}
		if (right) {
			right.style.filter = filter;
		}
	}

	function updateBandButtons() {
		const isG = state.dragonflyLayer === "dragonfly_g";
		elements.mapDragonflyG.classList.toggle("active", isG);
		elements.mapDragonflyR.classList.toggle("active", !isG);
		elements.mapDragonflyG.setAttribute("aria-pressed", String(isG));
		elements.mapDragonflyR.setAttribute("aria-pressed", String(!isG));
		elements.dragonflyLabel.textContent = isG ? "Dragonfly g" : "Dragonfly r";
		elements.dragonflyUnit.textContent = state.metadata.layers[state.dragonflyLayer].unit || "kJy/sr";
	}

	function updatePlanckButtons() {
		if (!state.metadata.layers[state.planckLayer]) {
			state.planckLayer = "planck";
		}
		const buttons = {
			planck: elements.mapPlanckRadiance,
			planck_ebv: elements.mapPlanckEbv,
			planck_temperature: elements.mapPlanckTemperature,
			planck_tau353: elements.mapPlanckTau353,
		};
		Object.entries(buttons).forEach(([name, button]) => {
			const available = Boolean(state.metadata.layers[name]);
			button.hidden = !available;
			button.disabled = !available;
			if (!available) {
				return;
			}
			const active = state.planckLayer === name;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		});
		const layer = state.metadata.layers[state.planckLayer];
		elements.planckLabel.textContent = layer.label || "Planck dust map";
		elements.planckUnit.textContent = layer.unit || "";
	}

	function updateColormapButtons() {
		const buttons = {
			viridis: elements.cmapViridis,
			inferno: elements.cmapInferno,
			gray: elements.cmapGray,
			afmhot: elements.cmapAfmhot,
		};
		Object.entries(buttons).forEach(([name, button]) => {
			const active = state.colormap === name;
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		});
	}

	function makeImage(layerName, alt) {
		const image = document.createElement("img");
		image.alt = alt;
		image.draggable = false;
		image.src = `${previewUrl(layerName)}?v=${Date.now()}`;
		image.addEventListener("load", () => {
			if (activeImages().every((item) => item.complete && item.naturalWidth > 0)) {
				elements.status.hidden = true;
				if (state.panInitialized) {
					updateTransform();
				} else {
					state.zoom = defaultZoomForAngularView();
					elements.zoomControl.value = String(state.zoom);
					centerOnSky(state.initialCenter.ra, state.initialCenter.dec);
					state.panInitialized = true;
				}
			}
		});
		image.addEventListener("error", () => showStatus(`Could not load ${image.src}`));
		return image;
	}

	function renderComparison() {
		updateBandButtons();
		updatePlanckButtons();
		updateColormapButtons();
		elements.map.innerHTML = "";

		const leftPane = document.createElement("div");
		leftPane.className = "preview-layer preview-left";
		leftPane.appendChild(makeImage(state.dragonflyLayer, `${elements.dragonflyLabel.textContent} preview`));

		const rightPane = document.createElement("div");
		rightPane.className = "preview-layer preview-right";
		rightPane.appendChild(makeImage(state.planckLayer, `${elements.planckLabel.textContent} preview`));

		elements.map.append(leftPane, rightPane);
		applyFilters();
		setSplit(state.split);
	}

	function imageCoordinates(event) {
		const size = imageSize();
		if (!size) {
			return null;
		}
		const rect = elements.map.getBoundingClientRect();
		const imageX = (event.clientX - rect.left - state.pan.x) / state.zoom;
		const imageY = (event.clientY - rect.top - state.pan.y) / state.zoom;
		if (imageX < 0 || imageY < 0 || imageX >= size.naturalWidth || imageY >= size.naturalHeight) {
			return null;
		}
		const previewToNative = state.metadata.image.width / size.naturalWidth;
		return {
			x: imageX * previewToNative,
			y: state.metadata.image.height - 1 - imageY * previewToNative,
		};
	}

	function pixelToSky(x, y) {
		const w = state.metadata && state.metadata.image && state.metadata.image.wcs;
		if (!w || w.ctype1 !== "RA---TAN" || w.ctype2 !== "DEC--TAN") {
			return null;
		}
		const degToRad = Math.PI / 180;
		const radToDeg = 180 / Math.PI;
		const xi = ((x + 1) - w.crpix1) * w.cdelt1 * degToRad;
		const eta = ((y + 1) - w.crpix2) * w.cdelt2 * degToRad;
		const ra0 = w.crval1 * degToRad;
		const dec0 = w.crval2 * degToRad;
		const denom = Math.cos(dec0) - eta * Math.sin(dec0);
		let ra = (ra0 + Math.atan2(xi, denom)) * radToDeg;
		const dec = Math.atan2(
			Math.sin(dec0) + eta * Math.cos(dec0),
			Math.sqrt(denom * denom + xi * xi)
		) * radToDeg;
		ra = ((ra % 360) + 360) % 360;
		return { ra, dec };
	}

	function skyToPixel(ra, dec) {
		const w = state.metadata && state.metadata.image && state.metadata.image.wcs;
		if (!w || w.ctype1 !== "RA---TAN" || w.ctype2 !== "DEC--TAN") {
			return null;
		}
		const degToRad = Math.PI / 180;
		const ra0 = w.crval1 * degToRad;
		const dec0 = w.crval2 * degToRad;
		const raRad = ra * degToRad;
		const decRad = dec * degToRad;
		const dra = raRad - ra0;
		const cosc = Math.sin(dec0) * Math.sin(decRad) + Math.cos(dec0) * Math.cos(decRad) * Math.cos(dra);
		if (cosc <= 0) {
			return null;
		}
		const xi = Math.cos(decRad) * Math.sin(dra) / cosc;
		const eta = (Math.cos(dec0) * Math.sin(decRad) - Math.sin(dec0) * Math.cos(decRad) * Math.cos(dra)) / cosc;
		return {
			x: w.crpix1 + (xi / degToRad) / w.cdelt1 - 1,
			y: w.crpix2 + (eta / degToRad) / w.cdelt2 - 1,
		};
	}

	function updateCoordinates(event) {
		const coords = imageCoordinates(event);
		if (!coords) {
			elements.coordReadout.hidden = true;
			return;
		}
		const sky = pixelToSky(coords.x, coords.y);
		if (!sky) {
			elements.coordReadout.hidden = true;
			return;
		}
		elements.coordReadout.textContent = `RA ${sky.ra.toFixed(4)}  Dec ${sky.dec.toFixed(4)}`;
		elements.coordReadout.hidden = false;
	}

	function bindControls() {
		elements.mapDragonflyG.addEventListener("click", () => {
			state.dragonflyLayer = "dragonfly_g";
			renderComparison();
		});
		elements.mapDragonflyR.addEventListener("click", () => {
			state.dragonflyLayer = "dragonfly_r";
			renderComparison();
		});
		[
			["planck", elements.mapPlanckRadiance],
			["planck_ebv", elements.mapPlanckEbv],
			["planck_temperature", elements.mapPlanckTemperature],
			["planck_tau353", elements.mapPlanckTau353],
		].forEach(([name, button]) => {
			button.addEventListener("click", () => {
				if (!state.metadata || !state.metadata.layers[name]) {
					return;
				}
				state.planckLayer = name;
				renderComparison();
			});
		});
		[
			["viridis", elements.cmapViridis],
			["inferno", elements.cmapInferno],
			["gray", elements.cmapGray],
			["afmhot", elements.cmapAfmhot],
		].forEach(([name, button]) => {
			button.addEventListener("click", () => {
				state.colormap = name;
				renderComparison();
			});
		});
		[elements.displayBrightness, elements.displayContrast].forEach((control) => control.addEventListener("input", applyFilters));
		elements.zoomControl.addEventListener("input", () => setZoom(Number(elements.zoomControl.value)));

		elements.map.addEventListener("wheel", (event) => {
			event.preventDefault();
			const rect = elements.map.getBoundingClientRect();
			const factor = Math.exp(-event.deltaY * 0.001);
			setZoom(state.zoom * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
		}, { passive: false });

		elements.map.addEventListener("pointerdown", (event) => {
			if (event.target.closest("#splitter")) {
				return;
			}
			state.drag = {
				mode: "pan",
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				panX: state.pan.x,
				panY: state.pan.y,
			};
			elements.map.setPointerCapture(event.pointerId);
			elements.map.classList.add("is-panning");
		});
		elements.map.addEventListener("pointermove", (event) => {
			updateCoordinates(event);
			if (!state.drag || state.drag.pointerId !== event.pointerId || state.drag.mode !== "pan") {
				return;
			}
			state.pan.x = state.drag.panX + event.clientX - state.drag.startX;
			state.pan.y = state.drag.panY + event.clientY - state.drag.startY;
			updateTransform();
		});
		elements.map.addEventListener("pointerleave", () => {
			elements.coordReadout.hidden = true;
		});
		["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
			elements.map.addEventListener(eventName, () => {
				state.drag = null;
				elements.map.classList.remove("is-panning");
			});
		});

		let splitting = false;
		elements.splitter.addEventListener("pointerdown", (event) => {
			splitting = true;
			elements.splitter.setPointerCapture(event.pointerId);
			setSplit(pointerToSplit(event));
		});
		elements.splitter.addEventListener("pointermove", (event) => {
			if (splitting) {
				setSplit(pointerToSplit(event));
			}
		});
		["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
			elements.splitter.addEventListener(eventName, () => {
				splitting = false;
			});
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

		window.addEventListener("resize", updateTransform);
	}

	function loadMetadata() {
		if (window.DFUWS_METADATA) {
			state.metadata = window.DFUWS_METADATA;
			renderComparison();
			return;
		}
		fetch(`${metadataUrl}?v=${Date.now()}`, { cache: "no-store" })
			.then((response) => {
				if (!response.ok) {
					throw new Error(`metadata request failed: ${response.status}`);
				}
				return response.json();
			})
			.then((metadata) => {
				state.metadata = metadata;
				renderComparison();
			})
			.catch((error) => showStatus(`Could not load metadata: ${error.message}`));
	}

	bindControls();
	loadMetadata();
})();
