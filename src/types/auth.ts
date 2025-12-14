import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
	interface Session {
		user: {
			id: string;
			role: "user" | "admin";
			username: string;
		} & DefaultSession["user"];
	}

	interface User {
		role: "user" | "admin";
		username: string;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: string;
		role: "user" | "admin";
		username: string;
	}
}
