"use client";

import { useEffect, useState } from "react";
import {
	detectStockfishFlavor,
	getEngineDescription,
	logStockfishDetection,
	type StockfishRecommendation,
} from "@/utils/stockfishDetector";

/**
 * Example component showing how to use the Stockfish flavor detector
 */
export default function StockfishDetectorExample() {
	const [recommendation, setRecommendation] = useState<StockfishRecommendation | null>(null);

	useEffect(() => {
		// Detect the recommended flavor on component mount
		const detected = detectStockfishFlavor();
		setRecommendation(detected);

		// Log detailed information to console
		logStockfishDetection(detected);
	}, []);

	if (!recommendation) {
		return <div>Detecting best Stockfish engine...</div>;
	}

	return (
		<div className="p-4 flex flex-col gap-4">
			<h2 className="text-2xl font-bold">Stockfish.js Engine Detection</h2>

			<div className="p-4 bg-background-page rounded">
				<h3 className="font-bold mb-2">Recommended Engine</h3>
				<p className="mb-2">
					<strong>Flavor:</strong> {recommendation.flavor}
				</p>
				<p className="mb-2">
					<strong>File:</strong> {recommendation.fileName}
				</p>
				<p className="mb-2">
					<strong>Description:</strong> {getEngineDescription(recommendation)}
				</p>
				<p className="text-sm text-[#aaa]">{recommendation.reason}</p>
			</div>

			<div className="p-4 bg-background-page rounded">
				<h3 className="font-bold mb-2">Device Capabilities</h3>
				<ul className="space-y-1">
					<li>
						WebAssembly: {recommendation.supportsWasm ? "✓ Supported" : "✗ Not supported"}
					</li>
					<li>
						CORS/Multi-threading: {recommendation.supportsCORS ? "✓ Supported" : "✗ Not supported"}
					</li>
					<li>
						Device Type: {recommendation.isMobile ? "Mobile" : "Desktop"}
					</li>
				</ul>
			</div>

			<div className="p-4 bg-background-page rounded">
				<h3 className="font-bold mb-2">Usage Example</h3>
				<pre className="text-sm bg-background p-2 rounded overflow-x-auto">
					{`// Import the detector
import { detectStockfishFlavor } from '@/utils/stockfishDetector';

// Detect the best flavor
const recommendation = detectStockfishFlavor();

// Load the recommended engine
const stockfish = new Worker(\`/stockfish/\${recommendation.fileName}\`);

// Initialize the engine
stockfish.postMessage('uci');

// Listen for engine responses
stockfish.addEventListener('message', (event) => {
  console.log('Engine:', event.data);
});`}
				</pre>
			</div>
		</div>
	);
}

/**
 * Practical example: Loading Stockfish with automatic detection
 */
export function loadStockfishEngine(): Worker | null {
	try {
		const recommendation = detectStockfishFlavor();
		console.log(`Loading ${recommendation.flavor} engine from ${recommendation.fileName}`);

		// Create a Web Worker with the recommended engine file
		const worker = new Worker(`/stockfish/${recommendation.fileName}`);

		// Initialize UCI protocol
		worker.postMessage("uci");

		return worker;
	} catch (error) {
		console.error("Failed to load Stockfish engine:", error);
		return null;
	}
}

/**
 * Example with fallback handling
 */
export function loadStockfishWithFallback(): Worker | null {
	const recommendation = detectStockfishFlavor();

	try {
		// Try to load the recommended engine
		const worker = new Worker(`/stockfish/${recommendation.fileName}`);
		worker.postMessage("uci");
		console.log(`Successfully loaded ${recommendation.flavor} engine`);
		return worker;
	} catch (error) {
		console.error(`Failed to load ${recommendation.flavor}, trying fallback...`);

		// Fallback to ASM-JS if the recommended engine fails
		try {
			const fallbackWorker = new Worker("/stockfish/stockfish-17.1-asm.js");
			fallbackWorker.postMessage("uci");
			console.log("Successfully loaded ASM-JS fallback engine");
			return fallbackWorker;
		} catch (fallbackError) {
			console.error("Failed to load any Stockfish engine:", fallbackError);
			return null;
		}
	}
}
