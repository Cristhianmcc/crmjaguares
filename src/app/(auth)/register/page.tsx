"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signUp.email({
      name: nombre,
      email,
      password,
    });
    if (err) {
      setLoading(false);
      setError(err.message ?? "No se pudo crear la cuenta.");
      return;
    }
    // Renombrar la organización con el nombre del negocio
    if (negocio.trim()) {
      await fetch("/api/org/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: negocio.trim() }),
      });
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Crea tu cuenta gratis</CardTitle>
        <CardDescription>
          14 días de prueba gratuita · Sin tarjeta de crédito
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Tu nombre</Label>
            <Input
              id="nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="negocio">Nombre de tu negocio</Label>
            <Input
              id="negocio"
              required
              placeholder="Ej: Academia Fit Lima"
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando cuenta\u2026" : "Empezar prueba gratis"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            \u00bfYa tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Inicia sesi\u00f3n
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
