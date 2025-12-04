"use client";

import { useEffect, useState } from "react";
import {
	detectStockfishFlavor,
	getEngineDescription,
	type StockfishRecommendation,
} from "@/utils/stockfishDetector";
import Button, { ButtonStyle } from "@/components/button";

export default function StockfishTestPage() {
	const [recommendation, setRecommendation] = useState<StockfishRecommendation | null>(null);
	const [showDetails, setShowDetails] = useState(true);

	useEffect(() => {
		const detected = detectStockfishFlavor();
		setRecommendation(detected);

		// Log to console
		console.group("🐟 Stockfish.js Detection");
		console.log("Flavor:", detected.flavor);
		console.log("File:", detected.fileName);
		console.log("Reason:", detected.reason);
		console.log("Description:", getEngineDescription(detected));
		console.log("---");
		console.log("WebAssembly Support:", detected.supportsWasm ? "✓" : "✗");
		console.log("CORS/SharedArrayBuffer:", detected.supportsCORS ? "✓" : "✗");
		console.log("Mobile Device:", detected.isMobile ? "Yes" : "No");
		console.groupEnd();
	}, []);

	if (!recommendation) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-xl">Detecting best Stockfish engine...</div>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-8 max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold mb-6">Stockfish.js Engine Detector</h1>

			{/* Main Recommendation */}
			<div className="mb-6 p-6 bg-background-page rounded-lg border-2 border-color-btn-primary">
				<h2 className="text-xl font-bold mb-4">Recommended Engine</h2>
				<div className="space-y-3">
					<div>
						<span className="font-bold">Flavor:</span>{" "}
						<code className="bg-background px-2 py-1 rounded">{recommendation.flavor}</code>
					</div>
					<div>
						<span className="font-bold">File:</span>{" "}
						<code className="bg-background px-2 py-1 rounded text-sm">
							{recommendation.fileName}
						</code>
					</div>
					<div>
						<span className="font-bold">Description:</span>{" "}
						{getEngineDescription(recommendation)}
					</div>
					<div className="pt-2 text-sm text-[#aaa]">{recommendation.reason}</div>
				</div>
			</div>

			{/* Device Capabilities */}
			<div className="mb-6 p-6 bg-background-page rounded-lg">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-bold">Device Capabilities</h2>
					<Button
						buttonStyle={ButtonStyle.Secondary}
						onClick={() => setShowDetails(!showDetails)}
					>
						{showDetails ? "Hide" : "Show"} Details
					</Button>
				</div>

				{showDetails && (
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="text-2xl">
								{recommendation.supportsWasm ? "✓" : "✗"}
							</span>
							<div>
								<div className="font-bold">WebAssembly</div>
								<div className="text-sm text-[#aaa]">
									{recommendation.supportsWasm
										? "Your browser supports WebAssembly modules"
										: "WebAssembly not supported - will use ASM-JS fallback"}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<span className="text-2xl">
								{recommendation.supportsCORS ? "✓" : "✗"}
							</span>
							<div>
								<div className="font-bold">CORS / Multi-threading</div>
								<div className="text-sm text-[#aaa]">
									{recommendation.supportsCORS
										? "SharedArrayBuffer available - can use multi-threaded engines"
										: "CORS headers not set - will use single-threaded engine"}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<span className="text-2xl">
								{recommendation.isMobile ? "📱" : "💻"}
							</span>
							<div>
								<div className="font-bold">Device Type</div>
								<div className="text-sm text-[#aaa]">
									{recommendation.isMobile
										? "Mobile device detected - will use lite engine"
										: "Desktop device detected - will use full engine"}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* All Available Flavors */}
			<div className="mb-6 p-6 bg-background-page rounded-lg">
				<h2 className="text-xl font-bold mb-4">All Available Flavors</h2>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#444]">
								<th className="text-left py-2 px-2">Flavor</th>
								<th className="text-left py-2 px-2">Size</th>
								<th className="text-left py-2 px-2">Threading</th>
								<th className="text-left py-2 px-2">CORS Required</th>
								<th className="text-left py-2 px-2">Best For</th>
							</tr>
						</thead>
						<tbody>
							<tr
								className={`border-b border-[#333] ${
									recommendation.flavor === "large-multi-threaded"
										? "bg-color-btn-primary bg-opacity-20"
										: ""
								}`}
							>
								<td className="py-2 px-2">Large Multi-threaded</td>
								<td className="py-2 px-2">≈75MB</td>
								<td className="py-2 px-2">Yes</td>
								<td className="py-2 px-2">Yes</td>
								<td className="py-2 px-2">Desktop with CORS</td>
							</tr>
							<tr
								className={`border-b border-[#333] ${
									recommendation.flavor === "large-single-threaded"
										? "bg-color-btn-primary bg-opacity-20"
										: ""
								}`}
							>
								<td className="py-2 px-2">Large Single-threaded</td>
								<td className="py-2 px-2">≈75MB</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">Desktop without CORS</td>
							</tr>
							<tr
								className={`border-b border-[#333] ${
									recommendation.flavor === "lite-multi-threaded"
										? "bg-color-btn-primary bg-opacity-20"
										: ""
								}`}
							>
								<td className="py-2 px-2">Lite Multi-threaded</td>
								<td className="py-2 px-2">≈7MB</td>
								<td className="py-2 px-2">Yes</td>
								<td className="py-2 px-2">Yes</td>
								<td className="py-2 px-2">Mobile with CORS</td>
							</tr>
							<tr
								className={`border-b border-[#333] ${
									recommendation.flavor === "lite-single-threaded"
										? "bg-color-btn-primary bg-opacity-20"
										: ""
								}`}
							>
								<td className="py-2 px-2">Lite Single-threaded</td>
								<td className="py-2 px-2">≈7MB</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">Mobile without CORS</td>
							</tr>
							<tr
								className={`${
									recommendation.flavor === "asm-js"
										? "bg-color-btn-primary bg-opacity-20"
										: ""
								}`}
							>
								<td className="py-2 px-2">ASM-JS</td>
								<td className="py-2 px-2">≈10MB</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">No</td>
								<td className="py-2 px-2">Legacy browsers</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p className="text-xs text-[#aaa] mt-4">
					Highlighted row shows your recommended engine
				</p>
			</div>

			{/* Usage Example */}
			<div className="p-6 bg-background-page rounded-lg">
				<h2 className="text-xl font-bold mb-4">Usage Example</h2>
				<pre className="bg-background p-4 rounded text-sm overflow-x-auto">
					{`import { detectStockfishFlavor } from '@/utils/stockfishDetector';

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
