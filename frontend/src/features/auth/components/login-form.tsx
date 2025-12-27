import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useConfig } from "@/shared/hooks/use-config"
import { useAuth } from "@/shared/hooks/use-auth"
import { useEffect, useState, FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Plasma from "./plasma"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [config] = useConfig()
  const { login, isLoading, error, clearError } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    const root = document.documentElement
    if (config.theme === "dark") {
      root.classList.add("dark")
    } else if (config.theme === "light") {
      root.classList.remove("dark")
    } else {
      // system theme
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
  }, [config.theme])

  useEffect(() => {
    // Clear local error when user starts typing
    if (localError) {
      setLocalError(null)
    }
  }, [username, password])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!username.trim()) {
      setLocalError("Username or email is required")
      return
    }

    if (!password) {
      setLocalError("Password is required")
      return
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters")
      return
    }

    try {
      await login(username.trim(), password)
    } catch (err) {
      // Error is handled by useAuth hook
      setLocalError(err instanceof Error ? err.message : "Login failed")
    }
  }

  const displayError = localError || error

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Acme Inc account
                </p>
              </div>
              {displayError && (
                <Alert variant="destructive">
                  <AlertDescription>{displayError}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="username">Username or Email</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="username@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="username"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </Field>
              <FieldDescription className="text-center">
                Don&apos;t have an account? <a href="#">Sign up</a>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block self-stretch min-h-[400px] overflow-hidden">
            <Plasma
              speed={1}
              direction="forward"
              scale={1}
              opacity={1}
              mouseInteractive={false}
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

