"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button, { ButtonStyle } from "@/components/button";
import { signIn } from "next-auth/react";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Field-level validation errors
	const [emailError, setEmailError] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	// Check if user was redirected from registration
	const registered = searchParams.get("registered");

	const validateEmail = (email: string): boolean => {
		if (!email) {
			setEmailError("Email is required");
			return false;
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setEmailError("Please enter a valid email address");
			return false;
		}
		setEmailError(null);
		return true;
	};

	const validatePassword = (password: string): boolean => {
		if (!password) {
			setPasswordError("Password is required");
			return false;
		}
		setPasswordError(null);
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validate all fields
		const isEmailValid = validateEmail(email);
		const isPasswordValid = validatePassword(password);

		if (!isEmailValid || !isPasswordValid) {
			return;
		}

		setIsSubmitting(true);

		try {
			const callbackUrl = searchParams.get("callbackUrl") || "/openings";
			const result = await signIn("credentials", {
				email,
				password,
				rememberMe: rememberMe.toString(),
				redirect: false,
			});

			if (result?.error) {
				setError("Invalid email or password");
			} else {
				router.push(callbackUrl);
				router.refresh();
			}
		} catch (error) {
			setError("An unexpected error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4">
			<div className="w-full max-w-md">
				<h1 className="text-3xl font-bold mb-6 text-center">Login</h1>

				<form
					onSubmit={handleSubmit}
					className="flex flex-col gap-6 bg-background-page p-8 rounded border border-foreground/10"
				>
					{/* Success message for registration */}
					{registered && (
						<div className="p-3 bg-color-btn-primary/20 border border-color-btn-primary rounded text-sm">
							Account created successfully! Please log in.
						</div>
					)}

					{/* Global error message */}
					{error && (
						<div className="p-3 bg-[rgba(173,31,31,0.2)] border border-color-btn-danger rounded text-sm">
							{error}
						</div>
					)}

					{/* Email field */}
					<div className="flex flex-col gap-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								if (emailError) validateEmail(e.target.value);
							}}
							onBlur={() => validateEmail(email)}
							className={`p-3 rounded bg-background border ${
								emailError ? "border-color-btn-danger" : "border-[#444]"
							} text-foreground focus:outline-none focus:border-color-btn-primary`}
							disabled={isSubmitting}
						/>
						{emailError && (
							<span className="text-sm text-color-btn-danger">{emailError}</span>
						)}
					</div>

					{/* Password field */}
					<div className="flex flex-col gap-2">
						<label htmlFor="password" className="text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => {
								setPassword(e.target.value);
								if (passwordError) validatePassword(e.target.value);
							}}
							onBlur={() => validatePassword(password)}
							className={`p-3 rounded bg-background border ${
								passwordError ? "border-color-btn-danger" : "border-[#444]"
							} text-foreground focus:outline-none focus:border-color-btn-primary`}
							disabled={isSubmitting}
						/>
						{passwordError && (
							<span className="text-sm text-color-btn-danger">
								{passwordError}
							</span>
						)}
					</div>

					{/* Remember me checkbox */}
					<div className="flex items-center gap-2">
						<input
							id="rememberMe"
							type="checkbox"
							checked={rememberMe}
							onChange={(e) => setRememberMe(e.target.checked)}
							className="w-4 h-4"
							disabled={isSubmitting}
						/>
						<label htmlFor="rememberMe" className="text-sm">
							Remember me
						</label>
					</div>

					{/* Submit button */}
					<Button type="submit" buttonStyle={ButtonStyle.Primary} disabled={isSubmitting}>
						{isSubmitting ? "Logging in..." : "Login"}
					</Button>

					{/* Register link */}
					<div className="text-center text-sm">
						Don't have an account?{" "}
						<Link
							href="/register"
							className="text-color-btn-primary hover:text-color-btn-primary-hover"
						>
							Register here
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-xl">Loading...</div></div>}>
			<LoginForm />
		</Suspense>
	);
}
