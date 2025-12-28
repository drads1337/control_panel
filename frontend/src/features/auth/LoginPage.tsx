import { LoginForm } from "./components/login-form"

export default function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-xs md:max-w-2xl">
        <LoginForm />
      </div>
    </div>
  )
}