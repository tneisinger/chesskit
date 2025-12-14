import { db } from "./index";
import { users } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
	// Create admin user
	const adminPassword = await bcrypt.hash("admin123", 10);

	await db.insert(users).values({
		username: "admin",
		email: "admin@chesskit.io",
		passwordHash: adminPassword,
		role: "admin",
	});

	console.log("✓ Seed completed successfully!");
	console.log("\nAdmin user created:");
	console.log("  Email: admin@chesskit.io");
	console.log("  Password: admin123");
	console.log("\n⚠️  IMPORTANT: Change this password after first login!");

	process.exit(0);
}

seed().catch((error) => {
	console.error("Error seeding database:", error);
	process.exit(1);
});
