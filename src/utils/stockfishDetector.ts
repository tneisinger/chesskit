/**
 * Detects which flavor of Stockfish.js should be used based on device capabilities
 * Based on Stockfish.js 17.1 recommendations from STOCKFISH_README.md
 */

export enum StockfishFlavor {
	LARGE_MULTI_THREADED = "large-multi-threaded",
	LARGE_SINGLE_THREADED = "large-single-threaded",
	LITE_MULTI_THREADED = "lite-multi-threaded",
	LITE_SINGLE_THREADED = "lite-single-threaded",
	ASM_JS = "asm-js",
}

export interface StockfishRecommendation {
	flavor: StockfishFlavor;
	supportsWasm: boolean;
	supportsCORS: boolean;
	isMobile: boolean;
	reason: string;
	fileName: string;
  title: string;
}

/**
 * Checks if the browser supports WebAssembly
 */
function supportsWebAssembly(): boolean {
	try {
		if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
			const module = new WebAssembly.Module(
				Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
			);
			return module instanceof WebAssembly.Module;
		}
	} catch (e) {
		return false;
	}
	return false;
}

/**
 * Checks if the browser supports CORS headers (cross-origin isolation)
 * This is required for SharedArrayBuffer and multi-threading
 */
function supportsCrossOriginIsolation(): boolean {
	// Check if SharedArrayBuffer is available
	// This indicates that the proper CORS headers are set
	return typeof SharedArrayBuffer !== "undefined";
}

/**
 * Detects if the user is on a mobile device
 */
function isMobileDevice(): boolean {
	// Check user agent
	const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

	// Mobile device patterns
	const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
	if (mobileRegex.test(userAgent.toLowerCase())) {
		return true;
	}

	// Check for touch support and small screen
	const hasTouchScreen =
		"ontouchstart" in window ||
		navigator.maxTouchPoints > 0 ||
		(navigator as any).msMaxTouchPoints > 0;

	const hasSmallScreen = window.innerWidth <= 768;

	return hasTouchScreen && hasSmallScreen;
}

/**
 * Detects the recommended Stockfish.js flavor based on device capabilities
 */
export function detectStockfishFlavor(): StockfishRecommendation {
	const supportsWasm = supportsWebAssembly();
	const supportsCORS = supportsCrossOriginIsolation();
	const isMobile = isMobileDevice();

	// Priority 1: If WASM is not supported, use ASM-JS (last resort)
	if (!supportsWasm) {
		return {
			flavor: StockfishFlavor.ASM_JS,
			supportsWasm,
			supportsCORS,
			isMobile,
			reason: "WebAssembly not supported, using ASM-JS as fallback",
			fileName: "stockfish-17.1-asm-341ff22.js",
      title: "Stockfish 17.1 ASM-JS"
		};
	}

	// Priority 2: Mobile devices should use lite versions
	if (isMobile) {
		if (supportsCORS) {
			return {
				flavor: StockfishFlavor.LITE_MULTI_THREADED,
				supportsWasm,
				supportsCORS,
				isMobile,
				reason: "Mobile device with CORS support, using lite multi-threaded engine (≈7MB)",
				fileName: "stockfish-17.1-lite-51f59da.js",
        title: "Stockfish 17.1 Lite MT"
			};
		} else {
			return {
				flavor: StockfishFlavor.LITE_SINGLE_THREADED,
				supportsWasm,
				supportsCORS,
				isMobile,
				reason: "Mobile device without CORS support, using lite single-threaded engine (≈7MB)",
				fileName: "stockfish-17.1-lite-single-03e3232.js",
        title: "Stockfish 17.1 Lite ST"
			};
		}
	}

	// Priority 3: Desktop devices should use large versions
	if (supportsCORS) {
		return {
			flavor: StockfishFlavor.LARGE_MULTI_THREADED,
			supportsWasm,
			supportsCORS,
			isMobile,
			reason: "Desktop with CORS support, using strongest multi-threaded engine (≈75MB)",
			fileName: "stockfish-17.1-8e4d048.js",
      title: "Stockfish 17.1 MT"
		};
	} else {
		return {
			flavor: StockfishFlavor.LARGE_SINGLE_THREADED,
			supportsWasm,
			supportsCORS,
			isMobile,
			reason: "Desktop without CORS support, using large single-threaded engine (≈75MB)",
			fileName: "stockfish-17.1-single-a496a04.js",
      title: "Stockfish 17.1 ST"
		};
	}
}

/**
 * Gets a human-readable description of the recommended engine
 */
export function getEngineDescription(recommendation: StockfishRecommendation): string {
	const descriptions = {
		[StockfishFlavor.LARGE_MULTI_THREADED]:
			"Strongest version (≈75MB) with multi-threading support",
		[StockfishFlavor.LARGE_SINGLE_THREADED]:
			"Strong version (≈75MB) without multi-threading",
		[StockfishFlavor.LITE_MULTI_THREADED]:
			"Optimized for mobile (≈7MB) with multi-threading support",
		[StockfishFlavor.LITE_SINGLE_THREADED]:
			"Optimized for mobile (≈7MB) without multi-threading",
		[StockfishFlavor.ASM_JS]:
			"Legacy JavaScript version (≈10MB) - slowest but most compatible",
	};

	return descriptions[recommendation.flavor];
}

/**
 * Logs detailed information about the detection
 */
export function logStockfishDetection(recommendation: StockfishRecommendation): void {
	console.group("🐟 Stockfish.js Detection");
	console.log("Flavor:", recommendation.flavor);
	console.log("File:", recommendation.fileName);
	console.log("Reason:", recommendation.reason);
	console.log("Description:", getEngineDescription(recommendation));
	console.log("---");
	console.log("WebAssembly Support:", recommendation.supportsWasm ? "✓" : "✗");
	console.log("CORS/SharedArrayBuffer:", recommendation.supportsCORS ? "✓" : "✗");
	console.log("Mobile Device:", recommendation.isMobile ? "Yes" : "No");
	console.groupEnd();
}
