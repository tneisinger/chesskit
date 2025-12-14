"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button, { ButtonStyle } from "@/components/button";
import { registerUser } from "./actions";

export default function RegisterPage() {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Field-level validation errors
	const [usernameError, setUsernameError] = useState<string | null>(null);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

	const validateUsername = (username: string): boolean => {
		if (!username) {
			setUsernameError("Username is required");
			return false;
		}
		if (username.length < 3) {
			setUsernameError("Username must be at least 3 characters");
			return false;
		}
		setUsernameError(null);
		return true;
	};

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
		if (password.length < 8) {
			setPasswordError("Password must be at least 8 characters");
			return false;
		}
		setPasswordError(null);
		return true;
	};

	const validateConfirmPassword = (confirmPassword: string): boolean => {
		if (!confirmPassword) {
			setConfirmPasswordError("Please confirm your password");
			return false;
		}
		if (confirmPassword !== password) {
			setConfirmPasswordError("Passwords do not match");
			return false;
		}
		setConfirmPasswordError(null);
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validate all fields
		const isUsernameValid = validateUsername(username);
		const isEmailValid = validateEmail(email);
		const isPasswordValid = validatePassword(password);
		const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

		if (
			!isUsernameValid ||
			!isEmailValid ||
			!isPasswordValid ||
			!isConfirmPasswordValid
		) {
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await registerUser({ username, email, password });

			if (result.success) {
				router.push("/login?registered=true");
			} else {
				setError(result.error || "Registration failed");
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
				<h1 className="text-3xl font-bold mb-6 text-center">Register</h1>

				<form
					onSubmit={handleSubmit}
					className="flex flex-col gap-6 bg-background-page p-8 rounded border border-foreground/10"
				>
					{error && (
						<div className="p-3 bg-[rgba(173,31,31,0.2)] border border-color-btn-danger rounded text-sm">
							{error}
						</div>
					)}

					{/* Username field */}
					<div className="flex flex-col gap-2">
						<label htmlFor="username" className="text-sm font-medium">
							Username
						</label>
						<input
							id="username"
							type="text"
							value={username}
							onChange={(e) => {
								setUsername(e.target.value);
								if (usernameError) validateUsername(e.target.value);
							}}
							onBlur={() => validateUsername(username)}
							className={`p-3 rounded bg-background border ${
								usernameError ? "border-color-btn-danger" : "border-[#444]"
							} text-foreground focus:outline-none focus:border-color-btn-primary`}
							disabled={isSubmitting}
						/>
						{usernameError && (
							<span className="text-sm text-color-btn-danger">
								{usernameError}
							</span>
						)}
					</div>

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
						<span className="text-xs text-foreground/60">
							Must be at least 8 characters
						</span>
					</div>

					{/* Confirm Password field */}
					<div className="flex flex-col gap-2">
						<label htmlFor="confirmPassword" className="text-sm font-medium">
							Confirm Password
						</label>
						<input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => {
								setConfirmPassword(e.target.value);
								if (confirmPasswordError) validateConfirmPassword(e.target.value);
							}}
							onBlur={() => validateConfirmPassword(confirmPassword)}
							className={`p-3 rounded bg-background border ${
								confirmPasswordError ? "border-color-btn-danger" : "border-[#444]"
							} text-foreground focus:outline-none focus:border-color-btn-primary`}
							disabled={isSubmitting}
						/>
						{confirmPasswordError && (
							<span className="text-sm text-color-btn-danger">
								{confirmPasswordError}
							</span>
						)}
					</div>

					{/* Submit button */}
					<Button type="submit" buttonStyle={ButtonStyle.Primary} disabled={isSubmitting}>
						{isSubmitting ? "Creating account..." : "Register"}
					</Button>

					{/* Login link */}
					<div className="text-center text-sm">
						Already have an account?{" "}
						<Link
							href="/login"
							className="text-color-btn-primary hover:text-color-btn-primary-hover"
						>
							Login here
						</Link>
					</div>
				</form>
			</div>
		</div>
	);
}
