import { createHmac, timingSafeEqual } from "node:crypto";

export type TaypiMode = "sandbox" | "production";

export interface TaypiConfig {
  enabled: boolean;
  mode: TaypiMode;
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
}

export function getTaypiConfig(env = process.env): TaypiConfig {
  const mode = (env.TAYPI_ENV || "sandbox") as TaypiMode;
  const publicKey = env.TAYPI_PUBLIC_KEY || "";
  const secretKey = env.TAYPI_SECRET_KEY || "";
  const webhookSecret = env.TAYPI_WEBHOOK_SECRET || "";
  const enabled = Boolean(publicKey && secretKey);
  const baseUrl =
    mode === "production"
      ? "https://app.taypi.pe"
      : "https://sandbox.taypi.pe";

  return {
    enabled,
    mode,
    publicKey,
    secretKey,
    webhookSecret,
    baseUrl,
  };
}

export interface CreatePaymentParams {
  amount: string; // ej. "79.00"
  reference: string; // orderId
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TaypiPaymentResult {
  payment_id: string;
  checkout_token: string;
  checkout_url?: string;
  amount: string;
  currency: string;
  status: string;
  [key: string]: unknown;
}

export class TaypiClient {
  readonly publicKey: string;
  private readonly secretKey: string;
  readonly baseUrl: string;
  readonly timeout: number;

  constructor(publicKey: string, secretKey: string, baseUrl: string, timeout = 25) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async createPayment(
    params: CreatePaymentParams,
    idempotencyKey?: string
  ): Promise<TaypiPaymentResult> {
    const res = await this.request<TaypiPaymentResult>(
      "POST",
      "/api/v1/payments",
      params,
      idempotencyKey
    );
    return res;
  }

  async getPayment(paymentId: string): Promise<TaypiPaymentResult> {
    return this.request<TaypiPaymentResult>("GET", `/api/v1/payments/${paymentId}`);
  }

  verifyWebhook(rawPayload: string | Buffer, signature: string, webhookSecret: string): boolean {
    const raw = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf8");
    const expected = "sha256=" + createHmac("sha256", webhookSecret).update(raw).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    params?: unknown,
    idempotencyKey?: string
  ): Promise<T> {
    const body = params ? JSON.stringify(params) : "";
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signaturePath = new URL(path, this.baseUrl).pathname;
    const message = `${timestamp}\n${method}\n${signaturePath}\n${body}`;
    const signature = createHmac("sha256", this.secretKey).update(message).digest("hex");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.publicKey}`,
      "Taypi-Signature": signature,
      "Taypi-Timestamp": timestamp,
      "User-Agent": "monterrial-crm/1.0",
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? body : undefined,
      signal: AbortSignal.timeout(this.timeout * 1000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = (data && (data.message || data.error)) || `HTTP ${response.status} en Taypi API`;
      throw new Error(errMsg);
    }

    return (data && (data.data || data)) as T;
  }
}

export function getTaypiClient(): TaypiClient | null {
  const config = getTaypiConfig();
  if (!config.enabled) return null;
  return new TaypiClient(config.publicKey, config.secretKey, config.baseUrl);
}

