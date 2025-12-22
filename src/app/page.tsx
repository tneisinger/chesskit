'use client';

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ScrollLock } from "@/components/ScrollLock";

export default function Home() {
  const { data: session } = useSession();
  const isLoggedIn = !!session;

  return (
    <ScrollLock>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-2.5rem)] p-4 sm:p-8">
        <main className="flex flex-col items-center max-w-4xl w-full gap-12">

          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground">
              Welcome to ChessKit
            </h1>
            <p className="text-xl sm:text-2xl text-foreground/70">
              Master chess openings with interactive training
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 w-full mt-8">

            {/* Openings Card */}
            <Link
              href="/openings"
              className="group p-8 rounded-lg bg-background-page border border-foreground/10 hover:border-color-btn-primary transition-all hover:shadow-lg no-underline"
            >
              <div className="flex flex-col gap-4">
                <div className="text-4xl">♟️</div>
                <h2 className="text-2xl font-bold text-foreground group-hover:text-color-btn-primary transition-colors">
                  Explore Openings
                </h2>
                <p className="text-foreground/70">
                  Browse and practice a curated collection of chess openings. Learn the key moves and ideas behind popular opening systems.
                </p>
                <div className="text-color-btn-primary font-medium mt-2">
                  Start Learning →
                </div>
              </div>
            </Link>

            {/* My Repertoire Card */}
            <Link
              href={isLoggedIn ? "/my-repertoire" : "/register"}
              className="group p-8 rounded-lg bg-background-page border border-foreground/10 hover:border-color-btn-primary transition-all hover:shadow-lg no-underline"
            >
              <div className="flex flex-col gap-4">
                <div className="text-4xl">📚</div>
                <h2 className="text-2xl font-bold text-foreground group-hover:text-color-btn-primary transition-colors">
                  My Repertoire
                </h2>
                <p className="text-foreground/70">
                  {isLoggedIn
                    ? "Create and manage your personal opening repertoire. Build, edit, and practice your own lines."
                    : "Create your own opening repertoire. Sign up to build custom opening lines tailored to your playing style."}
                </p>
                <div className="text-color-btn-primary font-medium mt-2">
                  {isLoggedIn ? "View My Repertoire →" : "Get Started →"}
                </div>
              </div>
            </Link>

          </div>

          {/* CTA Section for Non-Logged-In Users */}
          {!isLoggedIn && (
            <div className="mt-12 p-8 rounded-lg bg-color-btn-primary/10 border border-color-btn-primary/30 text-center">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Ready to build your repertoire?
              </h3>
              <p className="text-foreground/70 mb-6">
                Create an account to unlock the full potential of ChessKit
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/register"
                  className="px-8 py-3 rounded bg-color-btn-primary hover:bg-color-btn-primary-hover text-foreground font-bold no-underline transition-colors"
                >
                  Register
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-3 rounded bg-background-page border border-foreground/20 hover:bg-foreground/10 text-foreground font-bold no-underline transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>
          )}

          {/* Welcome Back Message for Logged-In Users */}
          {isLoggedIn && (
            <div className="mt-12 p-8 rounded-lg bg-color-btn-primary/10 border border-color-btn-primary/30 text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Welcome back, {session.user?.username}!
              </h3>
              <p className="text-foreground/70">
                Ready to continue your chess training?
              </p>
            </div>
          )}

        </main>
      </div>
    </ScrollLock>
  );
}
