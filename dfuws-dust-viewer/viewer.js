(function () {
	"use strict";

	const metadataUrl = "../assets/dfuws_dust_viewer/metadata.json";
	const state = {
		metadata: null,
		dragonflyLayer: "dragonfly_g",
		split: 0.5,
		zoom: 1,
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
		dragonflyLabel: document.getElementById("dragonflyLabel"),
		dragonflyUnit: document.getElementById("dragonflyUnit"),
		planckUnit: document.getElementById("planckUnit"),
		scaleBar: document.getElementById("scaleBar"),
		scaleLabel: document.getElementById("scaleLabel"),
		dragonflyBrightness: document.getElementById("dragonflyBrightness"),
		dragonflyContrast: document.getElementById("dragonflyContrast"),
		planckBrightness: document.getElementById("planckBrightness"),
		planckContrast: document.getElementById("planckContrast"),
		zoomControl: document.getElementById("zoomControl"),
	};

	function showStatus(message) {
		elements.status.textContent = message;
		elements.status.hidden = false;
	}

	function previewUrl(layerName) {
		return `../assets/dfuws_dust_viewer/${state.metadata.layers[layerName].preview}`;
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
		const minX = Math.min(padding, rect.width - size.width - padding);
		const maxX = padding;
		const minY = Math.min(padding, rect.height - size.height - padding);
		const maxY = padding;
		state.pan.x = Math.max(minX, Math.min(maxX, state.pan.x));
		state.pan.y = Math.max(minY, Math.min(maxY, state.pan.y));
	}

	function updateTransform() {
		clampPan();
		activeImages().forEach((image) => {
			image.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
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

	function defaultZoomForOneDegreeScale() {
		const image = activeImages()[0];
		const arcsecPerPixel = state.metadata && state.metadata.image.arcsec_per_pixel;
		if (!image || !image.naturalWidth || !arcsecPerPixel) {
			return 1;
		}
		const previewToNative = state.metadata.image.width / image.naturalWidth;
		const arcsecPerPreviewPixel = arcsecPerPixel * previewToNative;
		const oneDegreePreviewPixels = 3600 / arcsecPerPreviewPixel;
		const targetScreenPixels = 120;
		return Math.max(1, Math.min(8, targetScreenPixels / oneDegreePreviewPixels));
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
		const zoom = Math.max(1, Math.min(8, nextZoom));
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
		if (left) {
			left.style.filter = `brightness(${elements.dragonflyBrightness.value}%) contrast(${elements.dragonflyContrast.value}%)`;
		}
		if (right) {
			right.style.filter = `brightness(${elements.planckBrightness.value}%) contrast(${elements.planckContrast.value}%)`;
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
					state.zoom = defaultZoomForOneDegreeScale();
					elements.zoomControl.value = String(state.zoom);
					centerView();
					state.panInitialized = true;
				}
			}
		});
		image.addEventListener("error", () => showStatus(`Could not load ${image.src}`));
		return image;
	}

	function renderComparison() {
		updateBandButtons();
		elements.planckUnit.textContent = state.metadata.layers.planck.unit || "radiance";
		elements.map.innerHTML = "";

		const leftPane = document.createElement("div");
		leftPane.className = "preview-layer preview-left";
		leftPane.appendChild(makeImage(state.dragonflyLayer, `${elements.dragonflyLabel.textContent} preview`));

		const rightPane = document.createElement("div");
		rightPane.className = "preview-layer preview-right";
		rightPane.appendChild(makeImage("planck", "Planck radiance preview"));

		elements.map.append(leftPane, rightPane);
		applyFilters();
		setSplit(state.split);
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
			elements.dragonflyBrightness,
			elements.dragonflyContrast,
			elements.planckBrightness,
			elements.planckContrast,
		].forEach((control) => control.addEventListener("input", applyFilters));
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
			if (!state.drag || state.drag.pointerId !== event.pointerId || state.drag.mode !== "pan") {
				return;
			}
			state.pan.x = state.drag.panX + event.clientX - state.drag.startX;
			state.pan.y = state.drag.panY + event.clientY - state.drag.startY;
			updateTransform();
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
