"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers/auth-provider";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, LogIn, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginDebug, setLoginDebug] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null); // Local error state
  const { login, error, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const message = searchParams.get("message");

  // Check auth status cookie
  const checkAuthStatusCookie = () => {
    const cookies = document.cookie.split(";");
    return cookies.some((cookie) => cookie.trim().startsWith("auth_status="));
  };

  const checkSessionTokenCookie = () => {
    const cookies = document.cookie.split(";");
    return cookies.some((cookie) => cookie.trim().startsWith("session_token="));
  };
  // Handle redirection after login with more robust approach
  const doRedirect = (path: string) => {
    const baseUrl = window.location.origin;
    const targetUrl = baseUrl + path;

    setSuccessMessage(`Login successful! Redirecting to ${path}...`);
    console.log(`Redirecting to: ${targetUrl}`);

    // First store login state in sessionStorage as an immediate confirmation
    sessionStorage.setItem("loginSuccessful", "true");
    sessionStorage.setItem("loginRedirectPath", path);

    // Add a preventLoop flag to avoid middleware redirecting back to login
    sessionStorage.setItem("preventAuthLoop", "true");

    // Let cookie changes take effect before redirecting with a staged approach
    setTimeout(() => {
      // Verify cookies are set before redirecting
      if (checkAuthStatusCookie() && checkSessionTokenCookie()) {
        console.log("Auth cookies verified, proceeding with redirect");
        router.push(path);
      } else {
        console.log("Auth cookies not yet detected, trying again...");
        // Try again after a brief delay
        setTimeout(() => {
          console.log(
            "Final redirect attempt, cookies status:",
            checkAuthStatusCookie() ? "Auth Status: Yes" : "Auth Status: No",
            checkSessionTokenCookie()
              ? "Session Token: Yes"
              : "Session Token: No"
          );
          // Use router.push instead of window.location for better Next.js integration
          router.push(path);
        }, 1000);
      }
    }, 1000);
  };
  // Check if user is already logged in on page load
  useEffect(() => {
    // First check if we were redirected after login (prevent loops)
    const loginJustCompleted =
      sessionStorage.getItem("loginSuccessful") === "true";
    if (loginJustCompleted) {
      // We just logged in, so don't trigger another redirect loop from here
      console.log("Login just completed, preventing redirect loop");
      // Clear the flag so future page loads will check normally
      sessionStorage.removeItem("loginSuccessful");
      return;
    }

    if (user) {
      console.log("User found in context, redirecting to:", redirect);
      doRedirect(redirect);
      return;
    }

    // If we have auth cookies but no user yet, try to fetch user info
    if (!user && (checkAuthStatusCookie() || checkSessionTokenCookie())) {
      console.log("Auth cookie found, attempting to verify session");

      // Try to get user info
      fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store", // Prevent caching
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.json().then((data) => {
              console.log("Session verified successfully:", data.user?.email);

              // Store user in sessionStorage for redundancy
              if (data.user) {
                sessionStorage.setItem("authUser", JSON.stringify(data.user));
                // Wait a moment to ensure state updates properly before redirect
                setTimeout(() => {
                  doRedirect(redirect);
                }, 500);
              }
            });
          } else {
            console.warn(
              "Session verification failed with status:",
              response.status
            );
            // Clear invalid auth cookies
            document.cookie =
              "auth_status=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie =
              "session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            setLoginDebug(
              "Session verification failed. Please try logging in again."
            );
          }
        })
        .catch((err) => {
          console.error("Error verifying session:", err);
          setLoginDebug(
            `Error verifying session: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
    }
  }, [user, redirect]);

  // Success message from URL parameter
  useEffect(() => {
    if (message) {
      setSuccessMessage(message);
    }
  }, [message]);
  // Handle login form submission with improved error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setLoginDebug(null); // Clear any previous debug messages
    setLocalError(null); // Clear local error state

    try {
      // Direct login approach to bypass potential issues with the auth context
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Login successful via direct API call");

        // Store user data in sessionStorage
        if (data.user) {
          sessionStorage.setItem("authUser", JSON.stringify(data.user));
        }

        // Use redirectUrl from API response if available, otherwise use default redirect
        const redirectPath = data.redirectUrl || redirect;
        console.log("Redirecting to:", redirectPath);

        // Show success message and redirect
        setSuccessMessage("Login successful! Redirecting...");
        doRedirect(redirectPath);
      } else {
        // Handle API error
        const errorData = await response.json();
        setLocalError(errorData.message || "Login failed");
        console.error("Login API error:", errorData);
      }
    } catch (err) {
      console.error("Login submission error:", err);
      setLocalError(
        "Login failed - please check your connection and try again"
      );

      // Fallback to context-based login as backup
      try {
        await login(username, password, rememberMe);

        // Check for auth cookies after login attempt
        setTimeout(() => {
          if (checkAuthStatusCookie() || checkSessionTokenCookie()) {
            setSuccessMessage(
              "Login successful via fallback method! Redirecting..."
            );
            doRedirect(redirect);
          }
        }, 1000);
      } catch (contextErr) {
        console.error("Context login also failed:", contextErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to directly go to dashboard
  const forceDashboard = () => {
    doRedirect("/dashboard");
  };
  // Debug API connectivity and check auth status
  const debugLoginApi = async () => {
    try {
      setLoginDebug("Testing API connectivity and auth status...");

      // First check generic API connectivity
      const apiResponse = await fetch("/api/debug/auth", {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!apiResponse.ok) {
        setLoginDebug(
          `API connectivity test failed: ${apiResponse.status} ${apiResponse.statusText}`
        );
        return;
      }

      // Now check auth status
      const authStatusResponse = await fetch("/api/debug/auth-status", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!authStatusResponse.ok) {
        setLoginDebug(
          `Auth status check failed: ${authStatusResponse.status} ${authStatusResponse.statusText}`
        );
        return;
      }

      const data = await authStatusResponse.json();

      // Format cookie information for display
      const cookieInfo = data.cookies
        .map(
          (c: any) =>
            `${c.name}=${
              c.name === "session_token" ? "[REDACTED]" : c.value
            }; path=${c.path}`
        )
        .join("\n");

      // Format token information
      const tokenInfo = data.authState.tokenValid
        ? `Valid token for user ID: ${data.authState.tokenData.userId}, role: ${data.authState.tokenData.role}`
        : `Token status: ${data.authState.tokenStatus}`;

      // Format response as structured debug output
      setLoginDebug(
        `AUTH STATUS REPORT\n` +
          `=================\n` +
          `Timestamp: ${data.timestamp}\n` +
          `Client cookies (browser): ${document.cookie}\n\n` +
          `SERVER AUTH STATE:\n` +
          `${tokenInfo}\n` +
          `Auth status cookie: ${data.authState.authStatus}\n` +
          `Token expires in: ${
            data.authState.tokenData?.expiresIn
              ? Math.round(data.authState.tokenData.expiresIn / 1000 / 60) +
                " minutes"
              : "N/A"
          }\n\n` +
          `SERVER COOKIES:\n${cookieInfo}\n\n` +
          `Current URL: ${data.url}`
      );
    } catch (err) {
      setLoginDebug(
        `API test error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Test cookie functionality
  const debugCookies = async () => {
    try {
      setLoginDebug("Testing cookie functionality...");
      const response = await fetch("/api/debug/cookies", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        setLoginDebug(
          `API returned non-JSON response: ${textResponse.substring(0, 100)}...`
        );
        return;
      }

      interface CookieTestResult {
        timestamp: string;
        cookies?: { name: string; value: string }[];
      }

      const data: CookieTestResult = await response.json();
      const cookies = document.cookie.split(";");
      const testCookie = cookies.some((cookie) =>
        cookie.trim().startsWith("test_cookie=")
      );
      const authStatus = cookies.some((cookie) =>
        cookie.trim().startsWith("auth_status=")
      );
      setLoginDebug(`Cookie Test Results:
    Browser URL: ${window.location.href}
    Browser cookies: ${cookies.map((c: string) => c.trim()).join(", ")}
    Server cookies: ${
      data.cookies?.map((c: { name: string }) => c.name).join(", ") || "none"
    }
    Test cookie set: ${testCookie ? "Yes" : "No"}
    Auth status cookie: ${authStatus ? "Yes" : "No"}
    Session token present: ${checkSessionTokenCookie() ? "Yes" : "No"}
    Timestamp: ${data.timestamp}
      `);

      if (testCookie) {
        setSuccessMessage(
          "Cookie test successful. Cookies are working properly!"
        );
      } else {
        setLoginDebug(
          (prev) =>
            `${prev}\n\nWARNING: Cookie test failed. This may indicate browser restrictions or issues with cookie settings.`
        );
      }
    } catch (err) {
      setLoginDebug(
        `Cookie test error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Direct login function using debug endpoint
  const directLogin = async () => {
    try {
      setLoginDebug("Attempting direct login...");
      setIsSubmitting(true);
      const testEmail = username || "hindavi815@gmail.com";

      const response = await fetch("/api/debug/direct-login", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testEmail,
          bypass: "debug-mode-bypass",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLoginDebug(
          `Direct login successful for: ${data.user.email} (${data.user.role})`
        ); // Store the user info in sessionStorage
        sessionStorage.setItem("authUser", JSON.stringify(data.user));

        // Set a flag to prevent redirect loops
        sessionStorage.setItem("preventAuthLoop", "true");

        // Redirect to dashboard with delay to ensure cookies are set
        doRedirect("/dashboard");
      } else {
        setLoginDebug(
          `Direct login failed: ${response.status} ${response.statusText}`
        );
        try {
          const errorData = await response.json();
          setLoginDebug(
            (prev) => `${prev}\nError: ${errorData.message || "Unknown error"}`
          );
        } catch (e) {
          // Response might not be JSON
        }
      }
    } catch (err) {
      setLoginDebug(
        `Direct login error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run full diagnostic test
  const runDiagnostic = async () => {
    try {
      setLoginDebug("Running full diagnostic test...");

      // Current browser information
      const browserInfo = {
        url: window.location.href,
        origin: window.location.origin,
        host: window.location.host,
        hostname: window.location.hostname,
        port: window.location.port || "default",
        protocol: window.location.protocol,
        cookies: document.cookie
          .split(";")
          .map((c) => c.trim())
          .join(", "),
      };

      setLoginDebug(`
DIAGNOSTIC REPORT
================

BROWSER INFORMATION:
${JSON.stringify(browserInfo, null, 2)}

CHECKING COOKIES:
Auth status cookie: ${checkAuthStatusCookie() ? "Present" : "Missing"}
Session token cookie: ${checkSessionTokenCookie() ? "Present" : "Missing"}

RUNNING FURTHER TESTS...
      `);

      // Test API access
      const diagnosticResponse = await fetch("/api/debug/diagnostic", {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      // Test direct login
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "hindavi815@gmail.com",
          password: "password123",
          rememberMe: true,
        }),
      });

      // Compile results
      const diagnosticResults = diagnosticResponse.ok
        ? await diagnosticResponse.json()
        : {
            error: `${diagnosticResponse.status} ${diagnosticResponse.statusText}`,
          };

      const loginResults = loginResponse.ok
        ? await loginResponse.json()
        : { error: `${loginResponse.status} ${loginResponse.statusText}` };

      setLoginDebug(`
DIAGNOSTIC REPORT
================

BROWSER INFORMATION:
${JSON.stringify(browserInfo, null, 2)}

API DIAGNOSTIC RESULTS:
${JSON.stringify(diagnosticResults, null, 2)}

TEST LOGIN RESULTS:
${JSON.stringify(loginResults, null, 2)}

COOKIE STATUS AFTER TESTS:
Auth status cookie: ${checkAuthStatusCookie() ? "Present" : "Missing"}
Session token cookie: ${checkSessionTokenCookie() ? "Present" : "Missing"}

RECOMMENDATIONS:
${
  loginResponse.ok
    ? "- Login API is working. Try Force Dashboard button to navigate directly."
    : "- Login API failed. Check credentials and database connection."
}
${
  !checkSessionTokenCookie()
    ? "- Session cookies are not being set. This may be due to browser restrictions or CORS issues."
    : "- Session cookies are successfully set."
}
- For Vercel deployment, ensure middleware.ts is properly configured
- Check browser console for any JavaScript errors
- Make sure JWT_SECRET is consistent across both local and deployed environments
      `);
    } catch (err) {
      setLoginDebug(
        `Diagnostic test error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md overflow-hidden border-0 shadow-xl">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-1"></div>
        <CardHeader className="space-y-2 text-center pb-6 pt-8">
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your IMS account</CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 text-sm rounded-md border border-green-100 mb-4">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {localError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          {loginDebug && (
            <div className="p-3 bg-gray-50 text-gray-700 text-xs rounded-md border border-gray-200 font-mono whitespace-pre-wrap mb-4 max-h-48 overflow-auto">
              {loginDebug}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="Enter your Faculty ID or Roll Number"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-11"
              />
              <p className="text-xs text-gray-500">
                For faculty/admin: Enter your Faculty ID
                <br />
                For student: Enter your Roll Number
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label
                htmlFor="rememberMe"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 transition-colors"
              disabled={isSubmitting || !username || !password}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </span>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={debugLoginApi}
                className="text-xs text-gray-500 hover:text-gray-700 mr-2"
              >
                Debug API
              </button>
              <button
                type="button"
                onClick={debugCookies}
                className="text-xs text-gray-500 hover:text-gray-700 mr-2"
              >
                Test Cookies
              </button>
              <button
                type="button"
                onClick={runDiagnostic}
                className="text-xs text-gray-500 hover:text-gray-700 mr-2"
              >
                Full Diagnostic
              </button>
              <button
                type="button"
                onClick={directLogin}
                className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded mr-2"
              >
                Direct Login
              </button>
              <button
                type="button"
                onClick={forceDashboard}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Force Dashboard
              </button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pb-8">
          <Separator className="my-2" />
          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              Create an account
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
