import { LoginForm } from "./login-form"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}

